<?php
/**
 * DashboardController.php - Métricas y KPIs Ejecutivos
 */

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Security.php';

class DashboardController {
    public static function stats(): void {
        $pdo = Database::getConnection();

        $days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
        $todayName = $days[(int)date('w')];
        $dia = isset($_GET['dia']) ? Security::normalizeDay($_GET['dia']) : $todayName;

        $stmt = $pdo->prepare("SELECT * FROM asistencia WHERE UPPER(dia) = ?");
        $stmt->execute([$dia]);
        $classes = $stmt->fetchAll();

        $totalClasses = count($classes);
        $puntual = 0;
        $tarde = 0;
        $falta = 0;
        $reemplazo = 0;
        $pendientes = 0;

        foreach ($classes as $c) {
            $p = strtoupper($c['puntualidad'] ?? '');
            $a = strtoupper($c['asistencia'] ?? '');

            if ($p === 'PUNTUAL') $puntual++;
            elseif ($p === 'TARDE') $tarde++;
            elseif ($a === 'NO') $falta++;
            elseif (str_contains($a, 'REEMPLAZO')) $reemplazo++;
            else $pendientes++;
        }

        $totalAsistieron = $puntual + $tarde + $reemplazo;
        $pctAsistencia = $totalClasses > 0 ? round(($totalAsistieron / $totalClasses) * 100) : 0;

        $tStmt = $pdo->query("SELECT estado, tipo_solicitud FROM tickets");
        $tickets = $tStmt->fetchAll();

        $ticketsPendientes = 0;
        $ticketsEnProceso = 0;
        $ticketsAtendidos = 0;
        $categoryCounts = [];

        foreach ($tickets as $t) {
            $est = strtoupper($t['estado'] ?? '');
            if ($est === 'PENDIENTE') $ticketsPendientes++;
            elseif ($est === 'EN PROCESO') $ticketsEnProceso++;
            elseif ($est === 'ATENDIDO') $ticketsAtendidos++;

            $cat = trim($t['tipo_solicitud'] ?? 'Otros');
            if (empty($cat)) $cat = 'Otros';
            $categoryCounts[$cat] = ($categoryCounts[$cat] ?? 0) + 1;
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'dia' => $dia,
                'totalClasses' => $totalClasses,
                'puntual' => $puntual,
                'tarde' => $tarde,
                'falta' => $falta,
                'reemplazo' => $reemplazo,
                'pendientes' => $pendientes,
                'pctAsistencia' => $pctAsistencia,
                'ticketsPendientes' => $ticketsPendientes,
                'ticketsEnProceso' => $ticketsEnProceso,
                'ticketsAtendidos' => $ticketsAtendidos,
                'categoryCounts' => $categoryCounts
            ]
        ], JSON_UNESCAPED_UNICODE);
    }
}

