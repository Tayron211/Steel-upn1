import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Building2 } from 'lucide-react';
import ManualSheetsView from './ManualSheetsView';
import ReservationsView from './ReservationsView';
import RoomsView from './RoomsView';

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
    // Al dar clic en una subpestaña (Hojas Manuales, Reservas, Ambientes),
    // NUNCA debe abrirse una ventana modal a menos que se use su respectivo botón de registro.
    if (onConsumeManualModalTrigger) onConsumeManualModalTrigger();
    if (onConsumeReservationModalTrigger) onConsumeReservationModalTrigger();
    setSubTab(target);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  return (
    <div className="space-y-4">
      {/* Sleek Apple-Style Segmented Sub-Navigation for Operations Hub */}
      <div className="apple-liquid-pill rounded-[20px] p-1.5 flex items-center gap-1 shadow-sm">
        <button
          onClick={() => switchSubTab('manual')}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-[14px] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 min-w-0 whitespace-nowrap ${
            subTab === 'manual'
              ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_12px_rgba(253,186,48,0.4)] font-black scale-[1.02]'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <FileText className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Hojas Manuales</span>
        </button>

        <button
          onClick={() => switchSubTab('reservations')}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-[14px] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 min-w-0 whitespace-nowrap ${
            subTab === 'reservations'
              ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_12px_rgba(253,186,48,0.4)] font-black scale-[1.02]'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Calendar className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Reservas</span>
        </button>

        <button
          onClick={() => switchSubTab('rooms')}
          className={`flex-1 py-2 px-2 sm:px-3 rounded-[14px] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 min-w-0 whitespace-nowrap ${
            subTab === 'rooms'
              ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_12px_rgba(253,186,48,0.4)] font-black scale-[1.02]'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Building2 className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span className="truncate">Ambientes</span>
        </button>
      </div>

      {/* Render Active Sub-View con transicion suave fade */}
      <div key={subTab} className="animate-fade-in">
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
  );
}

