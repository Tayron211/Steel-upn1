import React, { useState, useEffect } from 'react';
import { FileText, Calendar, Building2 } from 'lucide-react';
import ManualSheetsView from './ManualSheetsView';
import ReservationsView from './ReservationsView';
import RoomsView from './RoomsView';

export default function OperationsHub({ 
  initialClassData, 
  onClearInitialClass, 
  onSelectRoomForSchedule,
  defaultSubTab = 'manual'
}) {
  const [subTab, setSubTab] = useState(defaultSubTab);

  useEffect(() => {
    if (initialClassData) {
      setSubTab('manual');
    }
  }, [initialClassData]);

  return (
    <div className="space-y-4">
      {/* Sleek Apple-Style Segmented Sub-Navigation for Operations Hub */}
      <div className="apple-liquid-pill rounded-[20px] p-1.5 flex items-center gap-1 shadow-sm">
        <button
          onClick={() => setSubTab('manual')}
          className={`flex-1 py-2 px-3 rounded-[14px] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 ${
            subTab === 'manual'
              ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_12px_rgba(253,186,48,0.4)] font-black scale-[1.02]'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <FileText className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span>Hojas Manuales</span>
        </button>

        <button
          onClick={() => setSubTab('reservations')}
          className={`flex-1 py-2 px-3 rounded-[14px] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 ${
            subTab === 'reservations'
              ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_12px_rgba(253,186,48,0.4)] font-black scale-[1.02]'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Calendar className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span>Reservas</span>
        </button>

        <button
          onClick={() => setSubTab('rooms')}
          className={`flex-1 py-2 px-3 rounded-[14px] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 ${
            subTab === 'rooms'
              ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_12px_rgba(253,186,48,0.4)] font-black scale-[1.02]'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-zinc-800/60'
          }`}
        >
          <Building2 className="w-4 h-4 stroke-[2.2] shrink-0" />
          <span>Ambientes</span>
        </button>
      </div>

      {/* Render Active Sub-View */}
      {subTab === 'manual' && (
        <ManualSheetsView
          initialClassData={initialClassData}
          onClearInitialClass={onClearInitialClass}
        />
      )}

      {subTab === 'reservations' && (
        <ReservationsView />
      )}

      {subTab === 'rooms' && (
        <RoomsView onSelectRoomForSchedule={onSelectRoomForSchedule} />
      )}
    </div>
  );
}

