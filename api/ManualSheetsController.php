<?php
/**
 * ManualSheetsController.php - Emisión de Hojas de Asistencia Manual
 */

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class ManualSheetsController {
    public static function list(): void {
        $pdo = Database::getConnection();

        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $fecha = isset($_GET['fecha']) ? trim($_GET['fecha']) : '';

        $sql = "SELECT * FROM hojas_manuales WHERE 1=1";
        $params = [];

        if (!empty($fecha)) {
            $sql .= " AND fecha = ?";
            $params[] = $fecha;
        }

        if (!empty($search)) {
            $sql .= " AND (LOWER(codigo) LIKE ? OR LOWER(docente) LIKE ? OR LOWER(curso) LIKE ? OR nrc LIKE ?)";
            $s = '%' . strtolower($search) . '%';
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $sql .= " ORDER BY created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'count' => count($rows),
            'data' => $rows
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function create(): void {
        $pdo = Database::getConnection();
        $input = Security::getJsonInput();

        // Calculate next correlative
        $stmt = $pdo->query("SELECT codigo FROM hojas_manuales");
        $all = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $maxNum = 0;
        foreach ($all as $c) {
            if (preg_match('/LN\d*-(\d+)/i', $c, $m)) {
                $num = (int)$m[1];
                if ($num > $maxNum) $maxNum = $num;
            }
        }
        $autoCode = 'LN1-' . str_pad((string)($maxNum + 1), 3, '0', STR_PAD_LEFT);

        $codigo = Security::sanitizeString($input['codigo'] ?? $autoCode);
        $fecha = Security::sanitizeString($input['fecha'] ?? date('Y-m-d'));
        $nrc = Security::sanitizeString($input['nrc'] ?? '');
        $docente = Security::sanitizeString($input['docente'] ?? '');
        $curso = Security::sanitizeString($input['curso'] ?? '');
        $carrera = Security::sanitizeString($input['carrera'] ?? '');
        $motivo = Security::sanitizeString($input['motivo'] ?? 'DOCENTE SIN ACCESOS');
        $asistente = Security::sanitizeString($input['asistente'] ?? 'Operaciones');
        $id = 'manual_new_' . round(microtime(true) * 1000);
        $now = date('Y-m-d H:i:s');

        $sql = "INSERT INTO hojas_manuales (
            id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $ins = $pdo->prepare($sql);
        $ins->execute([
            $id, '2026-2', $codigo, $fecha, $nrc, $docente, $curso, $carrera, $motivo, $asistente, $now
        ]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'data' => [
                'id' => $id,
                'periodo' => '2026-2',
                'codigo' => $codigo,
                'fecha' => $fecha,
                'nrc' => $nrc,
                'docente' => $docente,
                'curso' => $curso,
                'carrera' => $carrera,
                'motivo' => $motivo,
                'asistente' => $asistente,
                'created_at' => $now
            ]
        ], JSON_UNESCAPED_UNICODE);
    }
}

