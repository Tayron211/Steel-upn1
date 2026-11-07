import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  FileText,
  HandHelping,
  Calendar
} from 'lucide-react';

function scrollToTopGlobal() {
  const doScroll = (behavior) => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior });
    } catch (_) {
      window.scrollTo(0, 0);
    }
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
    const scrollContainers = document.querySelectorAll('.overflow-y-auto, .overflow-auto');
    scrollContainers.forEach(el => { el.scrollTop = 0; });
  };

  doScroll('instant');
  requestAnimationFrame(() => doScroll('smooth'));
  setTimeout(() => doScroll('smooth'), 60);
  setTimeout(() => doScroll('instant'), 180);
  setTimeout(() => doScroll('instant'), 350);
}

export default function FloatingActionMenu({ onOpenManualSheet, onOpenNewTicket, onOpenReservation }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (callback) => {
    setIsOpen(false);
    scrollToTopGlobal();
    if (callback) callback();
    scrollToTopGlobal();
  };

  return (
    <>
      {/* Backdrop rendered at root body to prevent any coordinate or clipping trap */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-[9990] animate-backdrop-fade transition-all cursor-pointer"
          onClick={() => setIsOpen(false)}
        />,
        document.body
      )}

      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[9995]">
        {/* Apple-Style Speed Dial Options */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 z-[9996] flex flex-col items-end gap-2.5 mb-2 pointer-events-auto">
            {/* Option 1: Attention to Teacher / Loan */}
            <button
              type="button"
              onClick={() => handleAction(onOpenNewTicket)}
              style={{ animationDelay: '120ms' }}
              className="animate-speed-dial group inline-flex items-center justify-center gap-3 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:text-amber-800 dark:hover:text-amber-300 px-4 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-xl border border-slate-200/90 dark:border-zinc-800 hover:scale-105 select-none"
            >
              <span className="tracking-tight">Nuevo Préstamo de Material</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 inline-flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:bg-amber-200 dark:group-hover:bg-amber-900 transition-all">
                <HandHelping className="w-4 h-4 stroke-[2.4]" />
              </div>
            </button>

            {/* Option 2: Manual Sheet */}
            <button
              type="button"
              onClick={() => handleAction(onOpenManualSheet)}
              style={{ animationDelay: '70ms' }}
              className="animate-speed-dial group inline-flex items-center justify-center gap-3 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:text-indigo-800 dark:hover:text-indigo-300 px-4 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-xl border border-slate-200/90 dark:border-zinc-800 hover:scale-105 select-none"
            >
              <span className="tracking-tight">Emitir Hoja de Asistencia</span>
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 inline-flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900 transition-all">
                <FileText className="w-4 h-4 stroke-[2.4]" />
              </div>
            </button>

            {/* Option 3: Room Reservation */}
            <button
              type="button"
              onClick={() => handleAction(onOpenReservation)}
              style={{ animationDelay: '20ms' }}
              className="animate-speed-dial group inline-flex items-center justify-center gap-3 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:text-emerald-800 dark:hover:text-emerald-300 px-4 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-xl border border-slate-200/90 dark:border-zinc-800 hover:scale-105 select-none"
            >
              <span className="tracking-tight">Nueva Reserva de Espacio</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 inline-flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900 transition-all">
                <Calendar className="w-4 h-4 stroke-[2.4]" />
              </div>
            </button>
          </div>
        )}

        {/* Main Floating Trigger Button with Spring Pop Animation */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Acciones Rápidas"
          className={`w-14 h-14 rounded-full shadow-2xl inline-flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 ${isOpen
              ? 'bg-slate-900 text-white rotate-45 scale-105 shadow-slate-900/40 ring-4 ring-slate-900/20'
              : 'bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-[0_8px_28px_rgba(253,186,48,0.55)] ring-4 ring-[#FDBA30]/35 hover:scale-105'
            }`}
        >
          <Plus className="w-6 h-6 stroke-[2.8] transition-transform duration-300" />
        </button>
      </div>
    </>
  );
}
