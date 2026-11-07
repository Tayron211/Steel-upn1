<?php
/**
 * AttendanceController.php - Manejo Seguro de Asistencia Docente
 */

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class AttendanceController {
    public static function list(): void {
        $pdo = Database::getConnection();

        $dia = isset($_GET['dia']) ? Security::normalizeDay($_GET['dia']) : '';
        $pabellon = isset($_GET['pabellon']) ? strtoupper(trim($_GET['pabellon'])) : '';
        $piso = isset($_GET['piso']) ? strtoupper(trim($_GET['piso'])) : '';
        $hora = isset($_GET['hora']) ? trim($_GET['hora']) : '';
        $horaDesde = isset($_GET['hora_desde']) ? trim($_GET['hora_desde']) : '';
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';

        $sql = "SELECT * FROM asistencia WHERE 1=1";
        $params = [];

        if (!empty($dia)) {
            $sql .= " AND UPPER(dia) = ?";
            $params[] = $dia;
        }

        if (!empty($pabellon)) {
            $sql .= " AND (UPPER(piso_pabellon) LIKE ? OR UPPER(aula) LIKE ?)";
            $params[] = "%- {$pabellon}%";
            $params[] = "{$pabellon}%";
        }

        if (!empty($piso)) {
            if (str_contains($piso, 'SOT') || str_contains($piso, 'SÓT')) {
                $sql .= " AND (UPPER(piso_pabellon) LIKE '%SOTANO%' OR UPPER(piso_pabellon) LIKE '%SÓTANO%')";
            } else {
                $sql .= " AND UPPER(piso_pabellon) LIKE ?";
                $params[] = "%{$piso}%";
            }
        }

        if (!empty($hora)) {
            $sql .= " AND hora_inicio_prog = ?";
            $params[] = $hora;
        } elseif (!empty($horaDesde)) {
            $sql .= " AND hora_inicio_prog >= ?";
            $params[] = $horaDesde;
        }

        if (!empty($search)) {
            $sql .= " AND (LOWER(docente) LIKE ? OR LOWER(curso) LIKE ? OR LOWER(aula) LIKE ? OR LOWER(carrera) LIKE ? OR nrc LIKE ?)";
            $s = '%' . strtolower($search) . '%';
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
        }

        $sql .= " ORDER BY aula ASC, hora_inicio_prog ASC";

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

    public static function update(string $id): void {
        $pdo = Database::getConnection();
        $input = Security::getJsonInput();

        $fields = [];
        $params = [];

        if (isset($input['asistencia'])) {
            $fields[] = "asistencia = ?";
            $params[] = Security::validateInWhitelist($input['asistencia'], ['SI', 'NO', 'SI (DOCENTE DE REEMPLAZO)', 'PENDIENTE'], 'PENDIENTE');
        }

        if (isset($input['puntualidad'])) {
            $fields[] = "puntualidad = ?";
            $params[] = Security::validateInWhitelist($input['puntualidad'], ['PUNTUAL', 'TARDE', '-'], '-');
        }

        if (isset($input['horaInicioReal'])) {
            $fields[] = "hora_inicio_real = ?";
            $params[] = Security::sanitizeString($input['horaInicioReal']);
        }

        if (isset($input['horaFinalReal'])) {
            $fields[] = "hora_final_real = ?";
            $params[] = Security::sanitizeString($input['horaFinalReal']);
        }

        if (isset($input['observacion'])) {
            $fields[] = "observacion = ?";
            $params[] = Security::sanitizeString($input['observacion']);
        }

        if (isset($input['docente'])) {
            $fields[] = "docente = ?";
            $params[] = Security::sanitizeString($input['docente']);
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'No hay campos para actualizar']);
            return;
        }

        $fields[] = "updated_at = ?";
        $params[] = date('Y-m-d H:i:s');

        $params[] = $id;

        $sql = "UPDATE asistencia SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $check = $pdo->prepare("SELECT * FROM asistencia WHERE id = ?");
        $check->execute([$id]);
        $row = $check->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Registro no encontrado']);
            return;
        }

        echo json_encode([
            'success' => true,
            'data' => self::mapRow($row)
        ], JSON_UNESCAPED_UNICODE);
    }

    public static function bulk(): void {
        $pdo = Database::getConnection();
        $input = Security::getJsonInput();

        $ids = $input['ids'] ?? [];
        $updates = $input['updates'] ?? [];

        if (!is_array($ids) || empty($ids) || empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Parámetros inválidos']);
            return;
        }

        $asistencia = Security::validateInWhitelist($updates['asistencia'] ?? 'SI', ['SI', 'NO', 'SI (DOCENTE DE REEMPLAZO)'], 'SI');
        $puntualidad = Security::validateInWhitelist($updates['puntualidad'] ?? 'PUNTUAL', ['PUNTUAL', 'TARDE', '-'], 'PUNTUAL');
        $horaReal = Security::sanitizeString($updates['horaInicioReal'] ?? date('H:i'));
        $now = date('Y-m-d H:i:s');

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "UPDATE asistencia SET asistencia = ?, puntualidad = ?, hora_inicio_real = ?, updated_at = ? WHERE id IN ($placeholders)";

        $stmt = $pdo->prepare($sql);
        $params = array_merge([$asistencia, $puntualidad, $horaReal, $now], $ids);
        $stmt->execute($params);

        echo json_encode([
            'success' => true,
            'updatedCount' => $stmt->rowCount()
        ]);
    }

    private static function mapRow(array $r): array {
        return [
            'id' => $r['id'],
            'pisoPabellon' => $r['piso_pabellon'],
            'sede' => $r['sede'],
            'periodo' => $r['periodo'],
            'dia' => $r['dia'],
            'horaInicioProg' => $r['hora_inicio_prog'],
            'horaFinalProg' => $r['hora_final_prog'],
            'aula' => $r['aula'],
            'nrc' => $r['nrc'],
            'listaCruzada' => $r['lista_cruzada'],
            'codigoDocente' => $r['codigo_docente'],
            'docente' => $r['docente'],
            'curso' => $r['curso'],
            'carrera' => $r['carrera'],
            'horaInicioReal' => $r['hora_inicio_real'],
            'horaFinalReal' => $r['hora_final_real'],
            'asistencia' => $r['asistencia'],
            'puntualidad' => $r['puntualidad'],
            'observacion' => $r['observacion'],
            'real' => $r['real_horas'],
            'ciclo' => $r['ciclo']
        ];
    }
}

