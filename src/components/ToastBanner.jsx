import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, Copy } from 'lucide-react';
import { useFadeModal } from '../utils/useFadeModal';

export default function ToastBanner({ message, type = 'info', onClose }) {
  const toastFade = useFadeModal(message, onClose, 200);
  const activeMessage = typeof toastFade.cachedData === 'string' ? toastFade.cachedData : message;

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
      className={`fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[999999] w-[92%] max-w-md pointer-events-none select-none px-2 ${toastFade.modalClass}`}
    >
      <div className="pointer-events-auto bg-slate-950/95 dark:bg-black/95 text-white text-xs sm:text-sm font-bold px-4 py-3 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.55)] dark:shadow-[0_12px_40px_rgba(253,186,48,0.25)] border border-slate-700/80 dark:border-amber-400/80 backdrop-blur-md flex items-center justify-between gap-3">
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

