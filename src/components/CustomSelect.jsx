import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seleccionar...',
  className = '',
  searchable = undefined
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const selectedItemRef = useRef(null);

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

  // Reset search and auto-scroll when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
        if (selectedItemRef.current) {
          selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 60);
    }
  }, [isOpen]);

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const showSearch = searchable !== undefined ? searchable : normalizedOptions.length > 8;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(opt =>
      String(opt.label || '').toLowerCase().includes(q) ||
      String(opt.value || '').toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  const selectedOpt = normalizedOptions.find(opt => opt.value === value);

  const hasCustomHeight = className.includes('h-');

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white flex items-center justify-between gap-2 text-left font-medium hover:border-[#FDBA30] dark:hover:border-[#FDBA30] focus:outline-none focus:ring-2 focus:ring-[#FDBA30]/20 transition active:scale-[0.99] ${hasCustomHeight ? '' : 'h-10'} ${className}`}
      >
        <span className={`truncate whitespace-nowrap ${selectedOpt && selectedOpt.value !== '' ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'}`}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-backdrop-fade"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#0c0c10] border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.9)] animate-spring-up max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-3">
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

            {/* Quick Search for long option lists */}
            {showSearch && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-2.5 pointer-events-none stroke-[2.5]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar semana u opción..."
                  className="w-full h-8.5 pl-8 pr-8 text-xs bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 font-medium focus:outline-none focus:border-[#FDBA30] dark:focus:border-[#FDBA30]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable list */}
            <div className="overflow-y-auto space-y-1 py-1 pr-1 max-h-[60vh]">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500 font-medium">
                  No se encontraron resultados
                </div>
              ) : (
                filteredOptions.map(opt => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={String(opt.value)}
                      ref={isSelected ? selectedItemRef : null}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between gap-2 active:scale-98 ${
                        isSelected
                          ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                          : 'text-slate-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-zinc-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="break-words leading-tight truncate">{opt.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

