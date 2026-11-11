import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Building2 } from 'lucide-react';
import ManualSheetsView from './ManualSheetsView';
import ReservationsView from './ReservationsView';
import RoomsView from './RoomsView';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';

const SUB_TABS = ['manual', 'reservations', 'rooms'];

export default function OperationsHub({ 
  initialClassData, 
  onClearInitialClass, 
  onSelectRoomForSchedule,
  defaultSubTab = 'manual',
  openManualModalTrigger = null,
  openReservationModalTrigger = null,
  onConsumeManualModalTrigger = null,
  onConsumeReservationModalTrigger = null
}) {
  const [subTab, setSubTab] = useState(defaultSubTab);
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
    if (initialClassData) {
      setSubTab('manual');
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, [initialClassData]);

  useEffect(() => {
    if (defaultSubTab) {
      setSubTab(defaultSubTab);
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, [defaultSubTab]);

  useEffect(() => {
    if (openManualModalTrigger) {
      setSubTab('manual');
    }
  }, [openManualModalTrigger]);

  useEffect(() => {
    if (openReservationModalTrigger) {
      setSubTab('reservations');
    }
  }, [openReservationModalTrigger]);

  const switchSubTab = (target) => {
    if (onConsumeManualModalTrigger) onConsumeManualModalTrigger();
    if (onConsumeReservationModalTrigger) onConsumeReservationModalTrigger();
    setSubTab(target);
    const subHash = target === 'reservations' ? '#reservas' : (target === 'rooms' ? '#ambientes' : '#operaciones');
    if (window.location.hash.toLowerCase() !== subHash) {
      window.history.pushState({ tab: 'operations', subTab: target }, '', subHash);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  return (
    <div className="space-y-4">
      {/* Sleek Apple-Style Segmented Sub-Navigation for Operations Hub */}
      <div
        ref={subTabSlide.containerRef}
        className="relative apple-liquid-pill rounded-[20px] p-1.5 flex items-center gap-1 shadow-sm"
      >
        <span
          aria-hidden="true"
          style={subTabSlide.pillStyle}
          className="pointer-events-none absolute top-0 left-0 z-0 rounded-[14px] bg-[#FDBA30] shadow-[0_2px_12px_rgba(253,186,48,0.4)]"
        />

        <button
          onClick={() => switchSubTab('manual')}
          data-slide-active={subTab === 'manual' ? 'true' : undefined}
          className={`relative z-10 flex-1 py-2 px-2 sm:px-3 rounded-[14px] text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 active:scale-95 min-w-0 whitespace-nowrap ${
            subTab === 'manual'
              ? 'text-slate-950 font-black'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Hojas Manuales</span>
        </button>

        <button
          onClick={() => switchSubTab('reservations')}
          data-slide-active={subTab === 'reservations' ? 'true' : undefined}
          className={`relative z-10 flex-1 py-2 px-2 sm:px-3 rounded-[14px] text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 active:scale-95 min-w-0 whitespace-nowrap ${
            subTab === 'reservations'
              ? 'text-slate-950 font-black'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Reservas</span>
        </button>

        <button
          onClick={() => switchSubTab('rooms')}
          data-slide-active={subTab === 'rooms' ? 'true' : undefined}
          className={`relative z-10 flex-1 py-2 px-2 sm:px-3 rounded-[14px] text-xs font-bold transition-colors duration-200 flex items-center justify-center gap-1.5 active:scale-95 min-w-0 whitespace-nowrap ${
            subTab === 'rooms'
              ? 'text-slate-950 font-black'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Ambientes</span>
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

        {subTab === 'rooms' && (
          <RoomsView onSelectRoomForSchedule={onSelectRoomForSchedule} />
        )}
        </div>
      </div>
    </div>
  );
}

