import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BellRing, X } from 'lucide-react';
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
import { getAuthUser, logout } from './utils/auth';
import { createDbChangeGate } from './utils/webSignGate';
import {
  triggerAutoSyncLinkedExcel,
  restoreLinkedExcelIfPossible
} from './utils/liveExcelSync';
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
    return () => window.removeEventListener('steel:auth-changed', handleAuthChanged);
  }, []);

  const handleLogout = () => {
    logout();
    setAuthUser(null);
  };

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
  const [updateInfo, setUpdateInfo] = useState(null);
  const [updateModalDismissed, setUpdateModalDismissed] = useState(false);

  // Inicialización de Notificaciones, Actualizaciones y adaptación inicial de Status Bar
  useEffect(() => {
    hideSplashScreenSmoothly();
    const cleanupNotifier = initScheduleNotifier();
    const cleanupChecker = initAppUpdateChecker();

    const handleShiftAlert = (e) => {
      setShiftAlert(e.detail?.block);
    };
    window.addEventListener('upn:class-block-warning', handleShiftAlert);

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

      {/* Alerta Visual Flotante de Cambio de Turno (10 min antes) */}
      {shiftAlert && (
        <div className="fixed top-[calc(env(safe-area-inset-top,0px)+4.75rem)] sm:top-20 right-3 sm:right-6 z-[99999] max-w-sm sm:max-w-md w-[calc(100%-1.5rem)] animate-bounce-short shadow-2xl pointer-events-auto">
          <div className="bg-amber-400 text-slate-950 p-3.5 rounded-2xl border-2 border-amber-300 shadow-xl flex items-start justify-between gap-3 backdrop-blur-md">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-slate-950 text-[#FDBA30] rounded-xl shrink-0 mt-0.5 shadow-xs">
                <BellRing className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-tight text-slate-950">
                  Próximo Cambio de Turno en 10 min
                </div>
                <div className="text-xs font-black mt-0.5 text-slate-950 leading-snug">
                  Bloque <span className="underline">{shiftAlert.label}</span> (Inicia {shiftAlert.start})
                </div>
                <div className="text-[10px] text-slate-900 font-semibold mt-0.5">
                  Prepara la ronda y verificación de asistencia docente.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShiftAlert(null)}
              className="text-slate-950 hover:bg-slate-950/10 p-1 rounded-lg transition cursor-pointer"
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
