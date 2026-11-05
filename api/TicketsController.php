<?php
/**
 * TicketsController.php - Gestión de Mesa de Ayuda
 */

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class TicketsController {
    public static function list(): void {
        $pdo = Database::getConnection();

        $estado = isset($_GET['estado']) ? strtoupper(trim($_GET['estado'])) : '';
        $ambiente = isset($_GET['ambiente']) ? strtoupper(trim($_GET['ambiente'])) : '';
        $responsable = isset($_GET['responsable']) ? strtoupper(trim($_GET['responsable'])) : '';
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $sql = "SELECT * FROM tickets WHERE 1=1";
        $params = [];

        if (!empty($estado)) {
            $sql .= " AND estado = ?";
            $params[] = $estado;
        }

        if (!empty($ambiente)) {
            $sql .= " AND UPPER(ambiente) LIKE ?";
            $params[] = "%{$ambiente}%";
        }

        if (!empty($responsable)) {
            $sql .= " AND UPPER(responsable) LIKE ?";
            $params[] = "%{$responsable}%";
        }

        if (!empty($search)) {
            $sql .= " AND (LOWER(ambiente) LIKE ? OR LOWER(tipo_solicitud) LIKE ? OR LOWER(descripcion_solucion) LIKE ? OR LOWER(responsable) LIKE ?)";
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

        $data = array_map([self::class, 'mapRow'], $rows);

        echo json_encode([
            'success' => true,
            'count' => count($data),
            'data' => $data
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function create(): void {
        $pdo = Database::getConnection();
        $input = Security::getJsonInput();

        $ambiente = Security::sanitizeString($input['ambiente'] ?? '');
        $piso = Security::sanitizeString($input['piso'] ?? '');
        $pabellon = Security::sanitizeString($input['pabellon'] ?? (str_starts_with($ambiente, 'B') ? 'B' : 'A'));
        $tipoSolicitud = Security::sanitizeString($input['tipoSolicitud'] ?? 'Soporte General');
        $estado = Security::validateInWhitelist($input['estado'] ?? 'PENDIENTE', ['PENDIENTE', 'EN PROCESO', 'ATENDIDO'], 'PENDIENTE');
        $descripcion = Security::sanitizeString($input['descripcionSolucion'] ?? '');
        $responsable = Security::sanitizeString($input['responsable'] ?? 'Sin Asignar');

        $now = date('Y-m-d H:i:s');
        $timeNow = date('H:i');
        $dateNow = date('Y-m-d');
        $days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
        $diaNow = $days[(int)date('w')];

        $nextHour = ((int)date('H') + 1) % 24;
        $rango = date('H') . ':00 – ' . str_pad((string)$nextHour, 2, '0', STR_PAD_LEFT) . ':00';

        $id = 'ticket_new_' . round(microtime(true) * 1000);

        $sql = "INSERT INTO tickets (
            id, periodo, fecha, dia, hora_reporte, rango, ambiente, piso, pabellon,
            tipo_solicitud, estado, descripcion_solucion, responsable, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $id, '2026-2', $dateNow, $diaNow, $timeNow, $rango, $ambiente, $piso, $pabellon,
            $tipoSolicitud, $estado, $descripcion, $responsable, $now, $now
        ]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'data' => [
                'id' => $id,
                'periodo' => '2026-2',
                'fecha' => $dateNow,
                'dia' => $diaNow,
                'horaReporte' => $timeNow,
                'rango' => $rango,
                'ambiente' => $ambiente,
                'piso' => $piso,
                'pabellon' => $pabellon,
                'tipoSolicitud' => $tipoSolicitud,
                'estado' => $estado,
                'descripcionSolucion' => $descripcion,
                'responsable' => $responsable,
                'createdAt' => $now
            ]
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function update(string $id): void {
        $pdo = Database::getConnection();
        $input = Security::getJsonInput();

        $fields = [];
        $params = [];

        if (isset($input['estado'])) {
            $fields[] = "estado = ?";
            $params[] = Security::validateInWhitelist($input['estado'], ['PENDIENTE', 'EN PROCESO', 'ATENDIDO'], 'PENDIENTE');
        }

        if (isset($input['descripcionSolucion'])) {
            $fields[] = "descripcion_solucion = ?";
            $params[] = Security::sanitizeString($input['descripcionSolucion']);
        }

        if (isset($input['responsable'])) {
            $fields[] = "responsable = ?";
            $params[] = Security::sanitizeString($input['responsable']);
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No hay campos para actualizar']);
            return;
        }

        $fields[] = "updated_at = ?";
        $params[] = date('Y-m-d H:i:s');
        $params[] = $id;

        $sql = "UPDATE tickets SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $check = $pdo->prepare("SELECT * FROM tickets WHERE id = ?");
        $check->execute([$id]);
        $row = $check->fetch();

        echo json_encode([
            'success' => true,
            'data' => $row ? self::mapRow($row) : null
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function delete(string $id): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM tickets WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => $stmt->rowCount() > 0]);
    }

    private static function mapRow(array $r): array {
        return [
            'id' => $r['id'],
            'periodo' => $r['periodo'],
            'fecha' => $r['fecha'],
            'dia' => $r['dia'],
            'horaReporte' => $r['hora_reporte'],
            'rango' => $r['rango'],
            'ambiente' => $r['ambiente'],
            'piso' => $r['piso'],
            'pabellon' => $r['pabellon'],
            'tipoSolicitud' => $r['tipo_solicitud'],
            'estado' => $r['estado'],
            'descripcionSolucion' => $r['descripcion_solucion'],
            'responsable' => $r['responsable'],
            'createdAt' => $r['created_at']
        ];
    }
}

