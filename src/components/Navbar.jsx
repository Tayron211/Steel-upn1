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
  ChevronDown,
  Download,
  Smartphone,
  Share,
  Sparkles,
  RotateCw,
  CheckCircle2,
  ShieldCheck,
  X
} from 'lucide-react';
import AdminControlModal from './AdminControlModal';
import { checkAppVersion, APP_CURRENT_VERSION, triggerDirectApkInstall } from '../utils/appUpdateChecker';
import { isCapacitorNative } from '../utils/statusBarHelper';
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

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [updateStatusModal, setUpdateStatusModal] = useState(null);
  const updateModalFade = useFadeModal(Boolean(isCapacitorNative() && updateStatusModal), () => setUpdateStatusModal(null), 200);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [isAdminControlOpen, setIsAdminControlOpen] = useState(false);

  useEffect(() => {
    const isIosDevice = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIos(isIosDevice);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowIosModal(true);
    }
  };

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
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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
                    authUser?.role === 'admin'
                      ? userMenuOpen
                        ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 ring-2 ring-amber-400/30'
                        : 'bg-amber-50 hover:bg-amber-100/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-amber-200/80 dark:border-zinc-800 text-amber-950 dark:text-zinc-100'
                      : userMenuOpen
                        ? 'bg-sky-100 dark:bg-sky-950/80 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-200 ring-2 ring-sky-400/30'
                        : 'bg-sky-50 hover:bg-sky-100/80 dark:bg-sky-950/30 dark:hover:bg-sky-900/50 border-sky-200/80 dark:border-sky-800/60 text-sky-950 dark:text-sky-200'
                  }`}
                  title="Opciones de cuenta y sistema"
                >
                  <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                    authUser?.role === 'admin' ? 'bg-amber-500' : 'bg-sky-500'
                  }`} />
                  <span className="text-xs font-bold font-mono tracking-tight max-w-[100px] sm:max-w-[150px] truncate uppercase">
                    {authUser?.name || authUser?.displayName || 'Asistente'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 shrink-0 ${
                    authUser?.role === 'admin'
                      ? 'text-amber-700 dark:text-zinc-400'
                      : 'text-sky-700 dark:text-sky-300'
                  } ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Menú Desplegable: Acciones Rápidas + Descargas */}
                {userMenuFade.shouldRender && (
                  <div className={`absolute right-0 mt-2 w-68 rounded-2xl bg-white dark:bg-[#0c0c0e] border border-slate-200/90 dark:border-zinc-800 shadow-2xl p-2.5 z-50 ${userMenuFade.dropdownClass}`}>
                    {/* Cabecera del Usuario */}
                    <div className="px-1.5 pb-2 border-b border-slate-100 dark:border-zinc-800/80 mb-2">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate uppercase">
                        {authUser?.name || authUser?.displayName}
                      </div>
                      <div className={`text-[10px] font-mono font-semibold uppercase mt-0.5 ${
                        authUser?.role === 'admin'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-sky-600 dark:text-sky-400'
                      }`}>
                        {authUser?.role === 'admin' ? 'Modo Administrador' : 'Modo Asistente'} • Comas
                      </div>
                    </div>

                    {/* Botón Destacado Panel Admin si es Administrador */}
                    {authUser?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setIsAdminControlOpen(true);
                        }}
                        className="w-full mb-2 h-9 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-950 dark:text-amber-300 flex items-center justify-center gap-2 text-xs font-black transition active:scale-95 cursor-pointer shadow-2xs"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-500 stroke-[2.4]" />
                        <span>Panel de Control Admin</span>
                      </button>
                    )}

                    {/* Fila de Iconos de Acciones */}
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

                    {/* Sección de Instalación & Descargas (Ultra-Compacto) */}
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Descargar e Instalar APK Android */}
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            triggerDirectApkInstall();
                          }}
                          className="h-8 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200/90 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 flex items-center justify-center gap-1.5 transition active:scale-95 text-[11px] font-extrabold shadow-2xs group cursor-pointer"
                          title="Descargar e Instalar APK Nativo para Android"
                        >
                          <AndroidIcon className="w-3.5 h-3.5 text-[#3DDC84] shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="truncate">APK Android</span>
                        </button>

                        {/* Instalar WebApp / PWA (Apple) */}
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            handleInstallPwa();
                          }}
                          className="h-8 px-2 rounded-xl bg-slate-100 hover:bg-slate-200/90 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 border border-slate-200/90 dark:border-zinc-800 text-slate-900 dark:text-white flex items-center justify-center gap-1.5 transition active:scale-95 text-[11px] font-extrabold shadow-2xs cursor-pointer group"
                          title="Instalar WebApp en Apple iOS (iPhone / iPad) o Safari"
                        >
                          <AppleIcon className="w-3.5 h-3.5 text-slate-900 dark:text-white shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="truncate">WebApp Apple</span>
                        </button>
                      </div>

                      {/* Buscar Actualización (Línea Delgada) - SOLO VISIBLE EN APK NATIVA */}
                      {isCapacitorNative() && (
                        <button
                          type="button"
                          disabled={checkingUpdate}
                          onClick={async () => {
                            setUserMenuOpen(false);
                            setCheckingUpdate(true);
                            try {
                              const res = await checkAppVersion(true);
                              if (res && !res.isAvailable) {
                                setUpdateStatusModal({
                                  type: 'up-to-date',
                                  version: res.currentVersion,
                                  build: res.currentBuild,
                                  isNative: res.isNative
                                });
                              }
                            } finally {
                              setCheckingUpdate(false);
                            }
                          }}
                          className="w-full flex items-center justify-between px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 text-[10.5px] font-medium transition active:scale-95 cursor-pointer group disabled:opacity-50"
                        >
                          <div className="flex items-center gap-1.5">
                            <RotateCw className={`w-3 h-3 text-amber-500 shrink-0 ${checkingUpdate ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
                            <span>{checkingUpdate ? 'Verificando...' : 'Buscar actualización'}</span>
                          </div>
                          <span className="font-mono text-[9.5px] text-slate-400 dark:text-zinc-500 font-semibold">v{APP_CURRENT_VERSION}</span>
                        </button>
                      )}
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
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    if (document.documentElement) document.documentElement.scrollTop = 0;
                    if (document.body) document.body.scrollTop = 0;
                  }}
                  className={`relative z-10 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer ${isActive
                    ? desktopNavSlide.pillStyle.opacity === 0
                      ? 'bg-[#FDBA30] text-slate-950 font-extrabold shadow-[0_2px_10px_rgba(253,186,48,0.35)]'
                      : 'text-slate-950 font-extrabold'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Icon className={`w-4 h-4 stroke-[2.2] shrink-0 transition-colors ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-500 dark:text-zinc-400'}`} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none transition-colors ${isActive ? 'bg-slate-950 text-[#FDBA30]' : 'bg-rose-500 text-white'
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

      {/* Floating Bottom App Dock con efecto Blur de Cristal Esmerilado Ultra Traslúcido (Móvil/APK) */}
      <div className="md:hidden fixed bottom-4 sm:bottom-6 inset-x-4 z-[9990] max-w-sm sm:max-w-md mx-auto pointer-events-none safe-bottom">
        <div
          className="relative pointer-events-auto rounded-[28px] bg-white/40 dark:bg-black/40 supports-[backdrop-filter]:bg-white/30 dark:supports-[backdrop-filter]:bg-black/35 backdrop-blur-3xl backdrop-saturate-200 border border-white/50 dark:border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_44px_rgba(0,0,0,0.7)]"
          style={{
            backdropFilter: 'blur(34px) saturate(200%)',
            WebkitBackdropFilter: 'blur(34px) saturate(200%)'
          }}
        >
          {/* Sutil resplandor de borde interior tipo cristal */}
          <div className="absolute inset-0 rounded-[28px] ring-1 ring-inset ring-white/30 dark:ring-white/10 pointer-events-none" />

          {/* Contenedor interactivo con pestañas y slider (con overflow-hidden para recorte perfecto) */}
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
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    if (document.documentElement) document.documentElement.scrollTop = 0;
                    if (document.body) document.body.scrollTop = 0;
                  }}
                  className="relative z-10 flex flex-col items-center justify-center py-2 px-1 rounded-[22px] transition-all duration-200 active:scale-95"
                >
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${isActive
                      ? 'text-slate-950 stroke-[2.6] scale-110 drop-shadow-xs'
                      : 'text-slate-800 dark:text-zinc-100 hover:text-slate-950 dark:hover:text-white stroke-[2.2]'
                      }`}
                  />
                  <span
                    className={`text-[10px] mt-0.5 tracking-tight transition-all duration-200 ${isActive
                      ? 'font-black text-slate-950'
                      : 'font-bold text-slate-800 dark:text-zinc-100 hover:text-slate-950 dark:hover:text-white'
                      }`}
                  >
                    {item.label}
                  </span>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`absolute top-0.5 right-2 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-black transition-all duration-200 shadow-xs ring-1 ring-white/70 ${isActive
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

      <AdminControlModal
        isOpen={isAdminControlOpen}
        onClose={() => setIsAdminControlOpen(false)}
        authUser={authUser}
      />

      <OneDriveSyncModal
        isOpen={showOneDriveModal}
        onClose={() => setShowOneDriveModal(false)}
        liveExcel={liveExcel}
      />

      {/* Modal Instructivo para Instalación en iOS Safari */}
      {showIosModal && (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#101014] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-900 dark:text-white">
                  <AppleIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Instalar en iOS</h3>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">iPhone & iPad (Safari)</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <div>En Safari, pulsa el botón <strong>Compartir</strong> <Share className="w-3.5 h-3.5 inline mx-1 text-sky-500 stroke-[2.5]" /> en la barra inferior del navegador.</div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <div>Desplázate por el menú y selecciona <strong>"Añadir a pantalla de inicio"</strong>.</div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                <div>Pulsa <strong>Añadir</strong> en la esquina superior derecha. ¡Listo! Se abrirá como app nativa con notificaciones activas.</div>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#FDBA30] hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition active:scale-95 cursor-pointer shadow-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal estilizado UPN para estado de actualización - SOLO EN APK NATIVA con FADE */}
      {isCapacitorNative() && updateModalFade.shouldRender && createPortal(
        <div
          className={`fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none ${updateModalFade.backdropClass}`}
          onClick={() => updateModalFade.requestClose()}
        >
          <div
            className={`bg-white dark:bg-[#0c0c10] border-2 border-emerald-500/80 dark:border-emerald-500/60 rounded-2xl p-4 sm:p-5 max-w-xs w-full shadow-[0_16px_50px_rgba(16,185,129,0.25)] space-y-3.5 animate-scale-up text-center ${updateModalFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700/60 inline-block">
                Sistema al Día
              </span>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                Aplicación al Día
              </h3>
            </div>

            <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200/90 dark:border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>v{updateStatusModal?.version || APP_CURRENT_VERSION} (Build {updateStatusModal?.build || 1})</span>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed px-1">
              Cuentas con la última versión oficial instalada. Todas las funciones de control y sincronización están activas.
            </p>

            <button
              type="button"
              onClick={() => updateModalFade.requestClose()}
              className="w-full h-9 rounded-xl bg-[#FDBA30] hover:bg-amber-400 text-slate-950 font-black text-xs tracking-tight transition active:scale-95 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Ícono Oficial Vectorial de Android (Google / Simple Icons)
function AndroidIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className} 
      aria-hidden="true"
    >
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.996-3.4572c.1065-.1846.043-.4207-.1416-.5272-.1846-.1066-.4207-.0431-.5272.1415l-2.0238 3.5054C15.5866 8.3582 13.8569 8 12 8s-3.5866.3582-5.1849.9839L4.7913 5.4785c-.1065-.1846-.3426-.2481-.5272-.1415-.1846.1065-.2481.3426-.1416.5272l1.996 3.4572C2.6883 11.1867.3433 14.6589 0 18.7778h24c-.3433-4.1189-2.6883-7.5911-6.1185-9.4564" />
    </svg>
  );
}

// Ícono Oficial Vectorial de Apple (Simple Icons)
function AppleIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className} 
      aria-hidden="true"
    >
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.77 1.06-1.85.94-2.93-1 .04-2.16.67-2.84 1.46-.59.68-1.12 1.77-.98 2.83 1.12.09 2.25-.59 2.88-1.36" />
    </svg>
  );
}
