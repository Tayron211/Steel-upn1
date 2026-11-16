import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, AlertCircle, Info, Loader2 } from 'lucide-react';
import { useFadeModal } from '../utils/useFadeModal';

/**
 * ConfirmModal
 * Modal de confirmación moderno acorde al diseño Liquid Glass / UPN de la aplicación.
 * Reemplaza los diálogos nativos 'window.confirm()' del navegador.
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = '¿Estás seguro?',
  subtitle,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger', // 'danger' | 'warning' | 'primary' | 'info'
  icon: CustomIcon,
  details = [],
  isLoading = false
}) {
  const fadeModal = useFadeModal(Boolean(isOpen), onClose, 200);

  if (!fadeModal.shouldRender || typeof document === 'undefined') return null;

  const handleCancel = () => {
    if (isLoading) return;
    fadeModal.requestClose(onClose);
  };

  const handleConfirm = () => {
    if (isLoading) return;
    if (onConfirm) onConfirm();
  };

  // Iconos y colores según la variante
  const variantStyles = {
    danger: {
      iconBg: 'bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400',
      iconBorder: 'border-rose-200/60 dark:border-rose-800/50',
      btnBg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-rose-600/30',
      defaultIcon: Trash2,
      subtitleColor: 'text-rose-600 dark:text-rose-400'
    },
    warning: {
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400',
      iconBorder: 'border-amber-200/60 dark:border-amber-800/50',
      btnBg: 'bg-[#FDBA30] hover:bg-[#e29b12] active:bg-amber-600 text-slate-950 shadow-[#FDBA30]/30',
      defaultIcon: AlertTriangle,
      subtitleColor: 'text-amber-600 dark:text-amber-400'
    },
    primary: {
      iconBg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400',
      iconBorder: 'border-amber-200/60 dark:border-amber-800/50',
      btnBg: 'bg-[#FDBA30] hover:bg-[#e29b12] active:bg-amber-600 text-slate-950 shadow-[#FDBA30]/30',
      defaultIcon: AlertCircle,
      subtitleColor: 'text-amber-600 dark:text-amber-400'
    },
    info: {
      iconBg: 'bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400',
      iconBorder: 'border-sky-200/60 dark:border-sky-800/50',
      btnBg: 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white shadow-sky-600/30',
      defaultIcon: Info,
      subtitleColor: 'text-sky-600 dark:text-sky-400'
    }
  };

  const style = variantStyles[variant] || variantStyles.danger;
  const IconComponent = CustomIcon || style.defaultIcon;

  return createPortal(
    <div
      className={`fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 ${fadeModal.backdropClass}`}
      onClick={handleCancel}
    >
      <div
        className={`apple-liquid-modal rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#121216] ${fadeModal.modalClass} overflow-hidden transform-gpu`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del Diálogo */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${style.iconBg} ${style.iconBorder} shadow-2xs`}>
            <IconComponent className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight font-upn">
              {title}
            </h3>
            {subtitle && (
              <p className={`text-xs font-semibold mt-0.5 ${style.subtitleColor}`}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleCancel}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0 disabled:opacity-40"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Mensaje principal */}
        {message && (
          <div className="bg-slate-50 dark:bg-zinc-900/80 rounded-2xl p-4 border border-slate-200/80 dark:border-zinc-800 text-xs sm:text-sm text-slate-600 dark:text-zinc-300 space-y-2 mb-4 leading-relaxed">
            {typeof message === 'string' ? <p>{message}</p> : message}

            {/* Listado opcional de detalles (ej. Aula, Docente, Horario) */}
            {details && details.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 font-mono text-[11px]">
                {details.map((d, idx) => (
                  <div
                    key={idx}
                    className={`bg-white dark:bg-zinc-800/80 p-2 rounded-xl border border-slate-200/80 dark:border-zinc-700/70 ${d.fullWidth ? 'sm:col-span-2' : ''}`}
                  >
                    <span className="font-bold text-slate-400 dark:text-zinc-400 mr-1">{d.label}:</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-100">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleCancel}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className={`h-9 px-5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-md ${style.btnBg} cursor-pointer font-upn`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
