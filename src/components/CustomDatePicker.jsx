import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X, Clock, Check } from 'lucide-react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'];

export default function CustomDatePicker({
  value,
  onChange,
  label,
  placeholder = 'Seleccionar fecha',
  required = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);

  // Parse initial selected date or default to today
  const parseDate = (str) => {
    if (!str) return new Date();
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  };

  const selectedDate = value ? parseDate(value) : null;

  // View state for current calendar page (month & year)
  const [viewYear, setViewYear] = useState(() => (selectedDate || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selectedDate || new Date()).getMonth());

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      const d = parseDate(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const formatDateToString = (year, month, day) => {
    const y = String(year);
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleSelectDay = (year, month, day) => {
    const formatted = formatDateToString(year, month, day);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const formatted = formatDateToString(today.getFullYear(), today.getMonth(), today.getDate());
    onChange(formatted);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  // Generate calendar grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Days from previous month to fill the first row
  const prevMonthDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push({
      day: daysInPrevMonth - i,
      month: viewMonth === 0 ? 11 : viewMonth - 1,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      isCurrentMonth: false
    });
  }

  // Days of current month
  const currentMonthDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    currentMonthDays.push({
      day: d,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true
    });
  }

  // Days from next month to complete the 35 or 42 grid cells
  const totalSlots = Math.ceil((prevMonthDays.length + currentMonthDays.length) / 7) * 7;
  const nextMonthDaysCount = totalSlots - (prevMonthDays.length + currentMonthDays.length);
  const nextMonthDays = [];
  for (let d = 1; d <= nextMonthDaysCount; d++) {
    nextMonthDays.push({
      day: d,
      month: viewMonth === 11 ? 0 : viewMonth + 1,
      year: viewMonth === 11 ? viewYear + 1 : viewYear,
      isCurrentMonth: false
    });
  }

  const allCalendarDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Helper to format human friendly label
  const formatFriendlyDate = (val) => {
    if (!val) return placeholder;
    const [y, m, d] = val.split('-').map(Number);
    if (!y || !m || !d) return val;
    const dateObj = new Date(y, m - 1, d);
    const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dateObj.getDay()];
    return `${dayName}, ${String(d).padStart(2, '0')} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
  };

  const isToday = (y, m, d) => {
    const today = new Date();
    return today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
  };

  const isSelected = (y, m, d) => {
    if (!value) return false;
    const [selY, selM, selD] = value.split('-').map(Number);
    return selY === y && selM - 1 === m && selD === d;
  };

  return (
    <div className="relative w-full">
      {/* Trigger Button - Mimics native input perfectly but opens our branded Apple-glass calendar */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl text-slate-900 dark:text-white flex items-center justify-between gap-2 text-left font-medium hover:border-[#FDBA30] dark:hover:border-[#FDBA30] focus:outline-none focus:ring-2 focus:ring-[#FDBA30]/20 transition active:scale-[0.99] ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 stroke-[2.2]" />
          <span className={`break-words ${value ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'}`}>
            {formatFriendlyDate(value)}
          </span>
        </div>
        <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500 uppercase shrink-0">
          {value ? value : 'YYYY-MM-DD'}
        </span>
      </button>

      {/* Popover / Modal Calendar - Portaled directly to body so it never clips or causes stacking issues */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[999999] bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-fade"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-[320px] bg-white dark:bg-[#0c0c10] border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.85)] animate-spring-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Month & Year with Navigation Controls */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-850 mb-3">
              <div className="flex items-center gap-1.5 pl-1">
                <span className="text-sm font-extrabold text-slate-950 dark:text-white tracking-tight">
                  {MONTH_NAMES[viewMonth]}
                </span>
                <span className="text-sm font-bold font-mono text-slate-500 dark:text-zinc-400">
                  {viewYear}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-zinc-850 hover:bg-slate-200 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-300 transition flex items-center justify-center active:scale-90"
                  title="Mes anterior"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.4]" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-zinc-850 hover:bg-slate-200 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-300 transition flex items-center justify-center active:scale-90"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.4]" />
                </button>
              </div>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
              {WEEKDAY_NAMES.map(day => (
                <span
                  key={day}
                  className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 py-0.5"
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {allCalendarDays.map((cell, idx) => {
                const selected = isSelected(cell.year, cell.month, cell.day);
                const today = isToday(cell.year, cell.month, cell.day);

                return (
                  <button
                    key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                    type="button"
                    onClick={() => handleSelectDay(cell.year, cell.month, cell.day)}
                    className={`h-8 rounded-xl text-xs font-bold transition flex items-center justify-center active:scale-90 ${
                      selected
                        ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs scale-105 z-10'
                        : cell.isCurrentMonth
                        ? 'text-slate-800 dark:text-zinc-100 hover:bg-amber-50 dark:hover:bg-zinc-800'
                        : 'text-slate-300 dark:text-zinc-650 hover:bg-slate-50 dark:hover:bg-zinc-900'
                    } ${
                      today && !selected
                        ? 'border border-amber-400/80 dark:border-amber-400/60 font-extrabold text-amber-600 dark:text-amber-400'
                        : ''
                    }`}
                  >
                    <span>{cell.day}</span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions: Hoy, Limpiar, Cerrar */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 dark:border-zinc-850">
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline px-2 py-1 rounded-lg transition"
              >
                Hoy
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl transition active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

