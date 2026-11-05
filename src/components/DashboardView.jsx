import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Wrench,
  Flame,
  Award,
  Calendar,
  Download,
  RotateCw,
  Database,
  FileSpreadsheet
} from 'lucide-react';

export default function DashboardView() {
  const daysOfWeek = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const todayDefault = daysOfWeek[new Date().getDay()];

  const [selectedDia, setSelectedDia] = useState(todayDefault);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?dia=${selectedDia}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Silent background refresh for multi-user real-time state
  const silentRefreshStats = async () => {
    try {
      const res = await fetch(`/api/dashboard?dia=${selectedDia}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(silentRefreshStats, 5000);
    return () => clearInterval(interval);
  }, [selectedDia]);

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/sync-excel', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncMessage(json.data.message || 'Sincronización completada exitosamente.');
        silentRefreshStats();
        setTimeout(() => setSyncMessage(''), 5000);
      }
    } catch (err) {
      console.error(err);
      setSyncMessage('Error al sincronizar con el archivo Excel.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="text-center py-20 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Calculando indicadores clave desde SQLite...</p>
      </div>
    );
  }

  if (!stats) return null;

  const {
    totalClasses,
    puntual,
    tarde,
    falta,
    reemplazo,
    pendientes,
    pctAsistencia,
    ticketsPendientes,
    ticketsEnProceso,
    ticketsAtendidos,
    categoryCounts
  } = stats;

  const totalAsistieron = puntual + tarde + reemplazo;

  const sortedCategories = Object.entries(categoryCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Top Banner - Light Minimalist */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Analítica & Cumplimiento</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard de Rendimiento</h1>
          </div>

          <div className="grid grid-cols-7 gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl w-full sm:w-auto">
            {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map((d) => {
              const isSelected = selectedDia === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDia(d)}
                  className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 text-center flex items-center justify-center active:scale-95 ${isSelected
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {d === 'MIERCOLES' ? 'MIÉ' : d === 'SABADO' ? 'SÁB' : d === 'DOMINGO' ? 'DOM' : d.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* % Asistencia */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tight mb-1">
            % ASISTENCIA DOCENTE
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {pctAsistencia}%
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block font-medium">
            {totalAsistieron} de {totalClasses} sesiones
          </span>
        </div>

        {/* Puntuales */}
        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight mb-1">
            PUNTUALES
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-900 dark:text-emerald-300">
            {puntual}
          </div>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 block font-medium">
            A tiempo al inicio de clase
          </span>
        </div>

        {/* Incidencias */}
        <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight mb-1">
            TARDE / FALTA
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-baseline gap-1.5">
            <span className="text-amber-700 dark:text-amber-400">{tarde}</span>
            <span className="text-slate-300 dark:text-zinc-600 font-normal">/</span>
            <span className="text-rose-600 dark:text-rose-400">{falta}</span>
          </div>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5 block font-medium">
            {reemplazo} con docente suplente
          </span>
        </div>

        {/* Préstamos de Material */}
        <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-tight mb-1">
            PRÉSTAMOS DE MATERIAL
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-950 dark:text-amber-300">
            {ticketsPendientes + ticketsEnProceso} <span className="text-xs font-semibold text-amber-800/80 dark:text-amber-400/80">activos</span>
          </div>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5 block font-medium">
            {ticketsAtendidos} devueltos y archivados
          </span>
        </div>
      </div>

      {/* Progress Breakdown Bar */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">
          Distribución de Estados del Día ({selectedDia})
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3.5">
          Composición de los {totalClasses} bloques de clase programados en la sede.
        </p>

        {totalClasses > 0 ? (
          <div>
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
              <div style={{ width: `${(puntual / totalClasses) * 100}%` }} className="bg-emerald-500" title={`Puntual: ${puntual}`} />
              <div style={{ width: `${(tarde / totalClasses) * 100}%` }} className="bg-amber-500" title={`Tarde: ${tarde}`} />
              <div style={{ width: `${(reemplazo / totalClasses) * 100}%` }} className="bg-purple-500" title={`Suplente: ${reemplazo}`} />
              <div style={{ width: `${(falta / totalClasses) * 100}%` }} className="bg-rose-500" title={`Falta: ${falta}`} />
              <div style={{ width: `${(pendientes / totalClasses) * 100}%` }} className="bg-slate-300 dark:bg-zinc-700" title={`Pendientes: ${pendientes}`} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold mt-3.5">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Puntual ({puntual})
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Tarde ({tarde})
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Falta ({falta})
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Suplente ({reemplazo})
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-700"></span> Pendientes ({pendientes})
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-zinc-500">No hay clases registradas para este día.</p>
        )}
      </div>

      {/* Top Requerimientos y Materiales */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">
          Top Requerimientos y Préstamos en Aula
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
          Frecuencia de materiales (plumones, motas), cables HDMI, periféricos y asistencia en Sede Comas.
        </p>

        <div className="space-y-3">
          {sortedCategories.map(([catName, count], idx) => {
            const maxVal = sortedCategories[0][1] || 1;
            const pct = Math.round((count / maxVal) * 100);
            return (
              <div key={catName}>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  <span className="pr-2 font-semibold text-slate-800 dark:text-zinc-200 break-words leading-tight">{catName}</span>
                  <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px] shrink-0 font-semibold">{count} préstamos</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-800">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-amber-500' :
                        idx === 1 ? 'bg-blue-500' :
                          idx === 2 ? 'bg-emerald-500' :
                            'bg-slate-400 dark:bg-zinc-600'
                      }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sincronización & Respaldo de Datos (Desplazado al final del Dashboard) */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Base de Datos SQLite & Excel Maestro
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Sincronización y Exportación
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Sincroniza cambios desde CONTROL DOCENTE.xlsx preservando asistencias o descarga una copia actualizada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition-all active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 stroke-[2.2] ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Auto-Sync con Excel'}</span>
            </button>

            <a
              href="/api/export-excel"
              target="_blank"
              rel="noopener noreferrer"
              className="h-10 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white shadow-xs transition-all active:scale-95 inline-flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 stroke-[2.2]" />
              <span>Exportar Excel</span>
            </a>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-3 text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 px-3.5 py-2 rounded-xl font-medium animate-in fade-in">
            {syncMessage}
          </div>
        )}
      </div>
    </div>
  );
}
