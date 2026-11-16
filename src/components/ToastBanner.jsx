import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, Copy } from 'lucide-react';
import { useFadeModal } from '../utils/useFadeModal';

export default function ToastBanner({ message, type = 'info', onClose, duration = 3200 }) {
  const toastFade = useFadeModal(message, onClose, 250);
  const activeMessage = typeof toastFade.cachedData === 'string' ? toastFade.cachedData : (typeof message === 'string' ? message : '');

  // Auto-cierre suave con animación fade si el componente padre no maneja temporizador
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      toastFade.requestClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, toastFade.requestClose]);

  if (!toastFade.shouldRender || !activeMessage || typeof document === 'undefined') return null;

  // Determine icon based on message content or explicit type
  const renderIcon = () => {
    if (activeMessage.includes('✅') || type === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.4]" />;
    }
    if (activeMessage.includes('⚠️') || type === 'warning') {
      return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 stroke-[2.4]" />;
    }
    if (activeMessage.includes('❌') || type === 'error') {
      return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 stroke-[2.4]" />;
    }
    if (activeMessage.includes('📋') || activeMessage.includes('copiad')) {
      return <Copy className="w-4 h-4 text-amber-400 shrink-0 stroke-[2.4]" />;
    }
    return <Info className="w-4 h-4 text-amber-400 shrink-0 stroke-[2.4]" />;
  };

  // Strip emojis from message text if we're rendering our own SVG icon to prevent duplicate icons
  const cleanMessage = activeMessage.replace(/^[✅⚠️❌📋🏃↺\s]+/, '').trim();

  return createPortal(
    <div 
      role="status"
      aria-live="polite"
      className={`fixed top-[calc(env(safe-area-inset-top,0px)+4.75rem)] sm:top-20 inset-x-0 mx-auto z-[999999] w-[calc(100%-1.5rem)] max-w-md pointer-events-none select-none px-2 transition-all ${toastFade.slideDownClass}`}
    >
      <div 
        className="pointer-events-auto text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl border border-white/25 dark:border-amber-400/40 shadow-[0_12px_40px_rgba(0,0,0,0.35)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7)] flex items-center justify-between gap-3 subpixel-antialiased"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)'
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {renderIcon()}
          <span className="break-words leading-tight text-slate-100 dark:text-zinc-100 tracking-tight">
            {cleanMessage || activeMessage}
          </span>
        </div>
        <button
          type="button"
          onClick={() => toastFade.requestClose()}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 dark:hover:bg-zinc-800 transition shrink-0 active:scale-90"
          title="Cerrar notificación"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>,
    document.body
  );
}

