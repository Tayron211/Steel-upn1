import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, ChevronDown, Check, X } from 'lucide-react';
import { useFadeModal } from '../utils/useFadeModal';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const COMMON_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export default function CustomTimePicker({
  value = '09:00',
  onChange,
  label,
  placeholder = 'Seleccionar hora',
  required = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerFade = useFadeModal(isOpen, () => setIsOpen(false), 180);
  const triggerRef = useRef(null);

  // Parse current value
  const parseVal = (str) => {
    if (!str || !str.includes(':')) {
      const now = new Date();
      return {
        h: String(now.getHours()).padStart(2, '0'),
        m: String(now.getMinutes()).padStart(2, '0')
      };
    }
    const [h, m] = str.split(':');
    return {
      h: String(h || '09').padStart(2, '0'),
      m: String(m || '00').padStart(2, '0')
    };
  };

  const { h: currentH, m: currentM } = parseVal(value);
  const [selectedH, setSelectedH] = useState(currentH);
  const [selectedM, setSelectedM] = useState(currentM);

  useEffect(() => {
    const { h, m } = parseVal(value);
    setSelectedH(h);
    setSelectedM(m);
  }, [value]);

  const handleSelectTime = (newH, newM) => {
    setSelectedH(newH);
    setSelectedM(newM);
    if (onChange) {
      onChange(`${newH}:${newM}`);
    }
  };

  return (
    <div className="relative w-full">
      {/* Botón Disparador - Diseño Integrado a la App */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? pickerFade.requestClose(() => setIsOpen(false)) : setIsOpen(true))}
        className={`w-full h-10 px-3 text-xs bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white flex items-center justify-between gap-2 text-left font-mono font-bold hover:border-[#FDBA30] dark:hover:border-[#FDBA30] focus:outline-none focus:ring-2 focus:ring-[#FDBA30]/20 transition active:scale-[0.99] ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 stroke-[2.2]" />
          <span className="truncate tracking-wide">{value || placeholder}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Menú Flotante Personalizado Estilo AMOLED Dark */}
      {pickerFade.shouldRender &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 ${pickerFade.backdropClass}`}
            onClick={() => pickerFade.requestClose(() => setIsOpen(false))}
          >
            <div
              className={`bg-white dark:bg-[#0c0c10] border border-slate-200 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xl max-w-sm w-full space-y-3.5 overflow-hidden ${pickerFade.modalClass}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera del Reloj */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 stroke-[2.3]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                      Seleccionar Horario
                    </span>
                    <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                      {selectedH} : {selectedM}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => pickerFade.requestClose(() => setIsOpen(false))}
                    className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition active:scale-90"
                    title="Cerrar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Selector de Horas y Minutos en 2 Columnas Limpias */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Columna Horas */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1 text-center">
                    Hora
                  </span>
                  <div className="max-h-44 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {HOURS.map((h) => {
                      const isSel = selectedH === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleSelectTime(h, selectedM)}
                          className={`w-full h-7 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center active:scale-95 ${
                            isSel
                              ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {h} hrs
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Columna Minutos */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1 text-center">
                    Minutos
                  </span>
                  <div className="max-h-44 overflow-y-auto space-y-1 p-1 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {COMMON_MINUTES.map((m) => {
                      const isSel = selectedM === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleSelectTime(selectedH, m)}
                          className={`w-full h-7 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center active:scale-95 ${
                            isSel
                              ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {m} min
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Botón Confirmar */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => pickerFade.requestClose(() => setIsOpen(false))}
                  className="w-full h-9 rounded-xl bg-[#FDBA30] hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 active:scale-98 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Confirmar ({selectedH}:{selectedM})</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

