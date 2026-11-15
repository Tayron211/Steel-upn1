import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BellRing, X, AlertTriangle, ArrowRight } from 'lucide-react';
import Navbar from './components/Navbar';
import AttendanceView from './components/AttendanceView';
import TicketsKanban from './components/TicketsKanban';
import OperationsHub from './components/OperationsHub';
import DashboardView from './components/DashboardView';
import FloatingActionMenu from './components/FloatingActionMenu';
import MobileSignView from './components/MobileSignView';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { getAuthUser, logout, syncUsersWithServer, recordUserActivity } from './utils/auth';
import { createDbChangeGate } from './utils/webSignGate';
import {
  triggerAutoSyncLinkedExcel,
  restoreLinkedExcelIfPossible
} from './utils/liveExcelSync';
import { App as CapApp } from '@capacitor/app';
import { applyAdaptiveStatusBar, hideSplashScreenSmoothly, isCapacitorNative } from './utils/statusBarHelper';
import { initScheduleNotifier } from './utils/scheduleNotifier';
import { initAppUpdateChecker } from './utils/appUpdateChecker';
import AppUpdateModal from './components/AppUpdateModal';

const TABS = ['attendance', 'operations', 'tickets', 'dashboard'];

const TAB_HASH_MAP = {
  attendance: '#control',
  operations: '#operaciones',
  tickets: '#prestamos',
  dashboard: '#metricas'
};

const TAB_TITLES = {
  attendance: 'Control Docente · UPN Comas',
  operations: 'Operaciones · UPN Comas',
  tickets: 'Préstamos & Soporte · UPN Comas',
  dashboard: 'Métricas & Análisis · UPN Comas'
};

const HASH_TAB_MAP = {
  '#control': 'attendance',
  '#ronda': 'attendance',
  '#asistencia': 'attendance',
  '#operaciones': 'operations',
  '#operaciones/manual': 'operations',
  '#operaciones/reservas': 'operations',
  '#operaciones/ambientes': 'operations',
  '#fichas': 'operations',
  '#reservas': 'operations',
  '#ambientes': 'operations',
  '#prestamos': 'tickets',
  '#atenciones': 'tickets',
  '#tickets': 'tickets',
  '#metricas': 'dashboard',
  '#dashboard': 'dashboard'
};

export default function App() {
  const [mobileSignTicketId, setMobileSignTicketId] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const match = hash.match(/^#firmar-(.+)$/);
      if (match) return match[1];
      const params = new URLSearchParams(window.location.search);
      if (params.get('firmar')) return params.get('firmar');
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState(() => {
    const hash = (typeof window !== 'undefined' ? window.location.hash.toLowerCase() : '');
    return HASH_TAB_MAP[hash] || 'attendance';
  });
  const [tabTransition, setTabTransition] = useState(() => ({ tab: activeTab, dir: 'initial' }));
  if (tabTransition.tab !== activeTab) {
    const prevIdx = TABS.indexOf(tabTransition.tab);
    const nextIdx = TABS.indexOf(activeTab);
    const nextDir = prevIdx !== -1 && nextIdx !== -1 && nextIdx < prevIdx ? 'prev' : 'next';
    setTabTransition({ tab: activeTab, dir: nextDir });
  }
  const tabAnimClass = tabTransition.dir === 'prev' ? 'animate-slide-prev' : tabTransition.dir === 'next' ? 'animate-slide-next' : 'animate-tab-view';
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);

  // Authentication State
  const [authUser, setAuthUser] = useState(() => getAuthUser());

  useEffect(() => {
    const handleAuthChanged = () => setAuthUser(getAuthUser());
    window.addEventListener('steel:auth-changed', handleAuthChanged);
    // Sincronizar asignaciones y usuarios actualizados desde el servidor
    syncUsersWithServer().catch(() => {});
    return () => window.removeEventListener('steel:auth-changed', handleAuthChanged);
  }, []);

  const handleLogout = () => {
    logout();
    setAuthUser(null);
  };

  // Control de inactividad: Todas las sesiones se cierran tras 7 horas de su última interacción
  useEffect(() => {
    if (!authUser) return;

    // Registrar interacción inicial al cargar
    recordUserActivity();

    const onUserInteraction = () => {
      recordUserActivity();
    };

    const interactionEvents = ['click', 'touchstart', 'keydown', 'scroll', 'pointerdown'];
    interactionEvents.forEach(evt => {
      window.addEventListener(evt, onUserInteraction, { passive: true });
    });

    // Verificación periódica cada 30 segundos
    const checkInterval = setInterval(() => {
      const u = getAuthUser();
      if (!u) setAuthUser(null);
    }, 30000);

    // Verificación inmediata al volver de segundo plano o desbloquear pantalla
    const onVisibilityChange = () => {
      if (!document.hidden) {
        const u = getAuthUser();
        if (!u) setAuthUser(null);
        else recordUserActivity();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    // Listener para Capacitor en Android nativo (despertar de Doze o volver a la app)
    let appStateListener = null;
    if (isCapacitorNative()) {
      CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          const u = getAuthUser();
          if (!u) setAuthUser(null);
          else recordUserActivity();
        }
      }).then(l => { appStateListener = l; }).catch(() => {});
    }

    return () => {
      interactionEvents.forEach(evt => {
        window.removeEventListener(evt, onUserInteraction);
      });
      clearInterval(checkInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
      if (appStateListener && appStateListener.remove) {
        appStateListener.remove();
      }
    };
  }, [authUser]);

  // AMOLED Dark Mode State with Automatic Mobile System Detection
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('upn_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true;
  });

  const [shiftAlert, setShiftAlert] = useState(null);
  const [pendingRoundAlert, setPendingRoundAlert] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateModalDismissed, setUpdateModalDismissed] = useState(false);

  // Inicialización de Notificaciones, Actualizaciones y adaptación inicial de Status Bar
  useEffect(() => {
    hideSplashScreenSmoothly();
    const cleanupNotifier = initScheduleNotifier();
    const cleanupChecker = initAppUpdateChecker();

    const handleShiftAlert = (e) => {
      setShiftAlert(e.detail ? { ...e.detail.block, diff: e.detail.diff || 15 } : null);
    };
    window.addEventListener('upn:class-block-warning', handleShiftAlert);

    const handlePendingRoundAlert = (e) => {
      setPendingRoundAlert(e.detail || null);
    };
    window.addEventListener('upn:pending-attendance-alert', handlePendingRoundAlert);

    const handleUpdateAvailable = (e) => {
      // El popup SOLO debe mostrarse en la app nativa (APK), NUNCA en navegador web
      if (!isCapacitorNative()) return;
      setUpdateInfo(e.detail);
      setUpdateModalDismissed(false);
    };
    window.addEventListener('upn:app-update-available', handleUpdateAvailable);

    return () => {
      cleanupNotifier();
      cleanupChecker();
      window.removeEventListener('upn:class-block-warning', handleShiftAlert);
      window.removeEventListener('upn:pending-attendance-alert', handlePendingRoundAlert);
      window.removeEventListener('upn:app-update-available', handleUpdateAvailable);
    };
  }, []);

  // Keep DOM class and data-mode attribute synchronized + Adaptive Status Bar
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-mode', 'light');
    }
    applyAdaptiveStatusBar(darkMode);
  }, [darkMode]);

  // Real-time listener for mobile device system dark/light mode switches
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      const saved = localStorage.getItem('upn_theme');
      // If user hasn't explicitly chosen a theme via button, auto-adapt to mobile system
      if (!saved) {
        setDarkMode(e.matches);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
      return () => mediaQuery.removeListener(handleSystemThemeChange);
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('upn_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // Cross-module states
  const [newTicketPrefill, setNewTicketPrefill] = useState(null);
  const [openNewLoanModalTrigger, setOpenNewLoanModalTrigger] = useState(null);
  const [manualSheetPrefill, setManualSheetPrefill] = useState(null);
  const [operationsSubTab, setOperationsSubTab] = useState('manual');
  const [openManualModalTrigger, setOpenManualModalTrigger] = useState(null);
  const [openReservationModalTrigger, setOpenReservationModalTrigger] = useState(null);
  const [attendanceSearchPrefill, setAttendanceSearchPrefill] = useState('');

  const scrollToTopGlobal = () => {
    const doScroll = (behavior) => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior });
      } catch (_) {
        window.scrollTo(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const main = document.querySelector('main');
      if (main) main.scrollTop = 0;
      const scrollContainers = document.querySelectorAll('.overflow-y-auto, .overflow-auto');
      scrollContainers.forEach(el => { el.scrollTop = 0; });
    };

    doScroll('instant');
    requestAnimationFrame(() => doScroll('smooth'));
    setTimeout(() => doScroll('smooth'), 60);
    setTimeout(() => doScroll('instant'), 180);
    setTimeout(() => doScroll('instant'), 350);
  };

  // History & Multi-Page Hash Routing Controller
  const navigateTab = (targetTab, pushState = true) => {
    if (!TABS.includes(targetTab)) return;
    if (targetTab !== 'operations') {
      setOpenManualModalTrigger(null);
      setOpenReservationModalTrigger(null);
    }
    setActiveTab(targetTab);
    const targetHash = TAB_HASH_MAP[targetTab] || '#control';
    const title = TAB_TITLES[targetTab] || 'UPN · Control Docente & Operaciones';
    document.title = title;

    if (pushState) {
      if (window.location.hash.toLowerCase() !== targetHash) {
        window.history.pushState({ tab: targetTab }, title, targetHash);
      }
    } else {
      window.history.replaceState({ tab: targetTab }, title, targetHash);
    }
    scrollToTopGlobal();
  };

  // Cada cambio de pestaña manda inmediatamente al encabezado
  useEffect(() => {
    scrollToTopGlobal();
  }, [activeTab, operationsSubTab]);

  // Sync initial hash and handle Browser Back / Forward buttons (True Multi-Page Experience)
  useEffect(() => {
    const currentHash = window.location.hash.toLowerCase();
    const signMatch = window.location.hash.match(/^#firmar-(.+)$/);
    if (signMatch) {
      setMobileSignTicketId(signMatch[1]);
    } else {
      const initialTab = HASH_TAB_MAP[currentHash] || 'attendance';
      setActiveTab(initialTab);
      if (currentHash === '#reservas' || currentHash === '#operaciones/reservas') {
        setOperationsSubTab('reservations');
      } else if (currentHash === '#ambientes' || currentHash === '#operaciones/ambientes') {
        setOperationsSubTab('rooms');
      }
      const targetHash = TAB_HASH_MAP[initialTab] || '#control';
      const title = TAB_TITLES[initialTab] || 'UPN · Control Docente & Operaciones';
      document.title = title;
      window.history.replaceState({ tab: initialTab }, title, targetHash);
    }

    const handlePopState = (e) => {
      const currentSignMatch = window.location.hash.match(/^#firmar-(.+)$/);
      if (currentSignMatch) {
        setMobileSignTicketId(currentSignMatch[1]);
        return;
      }
      setMobileSignTicketId(null);

      // Cerrar modales si se presiona atrás
      setOpenNewLoanModalTrigger(null);
      setOpenManualModalTrigger(null);
      setOpenReservationModalTrigger(null);

      const hash = window.location.hash.toLowerCase();
      if (hash === '#reservas' || hash === '#operaciones/reservas') {
        setOperationsSubTab('reservations');
      } else if (hash === '#ambientes' || hash === '#operaciones/ambientes') {
        setOperationsSubTab('rooms');
      } else if (hash === '#operaciones' || hash === '#fichas') {
        setOperationsSubTab('manual');
      }

      const tabFromState = e.state?.tab;
      const tabFromHash = HASH_TAB_MAP[hash];
      const resolvedTab = tabFromState || tabFromHash || 'attendance';
      setActiveTab(resolvedTab);

      const title = TAB_TITLES[resolvedTab] || 'UPN · Control Docente & Operaciones';
      document.title = title;
      scrollToTopGlobal();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Multi-user silent background update for pending counter
  const dbChanged = useMemo(() => createDbChangeGate(), []);

  const updatePendingCount = async (force = false) => {
    try {
      if (!force && !(await dbChanged())) return;
      const res = await fetch('/api/tickets?active=1&count=1');
      const json = await res.json();
      if (json.success) {
        setPendingTicketsCount(json.count);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Excel de OneDrive -> App: consulta cada 30 s si el Excel fue editado directamente
  useEffect(() => {
    let stopped = false;
    const pullExcel = async () => {
      if (stopped || document.hidden) return;
      try {
        const res = await window.fetch('/api/onedrive/pull', { method: 'POST' });
        const j = await res.json();
        if (j && j.pulled) {
          window.dispatchEvent(new Event('upn:excel-pulled'));
        }
      } catch (_) { }
    };
    const first = setTimeout(pullExcel, 3000);
    const interval = setInterval(pullExcel, 30000);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  // Interceptor global para sincronizar automáticamente cada cambio en tiempo real con OneDrive
  useEffect(() => {
    restoreLinkedExcelIfPossible();
    if (typeof window === 'undefined' || window.__upnFetchIntercepted) return;
    window.__upnFetchIntercepted = true;
    const origFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      recordUserActivity();
      const res = await origFetch(...args);
      try {
        const urlStr = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const method = String(args[1]?.method || 'GET').toUpperCase();
        if (
          res.ok &&
          urlStr.includes('/api/') &&
          !urlStr.includes('/api/onedrive/') &&
          (method === 'POST' || method === 'PUT' || method === 'DELETE')
        ) {
          triggerAutoSyncLinkedExcel();
          if (urlStr.includes('/api/tickets')) updatePendingCount(true);
        }
      } catch (e) { }
      return res;
    };
  }, []);

  const handleOpenTicketFromClass = (ticketData) => {
    setNewTicketPrefill(ticketData);
    navigateTab('tickets', true);
  };

  const handleEmitManualSheetFromClass = (classData) => {
    setManualSheetPrefill(classData);
    setOperationsSubTab('manual');
    navigateTab('operations', true);
  };

  const handleSelectRoomForSchedule = (roomAbrv) => {
    setAttendanceSearchPrefill(roomAbrv);
    navigateTab('attendance', true);
  };

  const handleResetData = async () => {
    if (!confirm('¿Deseas volver a sincronizar la base de datos SQLite desde CONTROL DOCENTE.xlsx?')) {
      return;
    }
    try {
      const res = await fetch('/api/reset-excel', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert('Base de datos SQLite sincronizada correctamente desde el Excel.');
        window.location.reload();
      }
    } catch (err) {
      alert('Error al sincronizar: ' + err.message);
    }
  };

  if (mobileSignTicketId) {
    return (
      <>
        <SplashScreen minDuration={2000} />
        <MobileSignView
          ticketId={mobileSignTicketId}
          onBack={() => {
            setMobileSignTicketId(null);
            navigateTab('tickets', true);
          }}
        />
      </>
    );
  }

  // Si no hay sesión activa, mostrar la pantalla de Login con el fondo 3D UPN
  if (!authUser) {
    return (
      <>
        <SplashScreen minDuration={2200} />
        <LoginScreen onLogin={setAuthUser} />
      </>
    );
  }

  return (
    <>
      <SplashScreen minDuration={2200} />
      <div
        className="min-h-screen bg-slate-50 dark:bg-black flex flex-col text-slate-800 dark:text-zinc-100 selection:bg-amber-400 selection:text-slate-950"
      >
      {/* Top Mobile/Desktop App Header with AMOLED Mode Toggle */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => navigateTab(tab, true)}
        pendingTicketsCount={pendingTicketsCount}
        onResetData={handleResetData}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        authUser={authUser}
        onLogout={handleLogout}
      />

      {/* Main Fluid App Container - Amplio en escritorio para máxima visibilidad */}
      <main className="flex-1 max-w-[1880px] w-full mx-auto px-3 sm:px-6 lg:px-8 xl:px-10 py-3 sm:py-5 pb-32 md:pb-24 overflow-x-hidden">
        {activeTab === 'attendance' && (
          <div key="attendance" className={tabAnimClass}>
            <ErrorBoundary>
              <AttendanceView
                key={authUser?.username || 'user'}
                authUser={authUser}
                initialSearch={attendanceSearchPrefill}
                onClearInitialSearch={() => setAttendanceSearchPrefill('')}
                onOpenNewTicket={handleOpenTicketFromClass}
                onEmitManualSheet={handleEmitManualSheetFromClass}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div key="tickets" className={tabAnimClass}>
            <ErrorBoundary>
              <TicketsKanban
                initialNewTicket={newTicketPrefill}
                onClearInitialTicket={() => setNewTicketPrefill(null)}
                openModalTrigger={openNewLoanModalTrigger}
                onConsumeModalTrigger={() => setOpenNewLoanModalTrigger(null)}
                onPendingCountChange={setPendingTicketsCount}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'operations' && (
          <div key="operations" className={tabAnimClass}>
            <ErrorBoundary>
              <OperationsHub
                initialClassData={manualSheetPrefill}
                onClearInitialClass={() => setManualSheetPrefill(null)}
                onSelectRoomForSchedule={handleSelectRoomForSchedule}
                defaultSubTab={operationsSubTab}
                openManualModalTrigger={openManualModalTrigger}
                openReservationModalTrigger={openReservationModalTrigger}
                onConsumeManualModalTrigger={() => setOpenManualModalTrigger(null)}
                onConsumeReservationModalTrigger={() => setOpenReservationModalTrigger(null)}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div key="dashboard" className={tabAnimClass}>
            <ErrorBoundary>
              <DashboardView />
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* Alerta Visual Flotante de Cambio de Turno (15 min antes) */}
      {shiftAlert && (
        <div className="fixed top-[calc(env(safe-area-inset-top,0px)+4.75rem)] sm:top-20 right-3 sm:right-6 z-[99999] max-w-sm sm:max-w-md w-[calc(100%-1.5rem)] pointer-events-auto transition-all duration-300">
          <div className="bg-white/95 dark:bg-black/95 text-slate-900 dark:text-zinc-100 p-3.5 rounded-2xl border border-amber-300/80 dark:border-amber-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(253,186,48,0.20)] flex items-start justify-between gap-3 backdrop-blur-xl">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-[#FDBA30] border border-amber-500/20 dark:border-amber-400/30 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <BellRing className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-upn font-black uppercase tracking-wider bg-amber-500/10 dark:bg-amber-400/15 text-amber-800 dark:text-[#FDBA30] border border-amber-500/20 dark:border-amber-400/30 mb-1">
                  <span>Próximo Turno</span>
                  <span>•</span>
                  <span>En {shiftAlert.diff || 15} min</span>
                </div>
                <div className="font-upn font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 tracking-tight leading-snug">
                  Bloque <span className="text-amber-700 dark:text-[#FDBA30] font-black underline underline-offset-2 decoration-amber-400/50">{shiftAlert.label}</span> (Inicia {shiftAlert.start})
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5 leading-normal">
                  Prepara la ronda y verificación de asistencia docente.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShiftAlert(null)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 p-1.5 rounded-xl transition cursor-pointer shrink-0"
              title="Cerrar notificación"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      {/* Alerta Visual Flotante de Mitad de Ronda: Aulas Pendientes */}
      {pendingRoundAlert && (
        <div className="fixed top-[calc(env(safe-area-inset-top,0px)+5.25rem)] sm:top-24 right-3 sm:right-6 z-[99999] max-w-sm sm:max-w-md w-[calc(100%-1.5rem)] pointer-events-auto transition-all duration-300">
          <div className="bg-white/95 dark:bg-black/95 text-slate-900 dark:text-zinc-100 p-3.5 sm:p-4 rounded-2xl border border-amber-300/80 dark:border-amber-400/40 shadow-[0_12px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(253,186,48,0.22)] flex items-start justify-between gap-3 backdrop-blur-xl">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/15 text-amber-600 dark:text-[#FDBA30] border border-amber-500/20 dark:border-amber-400/30 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-upn font-black uppercase tracking-wider bg-amber-500/10 dark:bg-amber-400/15 text-amber-800 dark:text-[#FDBA30] border border-amber-500/20 dark:border-amber-400/30 mb-1">
                  <span>Mitad de Ronda</span>
                  <span>•</span>
                  <span>{pendingRoundAlert.block}</span>
                </div>
                <div className="font-upn font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 tracking-tight leading-snug">
                  {pendingRoundAlert.pendingCount} aula(s) pendientes:{' '}
                  <span className="text-amber-700 dark:text-[#FDBA30] font-black underline underline-offset-2 decoration-amber-400/50">
                    {pendingRoundAlert.aulas}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5 leading-normal">
                  Recuerda registrar: Puntual, Tarde o Falta
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingRoundAlert(null);
                    navigateTab('attendance', true);
                    window.dispatchEvent(new CustomEvent('upn:filter-pending-rooms'));
                  }}
                  className="mt-2.5 h-8 px-3.5 rounded-xl bg-[#FDBA30] hover:bg-[#e29b12] dark:bg-[#FDBA30] dark:hover:bg-[#ffc654] text-black font-upn font-bold text-xs shadow-xs hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Ver Aulas Pendientes</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingRoundAlert(null)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/80 p-1.5 rounded-xl transition cursor-pointer shrink-0"
              title="Cerrar recordatorio"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      {/* Popup de Actualización de APK Nativa - SOLO en la App Nativa (APK Android) */}
      {isCapacitorNative() && (
        <AppUpdateModal
          updateInfo={updateModalDismissed ? null : updateInfo}
          onClose={() => setUpdateModalDismissed(true)}
        />
      )}

      {/* Floating Action Speed Dial (FAB) visible en todas las páginas */}
      <FloatingActionMenu
        onOpenManualSheet={() => {
          setOperationsSubTab('manual');
          navigateTab('operations', true);
          setOpenManualModalTrigger(Date.now());
          scrollToTopGlobal();
        }}
        onOpenNewTicket={() => {
          navigateTab('tickets', true);
          setOpenNewLoanModalTrigger(Date.now());
          scrollToTopGlobal();
        }}
        onOpenReservation={() => {
          setOperationsSubTab('reservations');
          navigateTab('operations', true);
          setOpenReservationModalTrigger(Date.now());
          scrollToTopGlobal();
        }}
      />
    </div>
    </>
  );
}
