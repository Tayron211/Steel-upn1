import React, { useState, useEffect, useRef } from 'react';
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
  LogOut,
  ChevronDown
} from 'lucide-react';
import UpnLogo from './UpnLogo';
import OneDriveSyncModal from './OneDriveSyncModal';
import { useFadeModal } from '../utils/useFadeModal';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuFade = useFadeModal(userMenuOpen, () => setUserMenuOpen(false), 180);
  const userMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [userMenuOpen]);

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
    { id: 'attendance', label: 'Control', icon: ClipboardCheck },
    { id: 'operations', label: 'Operaciones', icon: Layers },
    { id: 'tickets', label: 'Préstamos', icon: HandHelping, badge: pendingTicketsCount },
    { id: 'dashboard', label: 'Métricas', icon: BarChart3 }
  ];

  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeTab));
  const prevNavIndexRef = useRef(activeIndex);
  const navStepDistance = Math.abs(activeIndex - prevNavIndexRef.current);
  const mobileSlideMs = Math.min(430, 280 + navStepDistance * 50);
  useEffect(() => {
    prevNavIndexRef.current = activeIndex;
  }, [activeIndex]);
  const desktopNavSlide = useSlidingIndicator(activeTab, [pendingTicketsCount]);

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
            title="Ir al inicio (Control Docente)"
          >
            <UpnLogo variant="horizontal" />
          </div>

          {/* Header Right: Reloj Minimalista + Botón Desplegable del Asistente */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live Clock Pill */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-100/90 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 px-3 py-1.5 rounded-full text-slate-800 dark:text-zinc-200 shadow-2xs whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="text-[11px] font-bold tracking-tight whitespace-nowrap font-mono">
                {currentDayName} {formattedTime}
              </span>
            </div>

            {/* Botón de Nombre con Menú Desplegable (Modo Claro/Oscuro + Sincronización OneDrive + Cerrar Sesión) */}
            {authUser && (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className={`h-9 px-3 sm:px-3.5 rounded-full flex items-center gap-2 transition-all active:scale-95 border shadow-2xs select-none cursor-pointer ${
                    userMenuOpen
                      ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/30'
                      : 'bg-amber-50 hover:bg-amber-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-amber-200/80 dark:border-zinc-800 text-amber-950 dark:text-zinc-100'
                  }`}
                  title="Opciones de cuenta y sistema"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold font-mono tracking-tight max-w-[100px] sm:max-w-[150px] truncate uppercase">
                    {authUser?.name || authUser?.displayName || 'Asistente'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-amber-700 dark:text-zinc-400 transition-transform duration-200 shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Menú Desplegable: Solo Iconos de Acciones */}
                {userMenuFade.shouldRender && (
                  <div className={`absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-slate-200/90 dark:border-zinc-800 shadow-2xl p-2.5 z-50 ${userMenuFade.dropdownClass}`}>
                    {/* Cabecera del Usuario */}
                    <div className="px-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800/80 mb-2.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {authUser?.name || authUser?.displayName}
                      </div>
                      <div className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold uppercase mt-0.5">
                        {authUser?.role === 'admin' ? 'Modo Administrador' : 'Modo Asistente'} • Comas
                      </div>
                    </div>

                    {/* Fila de Solo Iconos Estilizados */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* 1. Modo Claro / Oscuro */}
                      <button
                        type="button"
                        onClick={() => {
                          onToggleDarkMode();
                        }}
                        className="h-10 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200/80 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:border-amber-500/25 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro (AMOLED)'}
                      >
                        {darkMode ? (
                          <Sun className="w-4 h-4 text-amber-400 stroke-[2.2]" />
                        ) : (
                          <Moon className="w-4 h-4 text-slate-700 stroke-[2.2]" />
                        )}
                      </button>

                      {/* 2. Sincronizar OneDrive */}
                      <button
                        type="button"
                        onClick={() => {
                          handleSyncOneDrive();
                        }}
                        disabled={isSyncing}
                        className="h-10 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200/80 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 dark:border-sky-500/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
                        title="Sincronizar OneDrive (Excel ↔ App)"
                      >
                        {isSyncing ? (
                          <RefreshCw className="w-4 h-4 text-amber-400 animate-spin stroke-[2.2]" />
                        ) : syncSuccess ? (
                          <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                        ) : (
                          <Cloud className="w-4 h-4 text-sky-400 stroke-[2.2]" />
                        )}
                      </button>

                      {/* 3. Cerrar Sesión */}
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="h-10 rounded-xl flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:border-rose-500/25 dark:text-rose-400 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title="Cerrar Sesión"
                      >
                        <LogOut className="w-4 h-4 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Desktop / Tablet Navigation Strip */}
        <div className="hidden md:block max-w-[1880px] mx-auto px-6 lg:px-8 xl:px-10 pb-2.5 pt-1 border-t border-slate-100 dark:border-zinc-900">
          <div ref={desktopNavSlide.containerRef} className="relative flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span
              aria-hidden="true"
              style={desktopNavSlide.pillStyle}
              className="pointer-events-none absolute top-0 left-0 z-0 rounded-xl bg-[#FDBA30] shadow-[0_2px_10px_rgba(253,186,48,0.35)]"
            />
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  data-slide-active={isActive ? 'true' : undefined}
                  onClick={() => {
                    setActiveTab(item.id);
                    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                    if (document.documentElement) document.documentElement.scrollTop = 0;
                    if (document.body) document.body.scrollTop = 0;
                  }}
                  className={`relative z-10 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-slate-950 font-extrabold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 stroke-[2.2] shrink-0 transition-colors ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-500 dark:text-zinc-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none transition-colors ${
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
                transition: `transform ${mobileSlideMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
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
