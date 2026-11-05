<?php
/**
 * ReservationsController.php - Reservas de Ambientes
 */

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class ReservationsController {
    public static function list(): void {
        $pdo = Database::getConnection();

        $dia = isset($_GET['dia']) ? Security::normalizeDay($_GET['dia']) : '';
        $aula = isset($_GET['aula']) ? strtoupper(trim($_GET['aula'])) : '';
        $fecha = isset($_GET['fecha']) ? trim($_GET['fecha']) : '';
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $sql = "SELECT * FROM reservas WHERE 1=1";
        $params = [];

        if (!empty($dia)) {
            $sql .= " AND UPPER(dia) = ?";
            $params[] = $dia;
        }

        if (!empty($aula)) {
            $sql .= " AND UPPER(aula) LIKE ?";
            $params[] = "%{$aula}%";
        }

        if (!empty($fecha)) {
            $sql .= " AND fecha = ?";
            $params[] = $fecha;
        }

        if (!empty($search)) {
            $sql .= " AND (LOWER(aula) LIKE ? OR LOWER(docente) LIKE ? OR LOWER(detalle) LIKE ?)";
            $s = '%' . strtolower($search) . '%';
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $sql .= " ORDER BY fecha DESC, inicio ASC";

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

        $id = 'reserva_new_' . round(microtime(true) * 1000);
        $fecha = Security::sanitizeString($input['fecha'] ?? date('Y-m-d'));
        $mes = Security::sanitizeString($input['mes'] ?? '');
        $dia = Security::normalizeDay($input['dia'] ?? '');
        $inicio = Security::sanitizeString($input['inicio'] ?? '08:00');
        $final = Security::sanitizeString($input['final'] ?? '10:00');
        $aula = strtoupper(Security::sanitizeString($input['aula'] ?? ''));
        $ubicacion = Security::sanitizeString($input['ubicacion'] ?? '');
        $docente = Security::sanitizeString($input['docente'] ?? '');
        $detalle = Security::sanitizeString($input['detalle'] ?? '');
        $usuario = Security::sanitizeString($input['usuario'] ?? 'Operador');
        $prioridad = Security::validateInWhitelist($input['prioridad'] ?? 'NORMAL', ['NORMAL', 'IMPORTANTE'], 'NORMAL');
        $now = date('Y-m-d H:i:s');

        $sql = "INSERT INTO reservas (
            id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, usuario, prioridad, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $id, $fecha, $mes, $dia, $inicio, $final, $aula, $ubicacion, $docente, $detalle, $usuario, $prioridad, $now
        ]);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'data' => [
                'id' => $id,
                'fecha' => $fecha,
                'mes' => $mes,
                'dia' => $dia,
                'inicio' => $inicio,
                'final' => $final,
                'aula' => $aula,
                'ubicacion' => $ubicacion,
                'docente' => $docente,
                'detalle' => $detalle,
                'usuario' => $usuario,
                'prioridad' => $prioridad,
                'created_at' => $now
            ]
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function delete(string $id): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM reservas WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(['success' => $stmt->rowCount() > 0]);
    }
}

