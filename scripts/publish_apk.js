const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const versionJsonPath = path.join(rootDir, 'public', 'version.json');
const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

function run(cmd, cwd = rootDir) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

try {
  console.log('=== PUBLICANDO NUEVA VERSION DE APK CONTROL DOCENTE ===');

  // 1. Leer version.json
  const versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
  const currentBuild = parseInt(versionData.versionCode, 10) || 1;
  const nextBuild = currentBuild + 1;

  // Incrementar version semver menor
  const parts = versionData.version.split('.').map(n => parseInt(n, 10) || 0);
  parts[2] = (parts[2] || 0) + 1;
  const nextVersion = parts.join('.');

  const notesArg = process.argv[2] || versionData.notes || 'Mejoras de rendimiento, estabilidad y nuevas funciones.';

  versionData.version = nextVersion;
  versionData.versionCode = nextBuild;
  versionData.releaseDate = new Date().toISOString().split('T')[0];
  versionData.notes = notesArg;
  if (!versionData.features) {
    versionData.features = [];
  }

  fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`[1/5] Actualizado version.json -> v${nextVersion} (Build ${nextBuild})`);

  // 2. Actualizar versionCode en android/app/build.gradle y src/utils/appUpdateChecker.js
  let gradleContent = fs.readFileSync(gradlePath, 'utf8');
  gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${nextBuild}`);
  gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
  fs.writeFileSync(gradlePath, gradleContent);
  console.log(`[2/5] Actualizado build.gradle -> versionCode ${nextBuild}, versionName "${nextVersion}"`);

  const checkerPath = path.join(rootDir, 'src', 'utils', 'appUpdateChecker.js');
  if (fs.existsSync(checkerPath)) {
    let checkerContent = fs.readFileSync(checkerPath, 'utf8');
    checkerContent = checkerContent.replace(/export const APP_CURRENT_VERSION = '[^']+';/, `export const APP_CURRENT_VERSION = '${nextVersion}';`);
    checkerContent = checkerContent.replace(/export const APP_CURRENT_BUILD = \d+;/, `export const APP_CURRENT_BUILD = ${nextBuild};`);
    fs.writeFileSync(checkerPath, checkerContent);
    console.log(`[2b/5] Actualizado appUpdateChecker.js -> v${nextVersion} (Build ${nextBuild})`);
  }

  // 3. Compilar frontend y sincronizar assets con Android
  console.log('[3/5] Compilando web assets con Vite...');
  run('npm run build');
  run('npx cap copy android');

  // Eliminar APK recursiva de los assets de Android para evitar duplicación de tamaño
  const recursiveApk = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public', 'control-doc.apk');
  if (fs.existsSync(recursiveApk)) {
    fs.unlinkSync(recursiveApk);
    console.log('-> Eliminada APK recursiva de android/app/src/main/assets/public');
  }

  // 4. Compilar APK Nativa con Gradle
  console.log('[4/5] Compilando APK Nativa con Gradle...');
  const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug';
  run(gradlewCmd, path.join(rootDir, 'android'));

  // 5. Copiar APK a public/control-doc.apk
  const srcApk = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  const destApk = path.join(rootDir, 'public', 'control-doc.apk');
  fs.copyFileSync(srcApk, destApk);
  console.log(`[5/5] APK copiada exitosamente a public/control-doc.apk (${(fs.statSync(destApk).size / (1024 * 1024)).toFixed(2)} MB)`);

  // Re-compilar Vite para que dist/ contenga la nueva APK y version.json
  run('npm run build');

  console.log('\n========================================================');
  console.log(`✅ NUEVA VERSION LISTA: v${nextVersion} (Build ${nextBuild})`);
  console.log('Ahora ejecuta "git push origin main" o tu script "actualizar.bat"');
  console.log('para desplegar la actualizacion en Cloudflare Pages.');
  console.log('Todos los usuarios recibiran el popup de actualizacion.');
  console.log('========================================================\n');
} catch (err) {
  console.error('\n❌ ERROR AL PUBLICAR NUEVA VERSION:', err.message);
  process.exit(1);
}
