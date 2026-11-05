import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  X, 
  FileText, 
  HandHelping, 
  Calendar
} from 'lucide-react';

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

      <div className="fixed bottom-22 right-4 sm:bottom-8 sm:right-8 z-[9995]">
        {/* Apple-Style Speed Dial Options */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 z-[9996] flex flex-col items-end gap-2.5 mb-2 pointer-events-auto">
            {/* Option 1: Attention to Teacher / Loan */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenNewTicket();
              }}
              style={{ animationDelay: '120ms' }}
              className="animate-speed-dial group inline-flex items-center justify-center gap-3 bg-white text-slate-900 hover:text-amber-800 px-4 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-xl border border-slate-200/90 hover:scale-105 select-none"
            >
              <span className="tracking-tight">Nuevo Préstamo de Material</span>
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 inline-flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:bg-amber-200 transition-all">
                <HandHelping className="w-4 h-4 stroke-[2.4]" />
              </div>
            </button>

            {/* Option 2: Manual Sheet */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenManualSheet();
              }}
              style={{ animationDelay: '70ms' }}
              className="animate-speed-dial group inline-flex items-center justify-center gap-3 bg-white text-slate-900 hover:text-indigo-800 px-4 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-xl border border-slate-200/90 hover:scale-105 select-none"
            >
              <span className="tracking-tight">Emitir Hoja de Asistencia</span>
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 inline-flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:bg-indigo-200 transition-all">
                <FileText className="w-4 h-4 stroke-[2.4]" />
              </div>
            </button>

            {/* Option 3: Room Reservation */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenReservation();
              }}
              style={{ animationDelay: '20ms' }}
              className="animate-speed-dial group inline-flex items-center justify-center gap-3 bg-white text-slate-900 hover:text-emerald-800 px-4 py-2.5 rounded-full text-xs font-black transition-all active:scale-95 shadow-xl border border-slate-200/90 hover:scale-105 select-none"
            >
              <span className="tracking-tight">Nueva Reserva de Espacio</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center justify-center shadow-xs group-hover:scale-110 group-hover:bg-emerald-200 transition-all">
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
          className={`w-14 h-14 rounded-full shadow-2xl inline-flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 ${
            isOpen
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
