import React, { useState } from 'react';
import {
  RotateCw,
  Download,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Layers,
  Zap,
  Check
} from 'lucide-react';
import { triggerDirectApkInstall, AppInstaller, APP_CURRENT_VERSION } from '../utils/appUpdateChecker';
import { isCapacitorNative } from '../utils/statusBarHelper';
import { useFadeModal } from '../utils/useFadeModal';

export default function AppUpdateModal({ updateInfo, onClose }) {
  const isAvailable = Boolean(isCapacitorNative() && updateInfo && updateInfo.isAvailable);
  const fade = useFadeModal(isAvailable ? updateInfo : null, onClose, 220);
  const rawInfo = (fade.cachedData && typeof fade.cachedData === 'object') ? fade.cachedData : (updateInfo && typeof updateInfo === 'object' ? updateInfo : {});

  // Extraer versiones con respaldo garantizado
  const currentVer = rawInfo.currentVersion || APP_CURRENT_VERSION || '1.0.0';
  const latestVer = rawInfo.latestVersion || rawInfo.version || currentVer;
  const infoNotes = rawInfo.notes || 'Mejoras de rendimiento y estabilidad.';
  const isForceUpdate = Boolean(rawInfo.forceUpdate);
  const targetApkUrl = rawInfo.apkUrl || 'https://control-doc.pages.dev/control-doc.apk';

  // Extraer lista detallada de novedades
  const detailedFeatures = Array.isArray(rawInfo.features) && rawInfo.features.length > 0
    ? rawInfo.features
    : Array.isArray(rawInfo.changes) && rawInfo.changes.length > 0
      ? rawInfo.changes
      : typeof rawInfo.notes === 'string' && (rawInfo.notes.includes('\n') || rawInfo.notes.includes('•') || rawInfo.notes.includes(';'))
        ? rawInfo.notes.split(/\n|•|;/).map(s => s.trim()).filter(Boolean).map(text => ({ title: '', desc: text }))
        : null;

  const [downloading, setDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [progress, setProgress] = useState(0);

  // El popup de actualización SOLO se debe mostrar en la app nativa (APK Android)
  if (!isCapacitorNative() || !fade.shouldRender) return null;

  const handleUpdate = async () => {
    if (progress >= 100) {
      try {
        if (AppInstaller?.launchInstaller) {
          await AppInstaller.launchInstaller();
          return;
        }
      } catch (err) {
        console.warn('Reintentando instalación directa:', err);
      }
    }

    setDownloading(true);
    setProgress(5);
    setDownloadStarted(true);
    const apkUrl = targetApkUrl;

    try {
      await triggerDirectApkInstall(apkUrl, (data) => {
        if (data && typeof data.percent === 'number') {
          setProgress(Math.max(5, Math.min(100, data.percent)));
        }
      });
    } catch (err) {
      console.error('Error starting update installation:', err);
      setDownloading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none ${fade.backdropClass}`}
      onClick={() => {
        if (!isForceUpdate && !downloading) fade.requestClose();
      }}
    >
      <div
        className={`bg-white dark:bg-[#0c0c10] border-2 border-amber-400 dark:border-amber-500/80 rounded-3xl p-4 sm:p-5 max-w-md w-full shadow-[0_16px_50px_rgba(253,186,48,0.3)] space-y-3.5 max-h-[92vh] flex flex-col ${fade.modalClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Compacto */}
        <div className="flex items-start justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FDBA30] to-amber-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
              <RotateCw className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-md border border-amber-300/80 dark:border-amber-700/60 inline-block mb-0.5">
                Actualización Disponible
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                Control Docente v{latestVer}
              </h2>
            </div>
          </div>

          {!isForceUpdate && (
            <button
              type="button"
              onClick={() => fade.requestClose()}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
              title="Cerrar"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          )}
        </div>

        {/* Comparación Visual de Versión: Anterior (Instalada) -> Siguiente (Disponible) */}
        <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900/90 p-3 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs shrink-0">
          {/* Versión Anterior */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500"></span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Instalada
              </span>
            </div>
            <div className="font-mono font-black text-slate-800 dark:text-zinc-200 text-sm truncate">
              v{currentVer}
            </div>
          </div>

          {/* Flecha Central con Conector */}
          <div className="w-8 h-8 rounded-full bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-2xs">
            <ArrowRight className="w-4 h-4 stroke-[2.6]" />
          </div>

          {/* Versión Siguiente */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Disponible
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm truncate">
              v{latestVer}
            </div>
          </div>
        </div>

        {/* Novedades Detalladas del Cambio (Scrollable Elegante) */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Novedades & Mejoras de esta versión</span>
            </div>
            {detailedFeatures && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                {detailedFeatures.length} cambios
              </span>
            )}
          </div>

          <div className="overflow-y-auto space-y-2 pr-1.5 max-h-52 custom-scrollbar">
            {detailedFeatures && detailedFeatures.length > 0 ? (
              detailedFeatures.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2 rounded-xl bg-white/80 dark:bg-zinc-900/70 border border-amber-200/50 dark:border-zinc-800/80 shadow-2xs"
                >
                  <div className="w-5 h-5 rounded-lg bg-amber-500/15 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-500/25">
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.4]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {item.title && (
                      <h4 className="text-[11.5px] font-bold text-slate-900 dark:text-zinc-100 leading-snug">
                        {item.title}
                      </h4>
                    )}
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed break-words">
                      {item.desc || item}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-700 dark:text-zinc-300 leading-relaxed break-words">
                {infoNotes}
              </p>
            )}
          </div>
        </div>

        {/* Barra de Progreso de Descarga en Vivo (100% Amarillo UPN de la App) */}
        {downloadStarted && (
          <div className="space-y-2 p-3 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-[#FDBA30]/40 dark:border-[#FDBA30]/30 shadow-2xs shrink-0">
            <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200">
              <span className="inline-flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-[#d99000] dark:text-[#FDBA30] shrink-0 stroke-[2.2]" />
                {progress >= 100 ? 'Iniciando instalador...' : 'Descargando paquete...'}
              </span>
              <span className="font-mono font-black text-[#b37700] dark:text-[#FDBA30]">{progress}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-amber-200/60 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-[#FDBA30] transition-all duration-200 rounded-full shadow-sm shadow-[#FDBA30]/40"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10.5px] text-amber-900/80 dark:text-amber-300/80 leading-tight font-medium">
              {progress >= 100
                ? 'Listo. Confirma la instalación en la ventana de Android.'
                : 'Descarga en curso. El instalador se abrirá automáticamente.'}
            </p>
          </div>
        )}

        {/* Botón Principal de Actualización Directa */}
        <div className="pt-0.5 shrink-0">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={downloading && progress < 100}
            className="w-full h-11 px-4 rounded-2xl bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 font-black text-xs tracking-tight transition active:scale-95 shadow-md shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {downloading && progress < 100 ? (
              <>
                <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
                <span>Descargando ({progress}%)...</span>
              </>
            ) : progress >= 100 ? (
              <>
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Abrir Instalador de Android</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Actualizar Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
