import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  HandHelping, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  X, 
  RotateCcw,
  Check,
  Building,
  AlertCircle,
  User,
  GraduationCap,
  Sparkles,
  Edit3
} from 'lucide-react';

const DEFAULT_BASE_ITEMS = [
  { label: '🖊️ Plumones y Mota', val: 'PLUMONES', name: 'PLUMONES / MATERIALES', defaultDesc: 'Préstamo de plumones y mota acrílica' },
  { label: '🔌 Cable HDMI', val: 'CABLES', name: 'CABLES Y ADAPTADORES', defaultDesc: 'Préstamo de cable HDMI' },
  { label: '⚡ Adaptador Video', val: 'ADAPTADOR', name: 'CABLES Y ADAPTADORES', defaultDesc: 'Préstamo de adaptador Tipo C / VGA / HDMI' },
  { label: '🖱️ Mouse / Puntero', val: 'PC', name: 'PC / PERIFÉRICOS', defaultDesc: 'Préstamo de mouse o puntero inalámbrico' },
  { label: '🚪 Llave / Apertura', val: 'APERTURA', name: 'APERTURA DE AMBIENTE', defaultDesc: 'Apertura y desbloqueo de ambiente' },
  { label: '📽️ Control Proyector', val: 'PROYECCIÓN', name: 'PROYECCIÓN / AUDIO', defaultDesc: 'Control remoto y encendido de proyector' },
  { label: '🔊 Audio / Micrófono', val: 'AUDIO', name: 'PROYECCIÓN / AUDIO', defaultDesc: 'Préstamo de micrófono o parlante' },
  { label: '✏️ Otro (Manual)', val: 'MANUAL', name: 'MATERIAL / GENERAL', defaultDesc: '' }
];

export default function TicketsKanban({ initialNewTicket, onClearInitialTicket }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeViewTab, setActiveViewTab] = useState('ACTIVOS'); // 'ACTIVOS' | 'CONCLUIDOS'

  // Custom User Saved Items (Persisted in localStorage)
  const [customItems, setCustomItems] = useState(() => {
    try {
      const saved = localStorage.getItem('upn_custom_loan_items');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Unified New Loan Form State
  const [beneficiaryType, setBeneficiaryType] = useState('DOCENTE'); // 'DOCENTE' | 'ALUMNO'
  const [roomInput, setRoomInput] = useState('');
  const [personName, setPersonName] = useState('');
  const [selectedMaterialVal, setSelectedMaterialVal] = useState('PLUMONES');
  const [manualItemText, setManualItemText] = useState('');
  const [saveAsQuickItem, setSaveAsQuickItem] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [submittingLoan, setSubmittingLoan] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterBeneficiary, setFilterBeneficiary] = useState(''); // '' | 'DOCENTE' | 'ALUMNO'

  // Modals & Feedback
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Detailed Modal Form State
  const [formData, setFormData] = useState({
    ambiente: '',
    piso: '1ER PISO',
    pabellon: 'A',
    tipoSolicitud: 'PLUMONES / MATERIALES',
    responsable: 'OPERACIONES SEDE',
    estado: 'EN PROCESO',
    descripcionSolucion: '[👨‍🏫 DOCENTE] Préstamo de plumones y mota acrílica',
    rango: ''
  });

  // Merged items list: Base items + user-created custom items
  const allMaterialItems = useMemo(() => {
    const list = [...DEFAULT_BASE_ITEMS];
    if (customItems.length > 0) {
      // Insert custom items right before "Otro (Manual)"
      const manualIdx = list.findIndex(i => i.val === 'MANUAL');
      if (manualIdx !== -1) {
        list.splice(manualIdx, 0, ...customItems);
      } else {
        list.push(...customItems);
      }
    }
    return list;
  }, [customItems]);

  // Helper to deduce floor from room code (e.g., A201 -> 2DO PISO, A508 -> 5TO PISO)
  const deduceFloor = (roomStr) => {
    const num = roomStr.replace(/\D/g, '');
    if (!num) return '1ER PISO';
    const firstDigit = num.charAt(0);
    const floors = {
      '1': '1ER PISO',
      '2': '2DO PISO',
      '3': '3ER PISO',
      '4': '4TO PISO',
      '5': '5TO PISO',
      '6': '6TO PISO'
    };
    return floors[firstDigit] || '1ER PISO';
  };

  // Helper to parse Beneficiary (Docente vs Alumno) from description
  const parseBeneficiary = (desc = '') => {
    const d = desc.toUpperCase();
    const matchAlumno = desc.match(/\[🎓?\s*ALUMNO(?::\s*([^\]]+))?\]/i);
    if (matchAlumno) {
      return {
        type: 'ALUMNO',
        label: 'Alumno',
        name: matchAlumno[1] ? matchAlumno[1].trim() : '',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
      };
    }
    const matchDocente = desc.match(/\[👨‍🏫?\s*DOCENTE(?::\s*([^\]]+))?\]/i);
    if (matchDocente) {
      return {
        type: 'DOCENTE',
        label: 'Docente',
        name: matchDocente[1] ? matchDocente[1].trim() : '',
        badgeClass: 'bg-amber-50 text-amber-900 border-amber-200'
      };
    }
    if (d.includes('ALUMNO')) {
      return { type: 'ALUMNO', label: 'Alumno', name: '', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    }
    return { type: 'DOCENTE', label: 'Docente', name: '', badgeClass: 'bg-amber-50 text-amber-900 border-amber-200' };
  };

  const getCleanNote = (desc = '') => {
    return desc.replace(/\[(🎓|👨‍🏫)?\s*(ALUMNO|DOCENTE)(?::[^\]]+)?\]/gi, '').trim();
  };

  const getCleanRoom = (amb) => {
    if (!amb || amb.trim() === '' || amb.trim() === '-' || amb.trim() === '--') {
      return 'GENERAL';
    }
    return amb.trim();
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets');
      const json = await res.json();
      if (json.success) {
        setTickets(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Multi-user silent background sync
  const silentRefreshTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      const json = await res.json();
      if (json.success) {
        setTickets(json.data);
      }
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(silentRefreshTickets, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    if (initialNewTicket) {
      const room = initialNewTicket.ambiente || '';
      setFormData(prev => ({
        ...prev,
        ...initialNewTicket,
        ambiente: room,
        pabellon: initialNewTicket.pabellon || (room.toUpperCase().startsWith('B') ? 'B' : 'A'),
        piso: initialNewTicket.piso || deduceFloor(room),
        tipoSolicitud: initialNewTicket.tipoSolicitud || 'PLUMONES / MATERIALES',
        descripcionSolucion: initialNewTicket.descripcionSolucion || '[👨‍🏫 DOCENTE] Préstamo de plumones y mota acrílica'
      }));
      setIsModalOpen(true);
      if (onClearInitialTicket) onClearInitialTicket();
    }
  }, [initialNewTicket]);

  // Handle saving new custom quick button
  const handleAddCustomSavedItem = (name) => {
    const clean = name.trim();
    if (!clean) return;
    const exists = customItems.some(i => i.label.toLowerCase() === clean.toLowerCase());
    if (exists) return;

    const newItem = {
      label: `📦 ${clean}`,
      val: `CUSTOM_${Date.now()}`,
      name: 'MATERIAL / GENERAL',
      defaultDesc: `Préstamo de ${clean}`,
      isCustom: true
    };

    const updated = [...customItems, newItem];
    setCustomItems(updated);
    try {
      localStorage.setItem('upn_custom_loan_items', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleDeleteCustomItem = (val, e) => {
    e.stopPropagation();
    const updated = customItems.filter(i => i.val !== val);
    setCustomItems(updated);
    try {
      localStorage.setItem('upn_custom_loan_items', JSON.stringify(updated));
    } catch (e) {}
    if (selectedMaterialVal === val) {
      setSelectedMaterialVal('PLUMONES');
    }
  };

  // =========================================================================
  // SUBMIT LOAN (Symmetrical, Supports Manual Item and Preset Chips)
  // =========================================================================
  const handleRegisterLoan = async (e) => {
    if (e) e.preventDefault();
    const cleanRoom = roomInput.trim().toUpperCase();
    if (!cleanRoom) {
      setToastMessage('⚠️ Ingresa el código de Aula (Ej: A201)');
      setTimeout(() => setToastMessage(''), 2500);
      const el = document.getElementById('unified-room-input');
      if (el) el.focus();
      return;
    }

    // Material validation
    let matName = '';
    let matDesc = '';
    let matType = 'MATERIAL / GENERAL';

    if (selectedMaterialVal === 'MANUAL') {
      const manualClean = manualItemText.trim();
      if (!manualClean) {
        setToastMessage('⚠️ Escribe el nombre del material a prestar');
        setTimeout(() => setToastMessage(''), 2500);
        const el = document.getElementById('manual-item-input');
        if (el) el.focus();
        return;
      }
      matName = `📦 ${manualClean}`;
      matDesc = `Préstamo de ${manualClean}`;
      if (saveAsQuickItem) {
        handleAddCustomSavedItem(manualClean);
      }
    } else {
      const selectedObj = allMaterialItems.find(t => t.val === selectedMaterialVal) || allMaterialItems[0];
      matName = selectedObj.name;
      matDesc = selectedObj.defaultDesc;
    }

    setSubmittingLoan(true);
    const pab = cleanRoom.startsWith('B') ? 'B' : 'A';
    const floor = deduceFloor(cleanRoom);

    const personTag = personName.trim() ? `: ${personName.trim().toUpperCase()}` : '';
    const prefix = beneficiaryType === 'ALUMNO' 
      ? `[🎓 ALUMNO${personTag}]` 
      : `[👨‍🏫 DOCENTE${personTag}]`;
    
    const noteText = customNote.trim() ? ` - ${customNote.trim()}` : '';
    const finalDesc = `${prefix} ${matDesc}${noteText}`;

    const payload = {
      ambiente: cleanRoom,
      piso: floor,
      pabellon: pab,
      tipoSolicitud: matName,
      responsable: 'OPERACIONES SEDE',
      estado: 'EN PROCESO',
      descripcionSolucion: finalDesc,
      rango: ''
    };

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setTickets(prev => [json.data, ...prev]);
        setToastMessage(`✅ Préstamo a ${beneficiaryType === 'ALUMNO' ? 'Alumno' : 'Docente'} en Aula ${cleanRoom} registrado`);
        setRoomInput('');
        setPersonName('');
        setManualItemText('');
        setCustomNote('');
        setActiveViewTab('ACTIVOS');
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('❌ Error al guardar el préstamo');
      setTimeout(() => setToastMessage(''), 3000);
    } finally {
      setSubmittingLoan(false);
    }
  };

  // Detailed Modal Submit
  const handleSaveModalTicket = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (json.success) {
        setTickets(prev => [json.data, ...prev]);
        setToastMessage(`✅ Préstamo registrado en Aula ${formData.ambiente}`);
        setActiveViewTab('ACTIVOS');
        setTimeout(() => setToastMessage(''), 3000);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // 1-Tap Return
  const handleMarkReturned = async (ticket) => {
    const isLoan = ticket.tipoSolicitud.includes('PLUMONES') || ticket.tipoSolicitud.includes('CABLES') || ticket.tipoSolicitud.includes('PC') || ticket.tipoSolicitud.includes('MATERIAL');
    const suffix = isLoan ? ' [DEVUELTO]' : ' [ATENDIDO]';
    const newDesc = ticket.descripcionSolucion.includes('DEVUELTO') || ticket.descripcionSolucion.includes('ATENDIDO')
      ? ticket.descripcionSolucion
      : `${ticket.descripcionSolucion}${suffix}`;

    const updates = { 
      estado: 'ATENDIDO',
      descripcionSolucion: newDesc
    };

    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updates } : t));
    setToastMessage(`✅ Aula ${ticket.ambiente}: Material devuelto y archivado`);
    setTimeout(() => setToastMessage(''), 3000);

    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartAttending = async (ticket) => {
    const updates = { estado: 'EN PROCESO' };
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updates } : t));
    setToastMessage(`🏃 Aula ${ticket.ambiente}: En atención`);
    setTimeout(() => setToastMessage(''), 2500);

    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleReopen = async (ticket) => {
    const updates = { estado: 'EN PROCESO' };
    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updates } : t));
    setToastMessage(`↺ Aula ${ticket.ambiente}: Préstamo reactivado en Activos`);
    setTimeout(() => setToastMessage(''), 2500);

    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Deseas eliminar este registro de préstamo?')) return;
    setTickets(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filterTipo && !t.tipoSolicitud.toUpperCase().includes(filterTipo.toUpperCase())) return false;
      
      if (filterBeneficiary) {
        const ben = parseBeneficiary(t.descripcionSolucion);
        if (ben.type !== filterBeneficiary) return false;
      }

      if (search) {
        const s = search.toLowerCase();
        return (
          (t.ambiente || '').toLowerCase().includes(s) ||
          (t.tipoSolicitud || '').toLowerCase().includes(s) ||
          (t.descripcionSolucion || '').toLowerCase().includes(s) ||
          (t.responsable || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [tickets, search, filterTipo, filterBeneficiary]);

  const activeLoans = useMemo(() => {
    return filteredTickets.filter(t => t.estado === 'PENDIENTE' || t.estado === 'EN PROCESO');
  }, [filteredTickets]);

  const concludedLoans = useMemo(() => {
    return filteredTickets.filter(t => t.estado === 'ATENDIDO');
  }, [filteredTickets]);

  return (
    <div className="space-y-4 pb-36 md:pb-12 max-w-5xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 inset-x-4 max-w-sm mx-auto z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-200">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="p-1 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          PANEL DE CONTROL UNIFICADO Y CENTRADO
          (Botones 100% centrados y soporte para items manuales)
          ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Cabecera + Conmutador Simétrico */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-950 tracking-tight flex items-center gap-2">
              <HandHelping className="w-5 h-5 text-amber-500 stroke-[2.4]" />
              <span>Control de Préstamos de Material</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Entrega y devolución de materiales (plumones, HDMI, llaves, adaptadores) para <strong>Docentes</strong> y <strong>Alumnos</strong>
            </p>
          </div>

          {/* Selector de Pestañas Activos vs Concluidos */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100/90 p-1 rounded-2xl sm:w-80 shrink-0">
            <button
              onClick={() => setActiveViewTab('ACTIVOS')}
              className={`h-9 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-95 ${
                activeViewTab === 'ACTIVOS'
                  ? 'bg-white text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Activos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeViewTab === 'ACTIVOS' ? 'bg-[#FDBA30] text-slate-950' : 'bg-slate-200 text-slate-700'
              }`}>
                {activeLoans.length}
              </span>
            </button>

            <button
              onClick={() => setActiveViewTab('CONCLUIDOS')}
              className={`h-9 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 active:scale-95 ${
                activeViewTab === 'CONCLUIDOS'
                  ? 'bg-white text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 stroke-[2.4]" />
              <span>Devueltos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeViewTab === 'CONCLUIDOS' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {concludedLoans.length}
              </span>
            </button>
          </div>
        </div>

        {/* Formulario Rápido de Entrega */}
        <form onSubmit={handleRegisterLoan} className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Registrar Nueva Entrega
            </span>

            {/* Beneficiario Toggle: Docente vs Alumno (Simetría 50/50 y Centrado) */}
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/70 w-full sm:w-64">
              <button
                type="button"
                onClick={() => setBeneficiaryType('DOCENTE')}
                className={`h-8 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                  beneficiaryType === 'DOCENTE'
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5 stroke-[2.4]" />
                <span>Docente</span>
              </button>

              <button
                type="button"
                onClick={() => setBeneficiaryType('ALUMNO')}
                className={`h-8 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                  beneficiaryType === 'ALUMNO'
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4 stroke-[2.4]" />
                <span>Alumno</span>
              </button>
            </div>
          </div>

          {/* Fila de Inputs: Aula + Nombre / Código */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-4">
              <input
                id="unified-room-input"
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="Aula (Ej: A202)"
                className="w-full h-11 px-3.5 font-mono font-black text-sm bg-slate-50 border border-slate-300 rounded-2xl text-slate-950 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/25 uppercase text-center transition"
              />
            </div>

            <div className="sm:col-span-8">
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder={beneficiaryType === 'ALUMNO' ? 'Nombre o Código del Alumno (Opcional)' : 'Nombre del Docente (Opcional)'}
                className="w-full h-11 px-3.5 text-xs bg-slate-50 border border-slate-300 rounded-2xl text-slate-950 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/25 transition"
              />
            </div>
          </div>

          {/* Botones de Material (100% Centrados y Simétricos) */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">
              Material a entregar (Selecciona o escribe manualmente):
            </div>

            {/* Grid Simétrico Centrado: 2 cols en móvil / 4 cols en escritorio */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {allMaterialItems.map(t => {
                const isSelected = selectedMaterialVal === t.val;
                return (
                  <button
                    key={t.val}
                    type="button"
                    onClick={() => setSelectedMaterialVal(t.val)}
                    className={`h-11 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 border text-center relative ${
                      isSelected
                        ? 'bg-slate-950 text-white border-slate-950 font-black shadow-xs ring-2 ring-amber-400/40'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200/90'
                    }`}
                  >
                    <span className="truncate">{t.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.8] text-amber-400 shrink-0" />}

                    {t.isCustom && (
                      <span
                        onClick={(e) => handleDeleteCustomItem(t.val, e)}
                        className="absolute right-1.5 top-2 p-1 text-slate-400 hover:text-rose-500 rounded-full"
                        title="Eliminar botón rápido"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo de Entrada Manual si seleccionó "Otro (Manual)" */}
          {selectedMaterialVal === 'MANUAL' && (
            <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-3.5 space-y-2 animate-scale-up">
              <label className="block text-[11px] font-black uppercase text-amber-950 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                <span>Especificar Material Manualmente:</span>
              </label>

              <input
                id="manual-item-input"
                type="text"
                required
                autoFocus
                value={manualItemText}
                onChange={(e) => setManualItemText(e.target.value)}
                placeholder="Ej: Extensión eléctrica, Parlante Bluetooth, Puntero láser, Adaptador Apple..."
                className="w-full h-11 px-3.5 text-xs font-bold bg-white border border-amber-300 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
              />

              <div className="flex items-center gap-2 pt-0.5">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsQuickItem}
                    onChange={(e) => setSaveAsQuickItem(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded border-slate-300 focus:ring-amber-400"
                  />
                  <span>Guardar como botón rápido permanente</span>
                </label>
              </div>
            </div>
          )}

          {/* Botón Principal de Acción Centrado */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={submittingLoan}
              className="w-full h-12 bg-[#FDBA30] hover:bg-[#ffc642] active:bg-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-xs transition flex items-center justify-center gap-2 active:scale-98"
            >
              <span>⚡ Registrar Préstamo de Material</span>
            </button>
          </div>
        </form>

        {/* Buscador y Filtros Rápidos */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[2.2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por aula (A201), material (plumón, HDMI) o beneficiario..."
              className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}
          </div>

          {/* Chips de filtro por material y beneficiario */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <button
              onClick={() => { setFilterTipo(''); setFilterBeneficiary(''); }}
              className={`h-7 px-3 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${
                !filterTipo && !filterBeneficiary 
                  ? 'bg-slate-900 text-white font-black' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({filteredTickets.length})
            </button>

            <button
              onClick={() => setFilterBeneficiary(filterBeneficiary === 'DOCENTE' ? '' : 'DOCENTE')}
              className={`h-7 px-2.5 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${
                filterBeneficiary === 'DOCENTE'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              👨‍🏫 Docentes
            </button>

            <button
              onClick={() => setFilterBeneficiary(filterBeneficiary === 'ALUMNO' ? '' : 'ALUMNO')}
              className={`h-7 px-2.5 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${
                filterBeneficiary === 'ALUMNO'
                  ? 'bg-indigo-600 text-white font-black shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              🎓 Alumnos
            </button>

            {allMaterialItems.slice(0, 6).map(t => (
              <button
                key={t.val}
                onClick={() => setFilterTipo(filterTipo === t.val ? '' : t.val)}
                className={`h-7 px-2.5 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${
                  filterTipo === t.val
                    ? 'bg-slate-900 text-white font-black'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          LISTADO DE PRÉSTAMOS ACTIVOS / HISTORIAL
          ========================================================================= */}
      {loading ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
          <p className="text-xs font-semibold text-slate-500">Cargando préstamos...</p>
        </div>
      ) : activeViewTab === 'ACTIVOS' ? (
        /* ================= TAB 1: PRÉSTAMOS ACTIVOS ================= */
        activeLoans.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 shadow-xs px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-2.5">
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <p className="text-sm font-bold text-slate-800">
              No hay préstamos activos pendientes de devolución
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Todos los materiales prestados a alumnos y docentes han sido recibidos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeLoans.map(ticket => {
              const ben = parseBeneficiary(ticket.descripcionSolucion);
              const cleanNote = getCleanNote(ticket.descripcionSolucion);
              const isPending = ticket.estado === 'PENDIENTE';

              return (
                <div 
                  key={ticket.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    {/* Header de la tarjeta */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-sm bg-slate-900 text-white px-2.5 py-0.5 rounded-xl shadow-xs">
                          {ticket.ambiente || 'AULA'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                          Pab. {ticket.pabellon || 'A'} · {ticket.piso || 'Sede'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${ben.badgeClass}`}>
                          <span>{ben.type === 'ALUMNO' ? '🎓 Alumno' : '👨‍🏫 Docente'}</span>
                          {ben.name && <strong className="font-black break-words">: {ben.name}</strong>}
                        </span>
                      </div>
                    </div>

                    {/* Material Prestado */}
                    <div className="mb-2.5">
                      <div className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1">
                        <span>{ticket.tipoSolicitud}</span>
                      </div>
                      {cleanNote && (
                        <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
                          {cleanNote}
                        </p>
                      )}
                    </div>

                    {/* Meta info: hora de entrega */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3 h-3 stroke-[2.2]" />
                        <span>Entregado: {ticket.horaReporte || '--:--'}</span>
                      </span>
                      <span className="font-mono text-slate-400">{ticket.fecha}</span>
                    </div>
                  </div>

                  {/* Botón de 1 Toque para Recibir Devolución */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleStartAttending(ticket)}
                          className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <span>🏃 Atender</span>
                        </button>
                        <button
                          onClick={() => handleMarkReturned(ticket)}
                          className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                          <span>Concluir</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleMarkReturned(ticket)}
                        className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition inline-flex items-center justify-center gap-2 active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>Recibir y Marcar Devuelto</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(ticket.id)}
                      className="w-11 h-11 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition inline-flex items-center justify-center border border-slate-200/80 active:scale-95 shrink-0"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ================= TAB 2: HISTORIAL DE DEVUELTOS ================= */
        concludedLoans.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200/80 shadow-xs px-4">
            <p className="text-sm font-bold text-slate-800">No hay préstamos concluidos con este filtro</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {concludedLoans.slice(0, 50).map(ticket => {
              const ben = parseBeneficiary(ticket.descripcionSolucion);
              const cleanNote = getCleanNote(ticket.descripcionSolucion);

              return (
                <div 
                  key={ticket.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between opacity-95"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-lg">
                          {ticket.ambiente || 'AULA'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${ben.badgeClass}`}>
                          {ben.type === 'ALUMNO' ? '🎓 Alumno' : '👨‍🏫 Docente'} {ben.name && `: ${ben.name}`}
                        </span>
                      </div>

                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        DEVUELTO
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 mb-1">{ticket.tipoSolicitud}</h3>
                    {cleanNote && (
                      <p className="text-xs text-slate-600 mb-2 leading-tight">{cleanNote}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-400 font-mono">{ticket.fecha} · {ticket.horaReporte}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReopen(ticket)}
                        className="text-amber-800 hover:text-amber-950 font-bold inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200/80 transition"
                        title="Reabrir a Préstamos Activos"
                      >
                        <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Reabrir</span>
                      </button>
                      <button
                        onClick={() => handleDelete(ticket.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal Detallado (Solo si se requiere configuración especial) */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 animate-spring-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 inline-flex items-center justify-center shadow-xs shrink-0">
                  <HandHelping className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-950 tracking-tight leading-tight">
                    Préstamo de Material Detallado
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registro de entrega con especificaciones
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition flex items-center justify-center active:scale-90 shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveModalTicket} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Aula * (Ej: A201)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.ambiente}
                  onChange={(e) => {
                    const room = e.target.value.toUpperCase();
                    setFormData({ 
                      ...formData, 
                      ambiente: room,
                      pabellon: room.startsWith('B') ? 'B' : 'A',
                      piso: deduceFloor(room)
                    });
                  }}
                  placeholder="Ej: A201"
                  className="w-full text-sm font-mono font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Detalle / Solicitante (Docente o Alumno)
                </label>
                <input
                  type="text"
                  value={formData.descripcionSolucion}
                  onChange={(e) => setFormData({ ...formData, descripcionSolucion: e.target.value })}
                  placeholder="Ej: [ALUMNO: Juan Pérez] Cable HDMI"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/90 transition flex items-center justify-center text-center active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition flex items-center justify-center text-center active:scale-95"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
