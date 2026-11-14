import React, { useState } from 'react';
import {
  RotateCw,
  Download,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { triggerDirectApkInstall, AppInstaller } from '../utils/appUpdateChecker';
import { isCapacitorNative } from '../utils/statusBarHelper';
import { useFadeModal } from '../utils/useFadeModal';

export default function AppUpdateModal({ updateInfo, onClose }) {
  const isAvailable = Boolean(isCapacitorNative() && updateInfo && updateInfo.isAvailable);
  const fade = useFadeModal(isAvailable, onClose, 220);
  const info = fade.cachedData || updateInfo;

  const [downloading, setDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [progress, setProgress] = useState(0);

  // El popup de actualización SOLO se debe mostrar en la app nativa (APK Android)
  if (!isCapacitorNative() || !fade.shouldRender || !info) return null;

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
    const apkUrl = info.apkUrl || 'https://control-doc.pages.dev/control-doc.apk';

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
      className={`fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none ${fade.backdropClass}`}
      onClick={() => {
        if (!info.forceUpdate && !downloading) fade.requestClose();
      }}
    >
      <div
        className={`bg-white dark:bg-[#0c0c10] border-2 border-amber-400 dark:border-amber-500/80 rounded-3xl p-4 sm:p-5 max-w-sm w-full shadow-[0_16px_50px_rgba(253,186,48,0.3)] space-y-3.5 ${fade.modalClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Compacto */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FDBA30] to-amber-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
              <RotateCw className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-md border border-amber-300/80 dark:border-amber-700/60 inline-block mb-0.5">
                Actualización Disponible
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                Control Docente v{info.latestVersion}
              </h2>
            </div>
          </div>

          {!info.forceUpdate && (
            <button
              type="button"
              onClick={() => fade.requestClose()}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          )}
        </div>

        {/* Comparación Visual con Flecha Central: Anterior (Instalada) -> Siguiente (Disponible) */}
        <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-zinc-900/90 p-3 rounded-2xl border border-slate-200/90 dark:border-zinc-800 shadow-2xs">
          {/* Versión y Compilación Anterior */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-zinc-500"></span>
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Instalada
              </span>
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-zinc-200 text-xs truncate">
              v{info.currentVersion || '1.0.0'}
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
              Compilación <span className="font-bold text-slate-700 dark:text-zinc-300">#{info.currentBuild || 1}</span>
            </div>
          </div>

          {/* Flecha Central con Conector */}
          <div className="w-8 h-8 rounded-full bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-2xs">
            <ArrowRight className="w-4 h-4 stroke-[2.6]" />
          </div>

          {/* Versión y Compilación Siguiente */}
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Disponible
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs truncate">
              v{info.latestVersion}
            </div>
            <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              Compilación <span className="font-black text-emerald-700 dark:text-emerald-300">#{info.latestBuild}</span>
            </div>
          </div>
        </div>

        {/* Novedades del cambio */}
        {info.notes && (
          <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Novedades del cambio</span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-zinc-300 leading-relaxed break-words">
              {info.notes}
            </p>
          </div>
        )}

        {/* Barra de Progreso de Descarga en Vivo */}
        {downloadStarted && (
          <div className="space-y-2 p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-emerald-200">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {progress >= 100 ? 'Iniciando instalador...' : 'Descargando paquete...'}
              </span>
              <span className="font-mono font-black">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-emerald-200/70 dark:bg-emerald-900/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-[#FDBA30] transition-all duration-200 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10.5px] text-emerald-800 dark:text-emerald-300 leading-tight font-medium">
              {progress >= 100
                ? 'Listo. Confirma la instalación en la ventana de Android.'
                : 'Descarga en curso. El instalador se abrirá automáticamente.'}
            </p>
          </div>
        )}

        {/* Botón Principal de Actualización Directa */}
        <div className="pt-0.5">
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
