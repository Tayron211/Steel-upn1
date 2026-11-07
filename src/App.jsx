import React, { useState, useEffect, useRef, useMemo } from 'react';
import Navbar from './components/Navbar';
import AttendanceView from './components/AttendanceView';
import TicketsKanban from './components/TicketsKanban';
import OperationsHub from './components/OperationsHub';
import DashboardView from './components/DashboardView';
import FloatingActionMenu from './components/FloatingActionMenu';
import MobileSignView from './components/MobileSignView';
import ErrorBoundary from './components/ErrorBoundary';
import { createDbChangeGate } from './utils/webSignGate';
import {
  triggerAutoSyncLinkedExcel,
  restoreLinkedExcelIfPossible
} from './utils/liveExcelSync';

const TABS = ['attendance', 'operations', 'tickets', 'dashboard'];

const TAB_HASH_MAP = {
  attendance: '#ronda',
  tickets: '#prestamos',
  operations: '#operaciones',
  dashboard: '#metricas'
};

const HASH_TAB_MAP = {
  '#ronda': 'attendance',
  '#asistencia': 'attendance',
  '#prestamos': 'tickets',
  '#atenciones': 'tickets',
  '#tickets': 'tickets',
  '#operaciones': 'operations',
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
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);

  // AMOLED Dark Mode State with LocalStorage Persistence
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('upn_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('upn_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('upn_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // Cross-module states
  const [newTicketPrefill, setNewTicketPrefill] = useState(null);
  const [manualSheetPrefill, setManualSheetPrefill] = useState(null);
  const [operationsSubTab, setOperationsSubTab] = useState('manual');
  const [openManualModalTrigger, setOpenManualModalTrigger] = useState(null);
  const [openReservationModalTrigger, setOpenReservationModalTrigger] = useState(null);
  const [attendanceSearchPrefill, setAttendanceSearchPrefill] = useState('');

  // Touch Swipe Gesture State
  const touchRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isIgnored: false
  });

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
    const targetHash = TAB_HASH_MAP[targetTab] || '#ronda';
    if (pushState) {
      window.history.pushState({ tab: targetTab }, '', targetHash);
    } else {
      window.history.replaceState({ tab: targetTab }, '', targetHash);
    }
    // Siempre mandar al encabezado superior
    scrollToTopGlobal();
  };

  // Cada cambio de pestaña manda inmediatamente al encabezado
  useEffect(() => {
    scrollToTopGlobal();
  }, [activeTab, operationsSubTab]);

  // Sync initial hash and handle Browser Back / Forward buttons (Multi-page experience)
  useEffect(() => {
    const currentHash = window.location.hash.toLowerCase();
    const signMatch = window.location.hash.match(/^#firmar-(.+)$/);
    if (signMatch) {
      setMobileSignTicketId(signMatch[1]);
    } else {
      const initialTab = HASH_TAB_MAP[currentHash] || 'attendance';
      setActiveTab(initialTab);
      window.history.replaceState({ tab: initialTab }, '', TAB_HASH_MAP[initialTab]);
    }

    const handlePopState = (e) => {
      const currentSignMatch = window.location.hash.match(/^#firmar-(.+)$/);
      if (currentSignMatch) {
        setMobileSignTicketId(currentSignMatch[1]);
        return;
      }
      setMobileSignTicketId(null);
      const tabFromState = e.state?.tab;
      const tabFromHash = HASH_TAB_MAP[window.location.hash.toLowerCase()];
      const resolvedTab = tabFromState || tabFromHash || 'attendance';
      setActiveTab(resolvedTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Multi-user silent background update for pending counter
  const dbChanged = useMemo(() => createDbChangeGate(), []);

  const updatePendingCount = async (force = false) => {
    try {
      if (!force && !(await dbChanged())) return; // sin escrituras nuevas -> no gastar lecturas de D1
      const res = await fetch('/api/tickets?estado=PENDIENTE&count=1');
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

  // Excel de OneDrive -> App: consulta cada 30 s si el Excel fue editado directamente y trae los cambios
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
      } catch (_) {}
    };
    const first = setTimeout(pullExcel, 3000);
    const interval = setInterval(pullExcel, 30000);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);

  // Interceptor global para sincronizar automáticamente cada cambio en tiempo real con el Excel de OneDrive vinculado
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
          // Solo los cambios de tickets alteran el contador de pendientes
          if (urlStr.includes('/api/tickets')) updatePendingCount(true);
        }
      } catch (e) {}
      return res;
    };
  }, []);

  // Mobile Touch Swipe Handlers (Swipe left/right between tabs)
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const touch = e.touches[0];

    // Detect if gesture originates inside horizontally scrollable container, canvas, input, or modal
    let target = e.target;
    let isIgnored = false;
    while (target && target !== document.body) {
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'CANVAS' ||
        target.closest?.('canvas') ||
        target.classList.contains('overflow-x-auto') ||
        target.getAttribute('role') === 'dialog' ||
        target.classList.contains('apple-liquid-modal') ||
        target.closest?.('[role="dialog"]') ||
        target.closest?.('.fixed')
      ) {
        isIgnored = true;
        break;
      }
      try {
        const style = window.getComputedStyle(target);
        if (
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          target.scrollWidth > target.clientWidth
        ) {
          isIgnored = true;
          break;
        }
      } catch (err) {}
      target = target.parentElement;
    }

    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isIgnored
    };
  };

  const handleTouchEnd = (e) => {
    // Si se tocó un canvas, modal, input, o si hay un canvas en pantalla, nunca cambiar de pestaña
    if (touchRef.current.isIgnored || !e.changedTouches || e.changedTouches.length !== 1) return;
    if (typeof document !== 'undefined' && (document.querySelector('canvas') || document.querySelector('[role="dialog"]'))) {
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;
    const elapsed = Date.now() - touchRef.current.startTime;

    // Gesture criteria: Fast swipe (< 600ms), displacement > 60px, predominantly horizontal
    if (elapsed < 600 && Math.abs(deltaX) >= 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      const currentIndex = TABS.indexOf(activeTab);
      if (deltaX < -60 && currentIndex < TABS.length - 1) {
        // Swipe left -> advance to next tab
        navigateTab(TABS[currentIndex + 1], true);
      } else if (deltaX > 60 && currentIndex > 0) {
        // Swipe right -> go to previous tab
        navigateTab(TABS[currentIndex - 1], true);
      }
    }
  };

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
      <MobileSignView
        ticketId={mobileSignTicketId}
        onBack={() => {
          setMobileSignTicketId(null);
          navigateTab('tickets', true);
        }}
      />
    );
  }

  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-black flex flex-col text-slate-800 dark:text-zinc-100 selection:bg-amber-400 selection:text-slate-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Mobile/Desktop App Header with AMOLED Mode Toggle */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => navigateTab(tab, true)}
        pendingTicketsCount={pendingTicketsCount}
        onResetData={handleResetData}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Main Fluid App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-5 pb-32 md:pb-24">
        {activeTab === 'attendance' && (
          <div key="attendance" className="animate-tab-view">
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
          <div key="tickets" className="animate-tab-view">
            <ErrorBoundary>
              <TicketsKanban
                initialNewTicket={newTicketPrefill}
                onClearInitialTicket={() => setNewTicketPrefill(null)}
              />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'operations' && (
          <div key="operations" className="animate-tab-view">
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
          <div key="dashboard" className="animate-tab-view">
            <ErrorBoundary>
              <DashboardView />
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* Floating Action Speed Dial (FAB) visible en todas las páginas */}
      <FloatingActionMenu
        onOpenManualSheet={() => {
          setOperationsSubTab('manual');
          setOpenManualModalTrigger(Date.now());
          navigateTab('operations', true);
          scrollToTopGlobal();
        }}
        onOpenNewTicket={() => {
          setNewTicketPrefill({
            ambiente: '',
            pabellon: 'A',
            piso: '1ER PISO',
            tipoSolicitud: 'PLUMONES / MATERIALES',
            descripcionSolucion: 'Préstamo de plumones y mota acrílica',
            _ts: Date.now()
          });
          navigateTab('tickets', true);
          scrollToTopGlobal();
        }}
        onOpenReservation={() => {
          setOperationsSubTab('reservations');
          setOpenReservationModalTrigger(Date.now());
          navigateTab('operations', true);
          scrollToTopGlobal();
        }}
      />
    </div>
  );
}
