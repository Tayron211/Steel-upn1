import React, { useState, useEffect } from 'react';
import { FileText, Calendar, GraduationCap } from 'lucide-react';
import ManualSheetsView from './ManualSheetsView';
import ReservationsView from './ReservationsView';
import TeacherSchedulesView from './TeacherSchedulesView';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';

const SUB_TABS = ['reservations', 'manual', 'teachers'];

export default function OperationsHub({
  initialClassData,
  onClearInitialClass,
  defaultSubTab = 'manual',
  onSubTabChange = null,
  openManualModalTrigger = null,
  openReservationModalTrigger = null,
  onConsumeManualModalTrigger = null,
  onConsumeReservationModalTrigger = null
}) {
  const [subTab, setSubTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#reservas' || hash === '#operaciones/reservas' || hash === '#ambientes' || hash === '#operaciones/ambientes') return 'reservations';
      if (hash === '#docentes' || hash === '#horarios-docentes' || hash === '#operaciones/docentes') return 'teachers';
      if (hash === '#operaciones' || hash === '#fichas') return 'manual';
      try {
        const saved = localStorage.getItem('steel:operations-subtab');
        if (saved && (saved === 'manual' || saved === 'reservations' || saved === 'teachers')) return saved;
      } catch (_) { }
    }
    return defaultSubTab === 'reservations' ? 'reservations' : (defaultSubTab === 'teachers' ? 'teachers' : 'manual');
  });
  const [subTransition, setSubTransition] = useState(() => ({ tab: subTab, dir: 'initial' }));
  if (subTransition.tab !== subTab) {
    const prevIdx = SUB_TABS.indexOf(subTransition.tab);
    const nextIdx = SUB_TABS.indexOf(subTab);
    const nextDir = prevIdx !== -1 && nextIdx !== -1 && nextIdx < prevIdx ? 'prev' : 'next';
    setSubTransition({ tab: subTab, dir: nextDir });
  }
  const subAnimClass = subTransition.dir === 'prev' ? 'animate-slide-prev' : subTransition.dir === 'next' ? 'animate-slide-next' : 'animate-fade-in';
  const subTabSlide = useSlidingIndicator(subTab);

  useEffect(() => {
    const handleHashSync = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#reservas' || hash === '#operaciones/reservas') {
        setSubTab('reservations');
        try { localStorage.setItem('steel:operations-subtab', 'reservations'); } catch (_) { }
        if (onSubTabChange) onSubTabChange('reservations');
      } else if (hash === '#docentes' || hash === '#horarios-docentes' || hash === '#operaciones/docentes') {
        setSubTab('teachers');
        try { localStorage.setItem('steel:operations-subtab', 'teachers'); } catch (_) { }
        if (onSubTabChange) onSubTabChange('teachers');
      } else if (hash === '#ambientes' || hash === '#operaciones/ambientes') {
        setSubTab('rooms');
        try { localStorage.setItem('steel:operations-subtab', 'rooms'); } catch (_) { }
        if (onSubTabChange) onSubTabChange('rooms');
      } else if (hash === '#operaciones' || hash === '#fichas') {
        setSubTab('manual');
        try { localStorage.setItem('steel:operations-subtab', 'manual'); } catch (_) { }
        if (onSubTabChange) onSubTabChange('manual');
      }
    };
    window.addEventListener('popstate', handleHashSync);
    window.addEventListener('hashchange', handleHashSync);
    return () => {
      window.removeEventListener('popstate', handleHashSync);
      window.removeEventListener('hashchange', handleHashSync);
    };
  }, [onSubTabChange]);

  useEffect(() => {
    if (initialClassData) {
      switchSubTab('manual');
    }
  }, [initialClassData]);

  useEffect(() => {
    if (defaultSubTab && defaultSubTab !== subTab) {
      setSubTab(defaultSubTab);
      try { localStorage.setItem('steel:operations-subtab', defaultSubTab); } catch (_) { }
    }
  }, [defaultSubTab]);

  useEffect(() => {
    if (openManualModalTrigger) {
      switchSubTab('manual');
    }
  }, [openManualModalTrigger]);

  useEffect(() => {
    if (openReservationModalTrigger) {
      switchSubTab('reservations');
    }
  }, [openReservationModalTrigger]);

  const switchSubTab = (target) => {
    if (onConsumeManualModalTrigger) onConsumeManualModalTrigger();
    if (onConsumeReservationModalTrigger) onConsumeReservationModalTrigger();
    setSubTab(target);
    try { localStorage.setItem('steel:operations-subtab', target); } catch (_) { }
    if (onSubTabChange) onSubTabChange(target);
    const subHash = target === 'reservations' ? '#reservas' : (target === 'teachers' ? '#docentes' : '#operaciones');
    if (window.location.hash.toLowerCase() !== subHash) {
      window.history.pushState({ tab: 'operations', subTab: target }, '', subHash);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  return (
    <div className="space-y-3.5 pt-0">
      {/* Sleek Apple-Style Segmented Sub-Navigation for Operations Hub */}
      <div
        ref={subTabSlide.containerRef}
        className="relative apple-liquid-pill rounded-[20px] p-1.5 flex items-center gap-1 shadow-sm max-w-xl mx-auto -mt-1 mb-2.5 md:-mt-2.5 md:mb-3"
      >
        <span
          aria-hidden="true"
          style={subTabSlide.pillStyle}
          className="pointer-events-none absolute top-0 left-0 z-0 rounded-[14px] bg-[#FDBA30] shadow-[0_2px_12px_rgba(253,186,48,0.4)]"
        />

        <button
          onClick={() => switchSubTab('reservations')}
          data-slide-active={subTab === 'reservations' ? 'true' : undefined}
          className={`relative z-10 flex-1 py-2 px-1.5 sm:px-4 rounded-[14px] text-[11px] sm:text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-1 sm:gap-2 active:scale-95 min-w-0 whitespace-nowrap ${subTab === 'reservations'
              ? 'text-slate-950 font-black'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <Calendar className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Reservas</span>
        </button>

        <button
          onClick={() => switchSubTab('manual')}
          data-slide-active={subTab === 'manual' ? 'true' : undefined}
          className={`relative z-10 flex-1 py-2 px-1.5 sm:px-4 rounded-[14px] text-[11px] sm:text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-1 sm:gap-2 active:scale-95 min-w-0 whitespace-nowrap ${subTab === 'manual'
              ? 'text-slate-950 font-black'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <FileText className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Hojas Manuales</span>
        </button>

        <button
          onClick={() => switchSubTab('teachers')}
          data-slide-active={subTab === 'teachers' ? 'true' : undefined}
          className={`relative z-10 flex-1 py-2 px-1.5 sm:px-4 rounded-[14px] text-[11px] sm:text-sm font-bold transition-colors duration-200 flex items-center justify-center gap-1 sm:gap-2 active:scale-95 min-w-0 whitespace-nowrap ${subTab === 'teachers'
              ? 'text-slate-950 font-black'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
        >
          <GraduationCap className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Horarios Docentes</span>
        </button>
      </div>

      {/* Render Active Sub-View con transicion direccional deslizable */}
      <div className="overflow-x-hidden">
        <div key={subTab} className={subAnimClass}>
          {subTab === 'manual' && (
            <ManualSheetsView
              initialClassData={initialClassData}
              onClearInitialClass={onClearInitialClass}
              initialOpenTrigger={openManualModalTrigger}
              onConsumeTrigger={onConsumeManualModalTrigger}
            />
          )}

          {subTab === 'reservations' && (
            <ReservationsView
              initialOpenTrigger={openReservationModalTrigger}
              onConsumeTrigger={onConsumeReservationModalTrigger}
            />
          )}

          {subTab === 'teachers' && (
            <TeacherSchedulesView />
          )}
        </div>
      </div>
    </div>
  );
}

