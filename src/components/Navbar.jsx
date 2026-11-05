import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  HandHelping, 
  Layers, 
  BarChart3,
  Clock,
  Sun,
  Moon
} from 'lucide-react';
import UpnLogo from './UpnLogo';

export default function Navbar({ activeTab, setActiveTab, pendingTicketsCount, darkMode, onToggleDarkMode }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const currentDayName = daysOfWeek[time.getDay()];
  const formattedTime = time.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  const navItems = [
    { id: 'attendance', label: 'Ronda', icon: ClipboardCheck },
    { id: 'tickets', label: 'Préstamos', icon: HandHelping, badge: pendingTicketsCount },
    { id: 'operations', label: 'Operaciones', icon: Layers },
    { id: 'dashboard', label: 'Métricas', icon: BarChart3 }
  ];

  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeTab));

  return (
    <>
      {/* Native App Top Bar with Official Clean UPN Branding - AMOLED Ready */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-black/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-zinc-850/80 safe-top transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 flex items-center justify-between">
          {/* Official UPN Identity Brand */}
          <div className="flex items-center min-w-0">
            <UpnLogo variant="horizontal" />
          </div>

          {/* Header Right: AMOLED Toggle + Apple Minimalist Live Clock Pill */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Dark / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-full flex items-center justify-center transition-all active:scale-90 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-amber-400 shadow-2xs"
              title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro AMOLED'}
              aria-label="Alternar modo de pantalla"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 stroke-[2.4] text-amber-400 animate-pulse" />
              ) : (
                <Moon className="w-4 h-4 stroke-[2.3] text-slate-700" />
              )}
            </button>

            {/* Live Clock Pill */}
            <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 px-2.5 sm:px-3 py-1.5 rounded-full text-slate-800 dark:text-zinc-200 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-bold tracking-tight">
                {currentDayName} {formattedTime}
              </span>
            </div>
          </div>
        </div>

        {/* Desktop / Tablet Navigation Strip */}
        <div className="hidden md:block max-w-7xl mx-auto px-6 pb-2.5 pt-1 border-t border-slate-100 dark:border-zinc-900">
          <div className="flex items-center space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center justify-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_10px_rgba(253,186,48,0.35)] font-extrabold scale-[1.02]'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-500 dark:text-zinc-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-slate-950 text-[#FDBA30]' : 'bg-rose-500 text-white'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* iOS Liquid Glass Floating Bottom App Dock - Simetría Squircle (Menos Redondeada) */}
      <div className="md:hidden fixed bottom-4 inset-x-4 z-50 max-w-sm mx-auto pointer-events-none safe-bottom">
        <nav className="relative pointer-events-auto apple-liquid-glass-27 rounded-[22px] p-1.5 grid grid-cols-4 ring-1 ring-slate-900/5 dark:ring-white/10 shadow-2xl overflow-hidden select-none">
          {/* Botón deslizante activo plano: esquinas simétricas menos redondeadas */}
          <div
            className="apple-liquid-slider absolute top-1.5 bottom-1.5 rounded-[16px] pointer-events-none z-0"
            style={{
              width: 'calc((100% - 12px) / 4)',
              left: '6px',
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />

          {/* Interactive Navigation Tabs */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="relative z-10 flex flex-col items-center justify-center py-2 px-1 rounded-[16px] transition-all duration-200 active:scale-95"
              >
                <Icon 
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive 
                      ? 'text-slate-950 stroke-[2.6] scale-110' 
                      : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white stroke-[1.9]'
                  }`} 
                />
                <span 
                  className={`text-[10px] mt-0.5 tracking-tight transition-all duration-200 ${
                    isActive 
                      ? 'font-black text-slate-950' 
                      : 'font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </span>

                {item.badge !== undefined && item.badge > 0 && (
                  <span 
                    className={`absolute top-0.5 right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-black transition-all duration-200 shadow-xs ${
                      isActive 
                        ? 'bg-slate-950 text-[#FDBA30]' 
                        : 'bg-rose-500 text-white animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
