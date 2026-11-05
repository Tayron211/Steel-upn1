<?php
/**
 * Security.php - Middleware de Seguridad y Cabeceras HTTP
 */

class Security {
    public static function applyHeaders(): void {
        header('Content-Type: application/json; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

        // Handle CORS preflight
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }

    public static function sanitizeString(?string $str): string {
        if ($str === null) return '';
        $clean = trim($str);
        return htmlspecialchars($clean, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function validateInWhitelist(string $value, array $allowed, string $default = ''): string {
        $upper = strtoupper(trim($value));
        foreach ($allowed as $item) {
            if (strtoupper($item) === $upper) {
                return $item;
            }
        }
        return $default;
    }

    public static function getJsonInput(): array {
        $raw = file_get_contents('php://input');
        if (empty($raw)) return [];
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function normalizeDay(string $day): string {
        $day = strtoupper(trim($day));
        $unaccented = strtr($day, [
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
            'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U'
        ]);
        return $unaccented;
    }
}

