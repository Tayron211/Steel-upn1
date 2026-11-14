import React, { useState } from 'react';
import { 
  Rocket, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  X, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { isCapacitorNative } from '../utils/statusBarHelper';

export default function AppUpdateModal({ updateInfo, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);

  if (!updateInfo || !updateInfo.isAvailable) return null;

  const handleUpdate = () => {
    setDownloading(true);
    const apkUrl = updateInfo.apkUrl || 'https://control-doc.pages.dev/control-doc.apk';

    try {
      // In Android Native / Capacitor: use system browser or direct download anchor
      const link = document.createElement('a');
      link.href = apkUrl;
      link.setAttribute('download', 'control-doc.apk');
      link.setAttribute('target', '_system');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadStarted(true);
    } catch (err) {
      console.warn('Fallback opening APK URL:', err);
      window.open(apkUrl, '_blank');
      setDownloadStarted(true);
    } finally {
      setTimeout(() => {
        setDownloading(false);
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-white dark:bg-[#0d0d12] border-2 border-amber-400/80 dark:border-amber-500/60 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-[0_20px_60px_rgba(253,186,48,0.25)] space-y-4 animate-scale-up">
        {/* Header con Icono Animado */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FDBA30] to-amber-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Rocket className="w-6 h-6 stroke-[2.4] animate-bounce-short" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700/60">
                  Actualización Disponible
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                Nueva Versión {updateInfo.latestVersion}
              </h2>
            </div>
          </div>

          {!updateInfo.forceUpdate && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              title="Cerrar"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}
        </div>

        {/* Comparación de Versiones */}
        <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-900/80 p-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800">
          <div>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Tu versión</span>
            <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">
              v{updateInfo.currentVersion} (Build {updateInfo.currentBuild})
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-500 shrink-0 stroke-[2.5]" />
          <div className="text-right">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-extrabold block">Nueva versión</span>
            <span className="font-mono font-black text-slate-950 dark:text-emerald-300">
              v{updateInfo.latestVersion} (Build {updateInfo.latestBuild})
            </span>
          </div>
        </div>

        {/* Novedades y Notas de la Versión */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 stroke-[2.2]" />
            <span>Novedades y Mejoras:</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed max-h-36 overflow-y-auto">
            {updateInfo.notes}
          </div>
        </div>

        {/* Guía de instalación rápida en Android */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            {downloadStarted
              ? '📥 Descarga en curso. Abre la notificación en tu teléfono y pulsa "Instalar" para actualizar sin restricciones.'
              : 'Actualización segura directa. No perderás ningún dato ni configuración guardada.'}
          </span>
        </div>

        {/* Botones de Acción */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleUpdate}
            disabled={downloading}
            className="w-full py-3 px-4 rounded-2xl bg-[#FDBA30] hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-tight transition active:scale-95 shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Iniciando descarga...</span>
              </>
            ) : downloadStarted ? (
              <>
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>Volver a Descargar APK</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Aceptar y Actualizar Ahora</span>
              </>
            )}
          </button>

          {!updateInfo.forceUpdate && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-center text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
            >
              Recordar más tarde
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
