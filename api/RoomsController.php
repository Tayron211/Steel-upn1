<?php
/**
 * RoomsController.php - Directorio de Ambientes
 */

require_once __DIR__ . '/Database.php';

class RoomsController {
    public static function list(): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT * FROM ambientes ORDER BY pabellon ASC, abrv ASC");
        $rows = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'count' => count($rows),
            'data' => $rows
        ], JSON_UNESCAPED_UNICODE);
    }
}

