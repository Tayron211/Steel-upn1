import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOpt = normalizedOptions.find(opt => opt.value === value);

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white flex items-center justify-between gap-2 text-left font-medium hover:border-[#FDBA30] dark:hover:border-[#FDBA30] focus:outline-none focus:ring-2 focus:ring-[#FDBA30]/20 transition active:scale-[0.99] ${className}`}
      >
        <span className={`truncate whitespace-nowrap ${selectedOpt ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'}`}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-fade"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#0c0c10] border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.85)] animate-spring-up max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {placeholder}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition flex items-center justify-center active:scale-90"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-1 py-1 pr-1">
              {normalizedOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between gap-2 active:scale-98 ${
                      isSelected
                        ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                        : 'text-slate-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="break-words leading-tight">{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

