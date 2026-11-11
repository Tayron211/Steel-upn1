import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ClipboardCheck, 
  HandHelping, 
  Layers, 
  BarChart3,
  Clock,
  Sun,
  Moon,
  Cloud,
  RefreshCw,
  Check,
  LogOut
} from 'lucide-react';
import UpnLogo from './UpnLogo';
import OneDriveSyncModal from './OneDriveSyncModal';
import {
  linkOneDriveExcelFile,
  reauthorizeSavedExcel,
  subscribeLiveExcelStatus,
  getLiveExcelState,
  syncAllDataToLinkedExcel
} from '../utils/liveExcelSync';

export default function Navbar({ activeTab, setActiveTab, pendingTicketsCount, darkMode, onToggleDarkMode, authUser, onLogout }) {
  const [time, setTime] = useState(new Date());
  const [liveExcel, setLiveExcel] = useState(() => getLiveExcelState());
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleSyncOneDrive = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/onedrive/sync', { method: 'POST' });
      const json = await res.json();
      if (json && json.success) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2500);
        window.dispatchEvent(new Event('upn:excel-pulled'));
      } else {
        alert(json?.message || 'No se pudo sincronizar con OneDrive. Verifique la vinculación.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al sincronizar con OneDrive.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return subscribeLiveExcelStatus((nextState) => {
      setLiveExcel((prev) => ({ ...prev, ...nextState }));
    });
  }, []);

  const handleOneDrivePillClick = async () => {
    setShowOneDriveModal(true);
  };

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const currentDayName = daysOfWeek[time.getDay()];
  const formattedTime = time.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  const navItems = [
    { id: 'attendance', label: 'Ronda', icon: ClipboardCheck },
    { id: 'operations', label: 'Operaciones', icon: Layers },
    { id: 'tickets', label: 'Préstamos', icon: HandHelping, badge: pendingTicketsCount },
    { id: 'dashboard', label: 'Métricas', icon: BarChart3 }
  ];

  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeTab));

  return (
    <>
      {/* Native App Top Bar with Frosted Glass Blur & Official UPN Branding */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-black/70 backdrop-blur-2xl backdrop-saturate-180 border-b border-slate-200/70 dark:border-zinc-800/80 safe-top shadow-2xs supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/60 print:hidden">
        <div className="max-w-[1880px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between gap-2">
          {/* Official UPN Identity Brand */}
          <div
            className="flex items-center min-w-0 cursor-pointer active:scale-98 transition-transform"
            onClick={() => {
              setActiveTab('attendance');
              window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              if (document.documentElement) document.documentElement.scrollTop = 0;
              if (document.body) document.body.scrollTop = 0;
            }}
            title="Ir al inicio (Ronda Académica)"
          >
            <UpnLogo variant="horizontal" />
          </div>

          {/* Header Right: OneDrive Sync + AMOLED Toggle + Apple Minimalist Live Clock Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick OneDrive Sync Icon Button */}
            <button
              type="button"
              onClick={handleSyncOneDrive}
              disabled={isSyncing}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-2xs shrink-0 ${
                isSyncing
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                  : syncSuccess
                  ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-sky-600 dark:hover:text-sky-400'
              }`}
              title="Sincronizar con OneDrive (Excel ↔ App)"
              aria-label="Sincronizar con OneDrive"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 stroke-[2.4] text-amber-500 animate-spin" />
              ) : syncSuccess ? (
                <Check className="w-4 h-4 stroke-[3] text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Cloud className="w-4 h-4 stroke-[2.3] text-sky-600 dark:text-sky-400" />
              )}
            </button>

            {/* Dark / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="h-9 w-9 rounded-full flex items-center justify-center transition-all active:scale-90 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-amber-400 shadow-2xs shrink-0"
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
            <div className="flex items-center gap-2 bg-slate-100/90 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 px-2.5 sm:px-3 py-1.5 rounded-full text-slate-800 dark:text-zinc-200 shadow-2xs whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                {currentDayName} {formattedTime}
              </span>
            </div>

            {/* Asistente Autenticado & Botón de Salir */}
            {authUser && (
              <div className="flex items-center gap-1.5 pl-0.5">
                <div
                  className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300/80 dark:border-amber-800/80 px-2 sm:px-2.5 py-1 rounded-full text-amber-900 dark:text-amber-300 text-[11px] font-bold shadow-2xs"
                  title={`Asistente en sesión: ${authUser.name}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span className="max-w-[75px] sm:max-w-[130px] truncate uppercase font-mono">
                    {authUser.name || authUser.displayName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="h-8 w-8 rounded-full flex items-center justify-center transition-all active:scale-90 bg-slate-100 hover:bg-rose-50 dark:bg-zinc-900 dark:hover:bg-rose-950/60 border border-slate-200/80 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 shadow-2xs shrink-0"
                  title="Cerrar sesión de asistente"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5 stroke-[2.3]" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop / Tablet Navigation Strip */}
        <div className="hidden md:block max-w-[1880px] mx-auto px-6 lg:px-8 xl:px-10 pb-2.5 pt-1 border-t border-slate-100 dark:border-zinc-900">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                    if (document.documentElement) document.documentElement.scrollTop = 0;
                    if (document.body) document.body.scrollTop = 0;
                  }}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#FDBA30] text-slate-950 shadow-[0_2px_10px_rgba(253,186,48,0.35)] font-extrabold scale-[1.02]'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 stroke-[2.2] shrink-0 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-500 dark:text-zinc-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
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

      {/* Clean 2D Frosted Glass Floating Bottom App Dock (Exclusivo para móvil / APK, oculto en modo escritorio PC) */}
      <div className="md:hidden fixed bottom-4 sm:bottom-6 inset-x-4 z-[9990] max-w-sm sm:max-w-md mx-auto pointer-events-none safe-bottom">
        <div className="relative pointer-events-auto rounded-[28px] shadow-[0_12px_36px_rgba(0,0,0,0.35)] dark:shadow-[0_12px_44px_rgba(0,0,0,0.85)]">
          {/* Capa 1: Superficie de Cristal Esmerilado Real de Alta Densidad (95-96% opacidad para evitar que el texto de fondo se trasluzca) */}
          <div
            className="absolute inset-0 rounded-[28px] bg-white/95 dark:bg-[#0d0d12]/96 border border-white/70 dark:border-white/10 pointer-events-none"
            style={{
              backdropFilter: 'blur(40px) saturate(200%)',
              WebkitBackdropFilter: 'blur(40px) saturate(200%)'
            }}
          />

          {/* Capa 2: Contenedor interactivo con pestañas y slider (con overflow-hidden para recorte perfecto) */}
          <nav className="relative z-10 rounded-[28px] p-1.5 grid grid-cols-4 overflow-hidden select-none">
            {/* Botón deslizante activo con efecto Gota Ámbar Líquida */}
            <div
              className="apple-liquid-slider absolute top-1.5 bottom-1.5 rounded-[22px] pointer-events-none z-0"
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
                  onClick={() => {
                    setActiveTab(item.id);
                    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                    if (document.documentElement) document.documentElement.scrollTop = 0;
                    if (document.body) document.body.scrollTop = 0;
                  }}
                  className="relative z-10 flex flex-col items-center justify-center py-2 px-1 rounded-[22px] transition-all duration-200 active:scale-95"
                >
                  <Icon 
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive 
                        ? 'text-slate-950 stroke-[2.6] scale-110 drop-shadow-xs' 
                        : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white stroke-[2]'
                    }`} 
                  />
                  <span 
                    className={`text-[10px] mt-0.5 tracking-tight transition-all duration-200 ${
                      isActive 
                        ? 'font-black text-slate-950' 
                        : 'font-bold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span 
                      className={`absolute top-0.5 right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-black transition-all duration-200 shadow-xs ring-1 ring-white/70 ${
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
      </div>

      <OneDriveSyncModal
        isOpen={showOneDriveModal}
        onClose={() => setShowOneDriveModal(false)}
        liveExcel={liveExcel}
      />
    </>
  );
}
