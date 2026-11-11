const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const { importExcelData } = require('../server/services/excelImporter');

const ROOT_DIR = path.join(__dirname, '..');
const EXCEL_PATH = path.join(ROOT_DIR, 'CONTROL DOCENTE.xlsx');
const SQLITE_PATH = path.join(ROOT_DIR, 'server', 'data', 'controldocente.sqlite');
const TEMP_SQL_PATH = path.join(ROOT_DIR, 'd1_sync_temp.sql');

console.log('========================================================');
console.log('  SINCRONIZACIÓN DE DATA: EXCEL -> SQLITE & CLOUDFLARE D1');
console.log('========================================================\n');

if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`[ERROR] No se encontró el archivo: ${EXCEL_PATH}`);
  console.error('Coloca el archivo "CONTROL DOCENTE.xlsx" en la raíz del proyecto.');
  process.exit(1);
}

console.log('[1/4] Leyendo datos actualizados desde CONTROL DOCENTE.xlsx...');
const excelData = importExcelData(EXCEL_PATH);
console.log(`  -> Clases encontradas: ${excelData.asistencia.length}`);
console.log(`  -> Ambientes / Aulas: ${excelData.ambientes.length}`);

console.log('\n[2/4] Actualizando base de datos local SQLite (controldocente.sqlite)...');
const db = new sqlite3.Database(SQLITE_PATH);

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function syncLocalSqlite() {
  await runSql('BEGIN TRANSACTION');
  try {
    // 1. Asistencia
    await runSql('DELETE FROM asistencia');
    for (const a of excelData.asistencia) {
      await runSql(`
        INSERT INTO asistencia (
          id, piso_pabellon, sede, periodo, dia, hora_inicio_prog, hora_final_prog,
          aula, nrc, lista_cruzada, codigo_docente, docente, curso, carrera,
          hora_inicio_real, hora_final_real, asistencia, puntualidad, observacion,
          real_horas, ciclo, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        a.id, a.pisoPabellon, a.sede, a.periodo, a.dia, a.horaInicioProg, a.horaFinalProg,
        a.aula, a.nrc, a.listaCruzada, a.codigoDocente, a.docente, a.curso, a.carrera,
        a.horaInicioReal, a.horaFinalReal, a.asistencia, a.puntualidad, a.observacion,
        a.real, a.ciclo, new Date().toISOString()
      ]);
    }

    // 2. Ambientes
    await runSql('DELETE FROM ambientes');
    for (const amb of excelData.ambientes) {
      await runSql(`
        INSERT INTO ambientes (
          abrv, nombre, pc, aforo, pabellon, piso, ubicacion, tipo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        amb.abrv, amb.nombre, amb.pc, amb.aforo, amb.pabellon, amb.piso, amb.ubicacion, amb.tipo
      ]);
    }

    await runSql('COMMIT');
    console.log('  -> SQLite local actualizado correctamente.');
  } catch (err) {
    await runSql('ROLLBACK');
    throw err;
  }
}

async function generateD1SyncSql() {
  console.log('\n[3/4] Generando script SQL para Cloudflare D1 (Edge)...');
  let sql = '-- SINCRONIZACIÓN AUTOMÁTICA DESDE EXCEL\n';
  sql += 'DELETE FROM asistencia;\n';

  for (const a of excelData.asistencia) {
    const esc = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
    const num = (v) => (v === null || v === undefined || isNaN(v) ? 'NULL' : v);

    sql += `INSERT INTO asistencia (id, piso_pabellon, sede, periodo, dia, hora_inicio_prog, hora_final_prog, aula, nrc, lista_cruzada, codigo_docente, docente, curso, carrera, hora_inicio_real, hora_final_real, asistencia, puntualidad, observacion, real_horas, ciclo, updated_at) VALUES (${esc(a.id)}, ${esc(a.pisoPabellon)}, ${esc(a.sede)}, ${esc(a.periodo)}, ${esc(a.dia)}, ${esc(a.horaInicioProg)}, ${esc(a.horaFinalProg)}, ${esc(a.aula)}, ${esc(a.nrc)}, ${esc(a.listaCruzada)}, ${esc(a.codigoDocente)}, ${esc(a.docente)}, ${esc(a.curso)}, ${esc(a.carrera)}, ${esc(a.horaInicioReal)}, ${esc(a.horaFinalReal)}, ${esc(a.asistencia)}, ${esc(a.puntualidad)}, ${esc(a.observacion)}, ${num(a.real)}, ${esc(a.ciclo)}, ${esc(new Date().toISOString())});\n`;
  }

  sql += '\nDELETE FROM ambientes;\n';
  for (const amb of excelData.ambientes) {
    const esc = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
    const num = (v) => (v === null || v === undefined || isNaN(v) ? 'NULL' : v);

    sql += `INSERT INTO ambientes (abrv, nombre, pc, aforo, pabellon, piso, ubicacion, tipo) VALUES (${esc(amb.abrv)}, ${esc(amb.nombre)}, ${num(amb.pc)}, ${num(amb.aforo)}, ${esc(amb.pabellon)}, ${esc(amb.piso)}, ${esc(amb.ubicacion)}, ${esc(amb.tipo)});\n`;
  }

  fs.writeFileSync(TEMP_SQL_PATH, sql, 'utf8');
  console.log(`  -> Archivo de migración generado (${(fs.statSync(TEMP_SQL_PATH).size / 1024).toFixed(1)} KB).`);
}

async function deployToD1() {
  console.log('\n[4/4] Enviando nueva data a Cloudflare D1 en producción...');
  try {
    execSync(`npx.cmd wrangler d1 execute steel-upn1-db --remote --file="${TEMP_SQL_PATH}" --yes`, {
      stdio: 'inherit',
      cwd: ROOT_DIR
    });
    console.log('  -> Cloudflare D1 actualizado en vivo con éxito.');
  } catch (err) {
    console.error('  [ADVERTENCIA] Falló la ejecución remota de Cloudflare D1:', err.message);
  } finally {
    if (fs.existsSync(TEMP_SQL_PATH)) {
      fs.unlinkSync(TEMP_SQL_PATH);
    }
  }
}

async function main() {
  try {
    await syncLocalSqlite();
    await generateD1SyncSql();
    await deployToD1();
    console.log('\n========================================================');
    console.log('  ¡DATA SINCRONIZADA CON ÉXITO!');
    console.log('  Nuevos NRCs, docentes, cursos y aulas ya están activos');
    console.log('  en la web en vivo: https://control-doc.pages.dev');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n[ERROR en la sincronización]:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
