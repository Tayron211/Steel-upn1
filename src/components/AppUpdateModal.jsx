import React, { useState } from 'react';
import {
  RotateCw,
  Download,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  RefreshCw
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
        className={`bg-white dark:bg-[#0c0c10] border-2 border-amber-400 dark:border-amber-500/80 rounded-2xl p-4 sm:p-5 max-w-sm w-full shadow-[0_16px_50px_rgba(253,186,48,0.3)] space-y-3.5 ${fade.modalClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Compacto */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FDBA30] to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <RotateCw className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md border border-amber-300/80 dark:border-amber-700/60">
                Actualización Lista
              </span>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5">
                Nueva Versión v{info.latestVersion}
              </h2>
            </div>
          </div>

          {!info.forceUpdate && (
            <button
              type="button"
              onClick={() => fade.requestClose()}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          )}
        </div>

        {/* Comparación Compacta de Versiones */}
        <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-zinc-900/80 px-3 py-2 rounded-xl border border-slate-200/80 dark:border-zinc-800">
          <div>
            <span className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Instalada</span>
            <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">
              v{info.currentVersion}
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0 stroke-[2.5]" />
          <div className="text-right">
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-extrabold block">Disponible</span>
            <span className="font-mono font-black text-slate-950 dark:text-emerald-300">
              v{info.latestVersion} (Build {info.latestBuild})
            </span>
          </div>
        </div>

        {/* Novedades breves */}
        <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-slate-700 dark:text-zinc-300 leading-snug line-clamp-3">
          {info.notes}
        </div>

        {/* Barra de Progreso de Descarga en Vivo */}
        {downloadStarted && (
          <div className="space-y-1.5 p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {progress >= 100 ? 'Abriendo instalador...' : 'Descargando paquete APK...'}
              </span>
              <span className="font-mono font-black">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-emerald-200/60 dark:bg-emerald-900/60 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 leading-tight">
              {progress >= 100
                ? 'Listo. Confirma la instalación en la ventana del sistema.'
                : 'La descarga se realiza en segundo plano y abrirá el paquete automáticamente.'}
            </p>
          </div>
        )}

        {/* Botón Principal de Actualización Directa */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={downloading && progress < 100}
            className="w-full h-10 px-4 rounded-xl bg-[#FDBA30] hover:bg-amber-400 text-slate-950 font-black text-xs tracking-tight transition active:scale-95 shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {downloading && progress < 100 ? (
              <>
                <RefreshCw className="w-4 h-4 text-slate-950 animate-spin" />
                <span>Descargando ({progress}%)...</span>
              </>
            ) : progress >= 100 ? (
              <>
                <Download className="w-4 h-4 stroke-[2.4]" />
                <span>Abrir Instalador de Android</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 stroke-[2.4]" />
                <span>Aceptar e Instalar Ahora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
