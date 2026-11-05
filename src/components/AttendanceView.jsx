import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  UserCheck, 
  AlertTriangle, 
  HandHelping, 
  CheckCheck, 
  FileText, 
  X, 
  CalendarClock, 
  Building, 
  RotateCcw, 
  Sparkles, 
  Check,
  DoorOpen,
  Users,
  Monitor,
  PenTool,
  Cable,
  Package,
  Layers,
  MoreVertical
} from 'lucide-react';

export default function AttendanceView({ onOpenNewTicket, onEmitManualSheet, initialSearch = '', onClearInitialSearch }) {
  const [data, setData] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auto-detect current day in Spanish
  const daysOfWeek = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const todayDefault = daysOfWeek[new Date().getDay()];

  // Filter states
  const [selectedDia, setSelectedDia] = useState(todayDefault);
  const [selectedPabellon, setSelectedPabellon] = useState('');
  const [selectedPiso, setSelectedPiso] = useState('');
  const [selectedHora, setSelectedHora] = useState('');
  const [blockMode, setBlockMode] = useState('ALL'); // 'ALL' | 'CURRENT' | 'NEXT'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PUNTUAL' | 'TARDE' | 'FALTA'
  const [viewMode, setViewMode] = useState('CLASSES'); // 'CLASSES' | 'FREE_ROOMS'
  const [search, setSearch] = useState(initialSearch || '');

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      if (onClearInitialSearch) onClearInitialSearch();
    }
  }, [initialSearch]);

  // In-situ Quick Attention Bottom Sheet (Saves 80% time by recording loan right here!)
  const [quickAttentionItem, setQuickAttentionItem] = useState(null);
  const [quickAttentionBeneficiary, setQuickAttentionBeneficiary] = useState('DOCENTE');
  const [quickAttentionTipo, setQuickAttentionTipo] = useState('PLUMONES / MATERIALES');
  const [quickAttentionNotes, setQuickAttentionNotes] = useState('');
  const [quickAttentionStatus, setQuickAttentionStatus] = useState('EN PROCESO'); // 'PENDIENTE' | 'EN PROCESO' | 'ATENDIDO'
  const [toastMessage, setToastMessage] = useState('');

  // Observation Modal
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [observationText, setObservationText] = useState('');
  const [replaceTeacherName, setReplaceTeacherName] = useState('');

  // Secondary Classroom Action Sheet (Discreet 3-dots menu)
  const [selectedClassOptions, setSelectedClassOptions] = useState(null);

  const pisosDisponibles = [
    { label: 'Todos', short: 'Todos', val: '' },
    { label: 'Sótano', short: 'Sót', val: 'SOT' },
    { label: 'Piso 1', short: 'P1', val: '1ER PISO' },
    { label: 'Piso 2', short: 'P2', val: '2DO PISO' },
    { label: 'Piso 3', short: 'P3', val: '3ER PISO' },
    { label: 'Piso 4', short: 'P4', val: '4TO PISO' },
    { label: 'Piso 5', short: 'P5', val: '5TO PISO' }
  ];

  // Quick Loan Chips for Attention Drawer
  const commonLoanChips = [
    { label: "🖊️ Plumones y Mota", tipo: "PLUMONES / MATERIALES", desc: "Entrega de plumones y mota de acrílico" },
    { label: "🔌 Cable HDMI / Extensión", tipo: "CABLES / ADAPTADORES", desc: "Préstamo de cable HDMI y extensión eléctrica" },
    { label: "🖱️ Mouse / Teclado / Puntero", tipo: "PC / PERIFERICOS", desc: "Préstamo de periférico para clase" },
    { label: "📽️ Control Proyector / Encendido", tipo: "PROYECCIÓN", desc: "Entrega de control remoto y encendido de proyector" },
    { label: "🚪 Apertura de Aula", tipo: "APERTURA DE AMBIENTE", desc: "Desbloqueo y apertura de aula por inicio de sesión" }
  ];

  // Official UPN Class Blocks matching SQLite CONTROL DOCENTE
  const REAL_BLOCKS = [
    { start: '07:30', end: '09:10', startM: 7 * 60 + 30, endM: 9 * 60 + 10 },
    { start: '09:10', end: '10:50', startM: 9 * 60 + 10, endM: 10 * 60 + 50 },
    { start: '10:50', end: '12:30', startM: 10 * 60 + 50, endM: 12 * 60 + 30 },
    { start: '12:30', end: '14:30', startM: 12 * 60 + 30, endM: 14 * 60 + 30 },
    { start: '14:30', end: '16:10', startM: 14 * 60 + 30, endM: 16 * 60 + 10 },
    { start: '16:10', end: '17:50', startM: 16 * 60 + 10, endM: 17 * 60 + 50 },
    { start: '17:50', end: '19:30', startM: 17 * 60 + 50, endM: 19 * 60 + 30 },
    { start: '19:30', end: '21:10', startM: 19 * 60 + 30, endM: 21 * 60 + 10 },
    { start: '21:10', end: '22:50', startM: 21 * 60 + 10, endM: 22 * 60 + 50 }
  ];

  const getCurrentHourBlock = () => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const matched = REAL_BLOCKS.find(b => currentMins >= b.startM && currentMins < b.endM);
    if (matched) return matched.start;
    if (currentMins < 7 * 60 + 30) return '07:30';
    if (currentMins >= 14 * 60 && currentMins < 14 * 60 + 30) return '14:30';
    if (currentMins >= 19 * 60 + 30 && currentMins < 21 * 60 + 10) return '19:30';
    if (currentMins >= 21 * 60 + 10) return '21:10';
    return '19:30';
  };

  const getNextHourBlock = () => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const next = REAL_BLOCKS.find(b => b.startM > currentMins);
    return next ? next.start : REAL_BLOCKS[0].start;
  };

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDia) params.append('dia', selectedDia);
      if (selectedPabellon) params.append('pabellon', selectedPabellon);
      if (selectedPiso) params.append('piso', selectedPiso);
      
      const effectiveHora = blockMode === 'CURRENT' 
        ? getCurrentHourBlock() 
        : blockMode === 'NEXT' 
          ? getNextHourBlock() 
          : selectedHora;
      if (effectiveHora) params.append('hora', effectiveHora);
      if (search) params.append('search', search);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // Multi-user silent background polling (keeps records synced without interrupting user)
  const silentRefreshAttendance = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDia) params.append('dia', selectedDia);
      if (selectedPabellon) params.append('pabellon', selectedPabellon);
      if (selectedPiso) params.append('piso', selectedPiso);
      
      const effectiveHora = blockMode === 'CURRENT' 
        ? getCurrentHourBlock() 
        : blockMode === 'NEXT' 
          ? getNextHourBlock() 
          : selectedHora;
      if (effectiveHora) params.append('hora', effectiveHora);
      if (search) params.append('search', search);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      // silent
    }
  };

  const loadRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const json = await res.json();
      if (json.success) {
        setRooms(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (quickAttentionItem) setQuickAttentionItem(null);
        if (activeModalItem) setActiveModalItem(null);
        if (selectedClassOptions) setSelectedClassOptions(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickAttentionItem, activeModalItem, selectedClassOptions]);

  useEffect(() => {
    loadAttendance();
    const interval = setInterval(silentRefreshAttendance, 3000);
    return () => clearInterval(interval);
  }, [selectedDia, selectedPabellon, selectedPiso, selectedHora, blockMode, search]);

  const getCurrentTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 1-Tap Toggle Status Handler (If already active, resets to PENDIENTE for instant undo!)
  const handleQuickStatus = async (item, targetStatus) => {
    const isCurrentlyActive = 
      (targetStatus === 'PUNTUAL' && item.puntualidad === 'PUNTUAL') ||
      (targetStatus === 'TARDE' && item.puntualidad === 'TARDE') ||
      (targetStatus === 'FALTA' && item.asistencia === 'NO');

    let updates = {};

    if (isCurrentlyActive) {
      // Toggle off -> Reset back to PENDIENTE
      updates = {
        asistencia: 'PENDIENTE',
        puntualidad: '',
        horaInicioReal: '',
        horaFinalReal: ''
      };
    } else if (targetStatus === 'PUNTUAL') {
      const timeNow = getCurrentTimeStr();
      updates = {
        asistencia: 'SI',
        puntualidad: 'PUNTUAL',
        horaInicioReal: item.horaInicioReal || timeNow,
        horaFinalReal: item.horaFinalProg || item.horaFinalReal
      };
    } else if (targetStatus === 'TARDE') {
      const timeNow = getCurrentTimeStr();
      updates = {
        asistencia: 'SI',
        puntualidad: 'TARDE',
        horaInicioReal: timeNow,
        horaFinalReal: item.horaFinalProg || item.horaFinalReal
      };
    } else if (targetStatus === 'FALTA') {
      updates = {
        asistencia: 'NO',
        puntualidad: '-',
        horaInicioReal: '',
        horaFinalReal: ''
      };
    }

    setData(prev => prev.map(c => (c.id === item.id ? { ...c, ...updates } : c)));

    try {
      await fetch(`/api/attendance/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Fast In-Situ Attention Recording (2 Taps!)
  const handleSaveQuickAttention = async (e) => {
    if (e) e.preventDefault();
    if (!quickAttentionItem) return;

    const personTag = quickAttentionBeneficiary === 'ALUMNO' 
      ? '[🎓 ALUMNO]' 
      : `[👨‍🏫 DOCENTE: ${quickAttentionItem.docente}]`;

    const payload = {
      ambiente: quickAttentionItem.aula,
      pabellon: quickAttentionItem.aula.startsWith('B') ? 'B' : 'A',
      piso: quickAttentionItem.pisoPabellon || 'SEDE',
      tipoSolicitud: quickAttentionTipo,
      estado: quickAttentionStatus,
      descripcionSolucion: `${personTag} ${quickAttentionNotes || `Préstamo en aula ${quickAttentionItem.aula}`}`,
      responsable: 'Operaciones Sede'
    };

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage(`✅ Atención registrada en Aula ${quickAttentionItem.aula}`);
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }

    setQuickAttentionItem(null);
    setQuickAttentionNotes('');
  };

  const handleSaveObservation = async () => {
    if (!activeModalItem) return;

    let updates = {};
    if (replaceTeacherName.trim()) {
      updates.docente = replaceTeacherName.trim().toUpperCase();
      updates.asistencia = 'DOCENTE DE REEMPLAZO';
      updates.puntualidad = 'PUNTUAL';
      updates.horaInicioReal = getCurrentTimeStr();
      updates.observacion = observationText.trim() ? `Docente Reemplazo. Obs: ${observationText}` : 'Docente Reemplazo';
    } else {
      updates.observacion = observationText.trim();
    }

    setData(prev => prev.map(c => (c.id === activeModalItem.id ? { ...c, ...updates } : c)));

    try {
      await fetch(`/api/attendance/${activeModalItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Error saving observation:', err);
    }

    setActiveModalItem(null);
    setObservationText('');
    setReplaceTeacherName('');
  };

  // Metrics computation
  const countTotal = data.length;
  const countPuntual = data.filter(c => c.puntualidad === 'PUNTUAL').length;
  const countTarde = data.filter(c => c.puntualidad === 'TARDE').length;
  const countFalta = data.filter(c => c.asistencia === 'NO').length;
  const countReemplazo = data.filter(c => c.asistencia && c.asistencia.includes('REEMPLAZO')).length;
  const countPendientes = data.filter(c => c.asistencia === 'PENDIENTE' || (!c.asistencia && !c.puntualidad)).length;

  // Filter items by statusFilter when user clicks on counter pills
  const displayedItems = useMemo(() => {
    return data.filter(c => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PENDING') return c.asistencia === 'PENDIENTE' || (!c.asistencia && !c.puntualidad);
      if (statusFilter === 'PUNTUAL') return c.puntualidad === 'PUNTUAL';
      if (statusFilter === 'TARDE') return c.puntualidad === 'TARDE';
      if (statusFilter === 'FALTA') return c.asistencia === 'NO';
      return true;
    });
  }, [data, statusFilter]);

  // Compute Free Classrooms (Aulas Libres en este momento)
  const freeRooms = useMemo(() => {
    const busyRoomCodes = new Set(data.map(c => (c.aula || '').toUpperCase().trim()));
    return rooms.filter(r => {
      if (selectedPabellon && r.pabellon !== selectedPabellon) return false;
      if (selectedPiso && r.piso !== selectedPiso) return false;
      return !busyRoomCodes.has((r.abrv || '').toUpperCase().trim());
    });
  }, [data, rooms, selectedPabellon, selectedPiso]);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-16 inset-x-4 max-w-sm mx-auto z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-200">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="p-1 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* High-Resolution Smart Campus Controller - Spacious & Mobile Ergonomic */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
        {/* Row 1: Day Selector Symmetrical 7-Column Grid (LUN - DOM 100% Visible) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full">
          {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map((d) => {
            const isSelected = selectedDia === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDia(d)}
                className={`h-9 text-xs font-bold rounded-xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] inline-flex items-center justify-center active:scale-95 ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                }`}
              >
                <span>{d === 'MIERCOLES' ? 'MIÉ' : d === 'SABADO' ? 'SÁB' : d === 'DOMINGO' ? 'DOM' : d.slice(0, 3)}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Symmetrical Pavilion Switcher & 100% Visible Floor Grid */}
        <div className="flex flex-col lg:flex-row items-stretch gap-2 pt-1 border-t border-slate-100">
          {/* Pavilion Toggle */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-2xl shrink-0 lg:w-72">
            <button
              type="button"
              onClick={() => setSelectedPabellon('')}
              className={`h-8 sm:h-9 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center active:scale-95 ${
                !selectedPabellon ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ambos
            </button>
            <button
              type="button"
              onClick={() => setSelectedPabellon('A')}
              className={`h-8 sm:h-9 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center active:scale-95 ${
                selectedPabellon === 'A' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pab. A
            </button>
            <button
              type="button"
              onClick={() => setSelectedPabellon('B')}
              className={`h-8 sm:h-9 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center active:scale-95 ${
                selectedPabellon === 'B' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pab. B
            </button>
          </div>

          {/* Floor Grid: 7 Symmetrical Columns - ALL FLOORS 100% VISIBLE (No Horizontal Scroll / No Clipping) */}
          <div className="grid grid-cols-7 gap-1 bg-slate-100/90 p-1 rounded-2xl flex-1 w-full">
            {pisosDisponibles.map((p) => {
              const isSelected = selectedPiso === p.val;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSelectedPiso(p.val)}
                  className={`h-8 sm:h-9 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center text-center active:scale-95 px-0.5 ${
                    isSelected
                      ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                  title={`Filtrar por ${p.label}`}
                >
                  <span className="sm:hidden font-bold">{p.short}</span>
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Full-Width Search Input */}
        <div className="relative w-full pt-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 stroke-[2.2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar aula (A201), docente, NRC o curso..."
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}
        </div>

        {/* Row 4: Dedicated Symmetrical 3-Column Mode Selectors (Academic Theme) */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <button
            onClick={() => {
              const newMode = blockMode === 'CURRENT' ? 'ALL' : 'CURRENT';
              setBlockMode(newMode);
              if (newMode !== 'ALL') setSelectedHora('');
            }}
            className={`h-10 px-2 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              blockMode === 'CURRENT'
                ? 'bg-[#FDBA30] text-slate-950 border-[#FDBA30] shadow-sm font-black'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 stroke-[2.2] shrink-0 ${blockMode === 'CURRENT' ? 'text-slate-950 stroke-[2.6]' : 'text-amber-600'}`} />
            <span className="truncate">Actual ({getCurrentHourBlock()})</span>
          </button>

          <button
            onClick={() => {
              const newMode = blockMode === 'NEXT' ? 'ALL' : 'NEXT';
              setBlockMode(newMode);
              if (newMode !== 'ALL') setSelectedHora('');
            }}
            className={`h-10 px-2 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              blockMode === 'NEXT'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-black'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CalendarClock className={`w-3.5 h-3.5 stroke-[2.2] shrink-0 ${blockMode === 'NEXT' ? 'text-white' : 'text-slate-600'}`} />
            <span className="truncate">Sig. ({getNextHourBlock()})</span>
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'FREE_ROOMS' ? 'CLASSES' : 'FREE_ROOMS')}
            className={`h-10 px-2 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              viewMode === 'FREE_ROOMS'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
            <span className="truncate">Libres ({freeRooms.length})</span>
          </button>
        </div>

        {/* Row 5: KPI Status Filter Cards */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
          <button
            onClick={() => {
              setViewMode('CLASSES');
              setStatusFilter(statusFilter === 'PUNTUAL' ? 'ALL' : 'PUNTUAL');
            }}
            className={`py-2 px-1 rounded-2xl border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95 ${
              statusFilter === 'PUNTUAL' && viewMode === 'CLASSES'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-[1.02]'
                : 'bg-emerald-50 text-emerald-900 border-emerald-200/70 hover:bg-emerald-100'
            }`}
          >
            <span className="block text-[9px] font-bold uppercase tracking-tight">PUNTUAL</span>
            <span className="text-xs sm:text-sm font-black">{countPuntual}</span>
          </button>

          <button
            onClick={() => {
              setViewMode('CLASSES');
              setStatusFilter(statusFilter === 'TARDE' ? 'ALL' : 'TARDE');
            }}
            className={`py-2 px-1 rounded-2xl border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95 ${
              statusFilter === 'TARDE' && viewMode === 'CLASSES'
                ? 'bg-[#FDBA30] text-slate-950 border-amber-500 shadow-sm font-black scale-[1.02]'
                : 'bg-amber-50 text-amber-900 border-amber-200/70 hover:bg-amber-100'
            }`}
          >
            <span className="block text-[9px] font-bold uppercase tracking-tight">TARDE</span>
            <span className="text-xs sm:text-sm font-black">{countTarde}</span>
          </button>

          <button
            onClick={() => {
              setViewMode('CLASSES');
              setStatusFilter(statusFilter === 'FALTA' ? 'ALL' : 'FALTA');
            }}
            className={`py-2 px-1 rounded-2xl border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95 ${
              statusFilter === 'FALTA' && viewMode === 'CLASSES'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm scale-[1.02]'
                : 'bg-rose-50 text-rose-900 border-rose-200/70 hover:bg-rose-100'
            }`}
          >
            <span className="block text-[9px] font-bold uppercase tracking-tight">FALTA</span>
            <span className="text-xs sm:text-sm font-black">{countFalta}</span>
          </button>

          <button
            onClick={() => {
              setViewMode('CLASSES');
              setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING');
            }}
            className={`py-2 px-1 rounded-2xl border transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95 ${
              statusFilter === 'PENDING' && viewMode === 'CLASSES'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm scale-[1.02]'
                : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <span className="block text-[9px] font-bold uppercase tracking-tight">PENDIENTES</span>
            <span className="text-xs sm:text-sm font-black">{countPendientes}</span>
          </button>
        </div>

        {/* Active Filter Pill indicator if statusFilter != 'ALL' */}
        {statusFilter !== 'ALL' && viewMode === 'CLASSES' && (
          <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-600 font-medium">
              Filtrando por estado: <strong className="text-slate-900 font-bold uppercase">{statusFilter}</strong>
            </span>
            <button
              onClick={() => setStatusFilter('ALL')}
              className="text-amber-700 hover:text-amber-800 text-[11px] font-bold inline-flex items-center gap-1"
            >
              <span>Ver todas ({countTotal})</span>
              <X className="w-3 h-3 stroke-[2.2]" />
            </button>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: FREE ROOMS (Aulas Disponibles / Libres Ahora) */}
      {viewMode === 'FREE_ROOMS' ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/80 p-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-emerald-700 stroke-[2.2]" />
              <div>
                <h3 className="text-xs font-bold text-emerald-950">Aulas Disponibles / Libres en este Horario</h3>
                <p className="text-[11px] text-emerald-700">Espacios sin clase programada listos para préstamo o talleres</p>
              </div>
            </div>
            <button
              onClick={() => setViewMode('CLASSES')}
              className="text-xs font-bold bg-white text-emerald-900 px-3 py-1 rounded-xl border border-emerald-200 shadow-2xs"
            >
              Volver a Clases
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {freeRooms.map(room => (
              <div 
                key={room.abrv}
                className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5 mb-2">
                    <span className="font-mono font-black text-sm bg-slate-900 text-white px-2.5 py-0.5 rounded-xl">
                      {room.abrv}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      LIBRE
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-800 truncate mb-1">{room.nombre}</h4>
                  <span className="inline-block text-[10px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md mb-2.5">
                    {room.tipo} · Pab. {room.pabellon} ({room.piso})
                  </span>

                  <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Capacidad / Aforo: <strong className="text-slate-900">{room.aforo} personas</strong></span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                      {room.abrv}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: CLASS ATTENDANCE CARDS */
        loading ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
            <p className="text-xs font-semibold text-slate-500">Cargando programación de aulas...</p>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 shadow-xs px-4">
            <Building className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.8]" />
            <p className="text-sm font-bold text-slate-800">
              {statusFilter === 'PENDING' ? '¡Excelente trabajo! No hay aulas pendientes' : 'No se encontraron clases'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {statusFilter !== 'ALL' 
                ? 'Todas las clases de este bloque han sido verificadas con éxito.' 
                : 'Prueba cambiando el piso, pabellón o filtro de búsqueda.'}
            </p>
            {statusFilter !== 'ALL' && (
              <button
                onClick={() => setStatusFilter('ALL')}
                className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
              >
                Restablecer Filtro
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {displayedItems.map(item => {
              const isPuntual = item.puntualidad === 'PUNTUAL';
              const isTarde = item.puntualidad === 'TARDE';
              const isFalta = item.asistencia === 'NO';
              const isReemplazo = item.asistencia && item.asistencia.includes('REEMPLAZO');
              const isPendiente = !isPuntual && !isTarde && !isFalta && !isReemplazo;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Bar: Aula, Pabellón, Estado y Menú 3 puntos */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs sm:text-sm bg-slate-900 text-white px-2 py-0.5 rounded-lg shadow-xs tracking-tight">
                          {item.aula}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md">
                          {item.pisoPabellon || 'Campus'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isPuntual && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[2.4] shrink-0" />
                            <span>PUNTUAL</span>
                          </span>
                        )}
                        {isTarde && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600 stroke-[2.4] shrink-0" />
                            <span>TARDE</span>
                          </span>
                        )}
                        {isFalta && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-600 stroke-[2.4] shrink-0" />
                            <span>FALTA</span>
                          </span>
                        )}
                        {isReemplazo && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                            <UserCheck className="w-3 h-3 text-purple-600 stroke-[2.4] shrink-0" />
                            <span>REEMPLAZO</span>
                          </span>
                        )}
                        {isPendiente && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                            PENDIENTE
                          </span>
                        )}

                        {/* Menú de Acciones Rápidas (Observación / Hoja / Préstamo) */}
                        <button
                          type="button"
                          onClick={() => setSelectedClassOptions(item)}
                          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition inline-flex items-center justify-center active:scale-90"
                          title="Más opciones de aula"
                        >
                          <MoreVertical className="w-4 h-4 stroke-[2]" />
                        </button>
                      </div>
                    </div>

                    {/* Docente, Curso y Horario (Líneas compactas) */}
                    <div className="mb-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-snug" title={item.docente}>
                        {item.docente}
                      </h3>
                      <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 mt-0.5">
                        <span className="truncate" title={item.curso}>{item.curso}</span>
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200 shrink-0">
                          NRC {item.nrc}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-1 pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{item.horaInicioProg} - {item.horaFinalProg}</span>
                        </span>
                        <span className={item.horaInicioReal ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                          Real: {item.horaInicioReal || '--:--'}
                        </span>
                      </div>

                      {/* Observación Compacta (Clic para editar) */}
                      {item.observacion && (
                        <div 
                          onClick={() => {
                            setActiveModalItem(item);
                            setObservationText(item.observacion || '');
                            setReplaceTeacherName('');
                          }}
                          className="mt-1.5 px-2 py-0.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-900 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition active:scale-98"
                          title="Toca para editar observación"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{item.observacion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fila Única y Simétrica de Toma de Asistencia */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100">
                    <button
                      onClick={() => handleQuickStatus(item, 'PUNTUAL')}
                      className={`h-10 rounded-xl font-bold text-xs transition inline-flex items-center justify-center gap-1 active:scale-95 ${
                        isPuntual
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
                      }`}
                      title={isPuntual ? 'Toca para desmarcar' : 'Marcar puntual'}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 stroke-[2.2] shrink-0 ${isPuntual ? 'text-white' : 'text-emerald-600'}`} />
                      <span>Puntual</span>
                    </button>

                    <button
                      onClick={() => handleQuickStatus(item, 'TARDE')}
                      className={`h-10 rounded-xl font-bold text-xs transition inline-flex items-center justify-center gap-1 active:scale-95 ${
                        isTarde
                          ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80'
                      }`}
                      title={isTarde ? 'Toca para desmarcar' : 'Marcar tardanza'}
                    >
                      <Clock className={`w-3.5 h-3.5 stroke-[2.2] shrink-0 ${isTarde ? 'text-slate-950' : 'text-amber-600'}`} />
                      <span>Tarde</span>
                    </button>

                    <button
                      onClick={() => handleQuickStatus(item, 'FALTA')}
                      className={`h-10 rounded-xl font-bold text-xs transition inline-flex items-center justify-center gap-1 active:scale-95 ${
                        isFalta
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/80'
                      }`}
                      title={isFalta ? 'Toca para desmarcar' : 'Marcar falta'}
                    >
                      <XCircle className={`w-3.5 h-3.5 stroke-[2.2] shrink-0 ${isFalta ? 'text-white' : 'text-rose-600'}`} />
                      <span>Falta</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* SECONDARY CLASSROOM ACTIONS SHEET (3-Dots Menu) */}
      {selectedClassOptions && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
          onClick={() => setSelectedClassOptions(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 animate-spring-up space-y-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="font-mono font-black text-xs bg-slate-900 text-white px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                  {selectedClassOptions.aula}
                </span>
                <div className="truncate">
                  <div className="text-xs font-black text-slate-900 truncate">{selectedClassOptions.docente}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">NRC {selectedClassOptions.nrc} · {selectedClassOptions.curso}</div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedClassOptions(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition flex items-center justify-center active:scale-90 shrink-0"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  const item = selectedClassOptions;
                  setSelectedClassOptions(null);
                  setActiveModalItem(item);
                  setObservationText(item.observacion || '');
                  setReplaceTeacherName('');
                }}
                className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-left flex items-center gap-3 transition active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900">Añadir Observación o Suplente</div>
                  <div className="text-[10px] text-slate-500 truncate">Registrar motivo, licencia o docente de reemplazo</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const item = selectedClassOptions;
                  setSelectedClassOptions(null);
                  if (onEmitManualSheet) {
                    onEmitManualSheet(item);
                  }
                }}
                className="w-full p-3 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200/90 text-left flex items-center gap-3 transition active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-indigo-950">Ir a Hoja de Asistencia Manual</div>
                  <div className="text-[10px] text-indigo-600 truncate">Generar boleta prellenada en su apartado</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const item = selectedClassOptions;
                  setSelectedClassOptions(null);
                  if (onOpenNewTicket) {
                    onOpenNewTicket({
                      ambiente: item.aula,
                      pabellon: item.aula.startsWith('B') ? 'B' : 'A',
                      tipo: 'PLUMONES / MATERIALES',
                      descripcion: `[👨‍🏫 DOCENTE: ${item.docente}] Préstamo en aula ${item.aula}`
                    });
                  }
                }}
                className="w-full p-3 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/90 text-left flex items-center gap-3 transition active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-950 flex items-center justify-center shrink-0">
                  <HandHelping className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-amber-950">Registrar Préstamo de Material</div>
                  <div className="text-[10px] text-amber-700 truncate">Entrega de plumones, cable HDMI, llave o accesorios para esta aula</div>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* IN-SITU QUICK ATTENTION DRAWER (Apple-Style Liquid Glass Bottom Sheet) */}
      {quickAttentionItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4 animate-backdrop-fade"
          onClick={() => setQuickAttentionItem(null)}
        >
          <div 
            className="apple-liquid-modal rounded-t-[32px] sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl safe-bottom max-h-[90vh] overflow-y-auto animate-spring-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300/80 rounded-full mx-auto mb-3.5 sm:hidden"></div>

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center shadow-2xs">
                  <HandHelping className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Atención Rápida en Aula
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aula <strong className="text-slate-800 font-mono">{quickAttentionItem.aula}</strong> · {quickAttentionItem.docente}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAttentionItem(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition inline-flex items-center justify-center active:scale-90"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>

            {/* Beneficiario Toggle: Docente vs Alumno */}
            <div className="flex items-center justify-between bg-slate-100/90 p-1.5 rounded-2xl mb-3 border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-600 pl-1">Entregar a:</span>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuickAttentionBeneficiary('DOCENTE')}
                  className={`h-7 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                    quickAttentionBeneficiary === 'DOCENTE'
                      ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>👨‍🏫 Docente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAttentionBeneficiary('ALUMNO')}
                  className={`h-7 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 ${
                    quickAttentionBeneficiary === 'ALUMNO'
                      ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🎓 Alumno</span>
                </button>
              </div>
            </div>

            {/* Quick 1-Tap Preset Material Chips */}
            <div className="space-y-1.5 mb-3.5">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                Selecciona requerimiento en 1 toque:
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {commonLoanChips.map(chip => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => {
                      setQuickAttentionTipo(chip.tipo);
                      setQuickAttentionNotes(chip.desc);
                    }}
                    className={`text-left text-xs font-bold px-3.5 py-2.5 rounded-2xl border transition-all duration-200 flex items-center justify-between active:scale-95 ${
                      quickAttentionNotes === chip.desc
                        ? 'bg-[#FDBA30] text-slate-950 border-amber-400 shadow-[0_2px_12px_rgba(253,186,48,0.35)] scale-[1.01]'
                        : 'bg-white/80 text-slate-700 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <span>{chip.label}</span>
                    {quickAttentionNotes === chip.desc && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail notes */}
            <div className="space-y-2.5 mb-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-1">
                  Detalle / Observación
                </label>
                <input
                  type="text"
                  value={quickAttentionNotes}
                  onChange={(e) => setQuickAttentionNotes(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FDBA30]/30 focus:border-[#FDBA30] transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">Estado:</span>
                <button
                  type="button"
                  onClick={() => setQuickAttentionStatus('EN PROCESO')}
                  className={`px-3 py-1 text-xs font-bold rounded-full border transition-all active:scale-95 ${
                    quickAttentionStatus === 'EN PROCESO' ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  En Préstamo
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAttentionStatus('ATENDIDO')}
                  className={`px-3 py-1 text-xs font-bold rounded-full border transition-all active:scale-95 ${
                    quickAttentionStatus === 'ATENDIDO' ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  Concluido
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setQuickAttentionItem(null)}
                className="h-11 rounded-2xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition inline-flex items-center justify-center active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveQuickAttention}
                className="h-11 rounded-2xl text-xs font-bold bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-[0_4px_16px_rgba(253,186,48,0.35)] transition inline-flex items-center justify-center active:scale-95"
              >
                Registrar Atención
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Observation / Suplente Modal - 100% Symmetrical */}
      {activeModalItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
          onClick={() => setActiveModalItem(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 animate-spring-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="min-w-0 pr-2">
                <h3 className="text-base font-black text-slate-950 tracking-tight leading-tight">
                  Observación o Suplente
                </h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  Aula <strong className="text-slate-900 font-mono">{activeModalItem.aula}</strong> · {activeModalItem.docente}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition flex items-center justify-center active:scale-90 shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-3.5 mb-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Docente de Reemplazo (Opcional)
                </label>
                <input
                  type="text"
                  value={replaceTeacherName}
                  onChange={(e) => setReplaceTeacherName(e.target.value)}
                  placeholder="Ej: JUAN PEREZ GOMEZ"
                  className="w-full h-11 px-3.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-2xl text-slate-950 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Motivo o Detalle de Observación
                </label>
                <textarea
                  rows="3"
                  value={observationText}
                  onChange={(e) => setObservationText(e.target.value)}
                  placeholder="Ej: Licencia médica, tráfico, adelanto de clase..."
                  className="w-full p-3.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-2xl text-slate-950 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition resize-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModalItem(null)}
                className="h-11 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/90 transition flex items-center justify-center text-center active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObservation}
                className="h-11 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition flex items-center justify-center text-center active:scale-95"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
