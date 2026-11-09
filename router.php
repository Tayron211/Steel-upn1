<?php
/**
 * router.php - Router Principal para PHP Built-in Server
 * Maneja rutas API, Auto-detección de cambios en CONTROL DOCENTE.xlsx y sirve el Frontend móvil
 */

require_once __DIR__ . '/api/Security.php';
require_once __DIR__ . '/api/Database.php';
require_once __DIR__ . '/api/ExcelSyncer.php';
require_once __DIR__ . '/api/AttendanceController.php';
require_once __DIR__ . '/api/TicketsController.php';
require_once __DIR__ . '/api/ManualSheetsController.php';
require_once __DIR__ . '/api/ReservationsController.php';
require_once __DIR__ . '/api/RoomsController.php';
require_once __DIR__ . '/api/DashboardController.php';

// Check for Excel updates on request
try {
    ExcelSyncer::checkAndSyncIfNeeded(false);
} catch (Exception $e) {
    // Silent failover to preserve availability
}

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Handle API Routes
if (str_starts_with($uri, '/api')) {
    Security::applyHeaders();

    // 1. Attendance
    if ($uri === '/api/attendance' && $method === 'GET') {
        AttendanceController::list();
        exit;
    }
    if ($uri === '/api/attendance/bulk' && $method === 'POST') {
        AttendanceController::bulk();
        exit;
    }
    if ($uri === '/api/attendance/clear-columns' && $method === 'POST') {
        AttendanceController::clearColumns();
        exit;
    }
    if (preg_match('#^/api/attendance/([^/]+)$#', $uri, $matches) && $method === 'PUT') {
        AttendanceController::update($matches[1]);
        exit;
    }

    // 2. Tickets
    if ($uri === '/api/tickets' && $method === 'GET') {
        TicketsController::list();
        exit;
    }
    if ($uri === '/api/tickets' && $method === 'POST') {
        TicketsController::create();
        exit;
    }
    if (preg_match('#^/api/tickets/([^/]+)$#', $uri, $matches)) {
        if ($method === 'PUT') {
            TicketsController::update($matches[1]);
            exit;
        }
        if ($method === 'DELETE') {
            TicketsController::delete($matches[1]);
            exit;
        }
    }

    // 3. Manual Sheets
    if ($uri === '/api/manual-sheets' && $method === 'GET') {
        ManualSheetsController::list();
        exit;
    }
    if ($uri === '/api/manual-sheets' && $method === 'POST') {
        ManualSheetsController::create();
        exit;
    }

    // 4. Reservations
    if ($uri === '/api/reservations' && $method === 'GET') {
        ReservationsController::list();
        exit;
    }
    if ($uri === '/api/reservations' && $method === 'POST') {
        ReservationsController::create();
        exit;
    }
    if (preg_match('#^/api/reservations/([^/]+)$#', $uri, $matches) && $method === 'DELETE') {
        ReservationsController::delete($matches[1]);
        exit;
    }

    // 5. Rooms
    if ($uri === '/api/rooms' && $method === 'GET') {
        RoomsController::list();
        exit;
    }

    // 6. Dashboard
    if ($uri === '/api/dashboard' && $method === 'GET') {
        DashboardController::stats();
        exit;
    }

    // 7. Force Sync Excel
    if ($uri === '/api/sync-excel' && $method === 'POST') {
        $result = ExcelSyncer::checkAndSyncIfNeeded(true);
        echo json_encode(['success' => true, 'data' => $result]);
        exit;
    }

    // 8. Export Excel (via Node generator or PHP)
    if ($uri === '/api/export-excel' && $method === 'GET') {
        // Generate via exporter
        $exportScript = __DIR__ . '/server/services/excelExporter.js';
        $dbData = shell_exec('node -e "const db = require(\'./server/database/sqliteService\'); db.getAllDataForExport().then(d => console.log(JSON.stringify(d)));"');
        
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="CONTROL_DOCENTE_EXPORTADO.xlsx"');
        
        $tmpFile = tempnam(sys_get_temp_dir(), 'export_') . '.xlsx';
        $cmd = 'node -e "const { exportToExcelBuffer } = require(\'./server/services/excelExporter\'); const fs = require(\'fs\'); const data = ' . json_encode(json_decode($dbData, true)) . '; fs.writeFileSync(' . json_encode($tmpFile) . ', exportToExcelBuffer(data));"';
        shell_exec($cmd);

        if (file_exists($tmpFile)) {
            readfile($tmpFile);
            unlink($tmpFile);
            exit;
        }
    }

    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Ruta API no encontrada']);
    exit;
}

// Static Files & SPA Fallback from dist/
$distDir = __DIR__ . '/dist';
$filePath = realpath($distDir . $uri);

// Prevent path traversal
if ($filePath && str_starts_with($filePath, realpath($distDir)) && is_file($filePath)) {
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimes = [
        'html' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'ico' => 'image/x-icon',
        'woff2' => 'font/woff2'
    ];
    $contentType = $mimes[$ext] ?? 'application/octet-stream';
    header("Content-Type: $contentType");
    readfile($filePath);
    exit;
}

// Fallback to dist/index.html for SPA routes
$indexFile = $distDir . '/index.html';
if (file_exists($indexFile)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexFile);
    exit;
}

echo "Control Docente - Servidor PHP Activo. Compila el frontend con 'npm run build'.";

