<?php
/**
 * ExcelSyncer.php - Detección Automática y Sincronización Inteligente de CONTROL DOCENTE.xlsx
 */

require_once __DIR__ . '/Database.php';

class ExcelSyncer {
    private static string $excelPath = __DIR__ . '/../CONTROL DOCENTE.xlsx';

    public static function checkAndSyncIfNeeded(bool $force = false): array {
        if (!file_exists(self::$excelPath)) {
            return ['synced' => false, 'message' => 'Archivo CONTROL DOCENTE.xlsx no encontrado.'];
        }

        $pdo = Database::getConnection();

        // Create metadata table if not exists
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS sync_metadata (
                id INTEGER PRIMARY KEY,
                excel_hash TEXT,
                excel_mtime INTEGER,
                last_synced_at TEXT,
                total_classes INTEGER
            )
        ");

        $stmt = $pdo->query("SELECT * FROM sync_metadata WHERE id = 1");
        $meta = $stmt->fetch();

        $currentMtime = filemtime(self::$excelPath);
        $currentHash = md5_file(self::$excelPath);

        if (!$force && $meta && $meta['excel_hash'] === $currentHash && (int)$meta['excel_mtime'] === $currentMtime) {
            return [
                'synced' => false,
                'alreadyUpToDate' => true,
                'lastSyncedAt' => $meta['last_synced_at'],
                'totalClasses' => $meta['total_classes']
            ];
        }

        // Run synchronization
        return self::executeSync($pdo, $currentHash, $currentMtime);
    }

    private static function executeSync(PDO $pdo, string $hash, int $mtime): array {
        // Run dedicated worker to safely extract data from CONTROL DOCENTE.xlsx
        $workerPath = realpath(__DIR__ . '/sync_worker.js');
        $cmd = 'node "' . $workerPath . '"';
        $output = shell_exec($cmd);
        if (!$output) {
            return ['synced' => false, 'message' => 'Error al leer estructura del Excel.'];
        }

        $data = json_decode($output, true);
        if (!$data || !isset($data['asistencia'])) {
            return ['synced' => false, 'message' => 'Error decodificando datos del Excel.'];
        }

        $pdo->beginTransaction();
        try {
            $updatedCount = 0;
            $newCount = 0;

            // Prepare statements
            $checkStmt = $pdo->prepare("SELECT id, asistencia, puntualidad, hora_inicio_real, observacion FROM asistencia WHERE nrc = ? AND UPPER(dia) = ? AND hora_inicio_prog = ? AND aula = ?");
            $updateStmt = $pdo->prepare("
                UPDATE asistencia SET
                    piso_pabellon = ?, sede = ?, periodo = ?, lista_cruzada = ?,
                    codigo_docente = ?, docente = ?, curso = ?, carrera = ?,
                    hora_final_prog = ?, real_horas = ?, ciclo = ?, updated_at = ?
                WHERE id = ?
            ");
            $insertStmt = $pdo->prepare("
                INSERT INTO asistencia (
                    id, piso_pabellon, sede, periodo, dia, hora_inicio_prog, hora_final_prog,
                    aula, nrc, lista_cruzada, codigo_docente, docente, curso, carrera,
                    hora_inicio_real, hora_final_real, asistencia, puntualidad, observacion,
                    real_horas, ciclo, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $now = date('Y-m-d H:i:s');

            foreach ($data['asistencia'] as $a) {
                $diaUpper = strtoupper(trim($a['dia']));
                $checkStmt->execute([$a['nrc'], $diaUpper, $a['horaInicioProg'], $a['aula']]);
                $existing = $checkStmt->fetch();

                if ($existing) {
                    // Update schedule & course details WITHOUT erasing attendance mark!
                    $updateStmt->execute([
                        $a['pisoPabellon'], $a['sede'], $a['periodo'], $a['listaCruzada'],
                        $a['codigoDocente'], $a['docente'], $a['curso'], $a['carrera'],
                        $a['horaFinalProg'], $a['real'], $a['ciclo'], $now,
                        $existing['id']
                    ]);
                    $updatedCount++;
                } else {
                    // New class found in updated Excel
                    $insertStmt->execute([
                        $a['id'], $a['pisoPabellon'], $a['sede'], $a['periodo'], $a['dia'],
                        $a['horaInicioProg'], $a['horaFinalProg'], $a['aula'], $a['nrc'],
                        $a['listaCruzada'], $a['codigoDocente'], $a['docente'], $a['curso'],
                        $a['carrera'], '', '', 'PENDIENTE', '-', '', $a['real'], $a['ciclo'], $now
                    ]);
                    $newCount++;
                }
            }

            // Sync Ambientes
            if (isset($data['ambientes'])) {
                $ambStmt = $pdo->prepare("
                    INSERT OR REPLACE INTO ambientes (abrv, nombre, pc, aforo, pabellon, piso, ubicacion, tipo)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                foreach ($data['ambientes'] as $amb) {
                    $ambStmt->execute([
                        $amb['abrv'], $amb['nombre'], $amb['pc'], $amb['aforo'],
                        $amb['pabellon'], $amb['piso'], $amb['ubicacion'], $amb['tipo']
                    ]);
                }
            }

            // Update sync metadata
            $totalClasses = count($data['asistencia']);
            $pdo->exec("DELETE FROM sync_metadata WHERE id = 1");
            $metaStmt = $pdo->prepare("
                INSERT INTO sync_metadata (id, excel_hash, excel_mtime, last_synced_at, total_classes)
                VALUES (1, ?, ?, ?, ?)
            ");
            $metaStmt->execute([$hash, $mtime, $now, $totalClasses]);

            $pdo->commit();

            return [
                'synced' => true,
                'updatedClasses' => $updatedCount,
                'newClasses' => $newCount,
                'totalClasses' => $totalClasses,
                'timestamp' => $now,
                'message' => "Sincronización completada: {$newCount} clases nuevas, {$updatedCount} actualizadas (asistencias previas preservadas)."
            ];
        } catch (Exception $e) {
            $pdo->rollBack();
            return ['synced' => false, 'message' => 'Error durante la sincronización: ' . $e->getMessage()];
        }
    }
}
