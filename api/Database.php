<?php
/**
 * Database.php - Conexión PDO SQLite con Alta Seguridad
 */

class Database {
    private static ?PDO $instance = null;
    private static string $dbPath = '';

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            self::$dbPath = __DIR__ . '/../server/data/controldocente.sqlite';
            $dir = dirname(self::$dbPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            try {
                self::$instance = new PDO('sqlite:' . self::$dbPath);
                self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                self::$instance->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
                
                // Security & Performance PRAGMAs
                self::$instance->exec('PRAGMA foreign_keys = ON;');
                self::$instance->exec('PRAGMA journal_mode = WAL;');
                self::$instance->exec('PRAGMA synchronous = NORMAL;');
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Error de conexión a la base de datos segura.'
                ]);
                exit;
            }
        }
        return self::$instance;
    }

    public static function getDbPath(): string {
        return self::$dbPath;
    }
}

