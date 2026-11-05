import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  HandHelping, 
  Search, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  X, 
  RotateCcw,
  Check,
  User,
  GraduationCap,
  PenTool,
  Download
} from 'lucide-react';
import ToastBanner from './ToastBanner';
import SignatureCanvas from './SignatureCanvas';
import { generateCargoPdf } from '../utils/cargoPdfGenerator';

const CORE_MATERIALS = [
  { id: 'PLUMONES', label: '🖊️ Plumones y Mota', desc: 'Préstamo de plumones y mota acrílica' },
  { id: 'CABLES', label: '🔌 Cable HDMI', desc: 'Préstamo de cable HDMI' },
  { id: 'ADAPTADOR', label: '⚡ Adaptador', desc: 'Préstamo de adaptador Tipo C / HDMI' },
  { id: 'LLAVE', label: '🚪 Llave de Aula', desc: 'Llave de ambiente' },
  { id: 'MANUAL', label: '✏️ Otro', desc: '' }
];

export default function TicketsKanban({ initialNewTicket, onClearInitialTicket }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeViewTab, setActiveViewTab] = useState('ACTIVOS'); // 'ACTIVOS' | 'CONCLUIDOS'

  // Form State
  const [beneficiaryType, setBeneficiaryType] = useState('DOCENTE'); // 'DOCENTE' | 'ALUMNO'
  const [personName, setPersonName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [selectedMaterialVal, setSelectedMaterialVal] = useState('PLUMONES');
  const [manualItemText, setManualItemText] = useState('');
  const [submittingLoan, setSubmittingLoan] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Inline Card Signing (Zero popups!)
  const [inlineSignTicketId, setInlineSignTicketId] = useState(null);
  const [inlineReceiveTicketId, setInlineReceiveTicketId] = useState(null);

  // Signature canvas refs
  const solicitanteFormSignRef = useRef(null);
  const cardSignCanvasRef = useRef(null);
  const returnSignCanvasRef = useRef(null);

  // Search filter
  const [search, setSearch] = useState('');

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

  const parseBeneficiary = (desc = '') => {
    const matchAlumno = desc.match(/\[🎓?\s*ALUMNO(?::\s*([^\]]+))?\]/i);
    if (matchAlumno) {
      return {
        type: 'ALUMNO',
        label: 'Alumno',
        name: matchAlumno[1] ? matchAlumno[1].trim() : ''
      };
    }
    const matchDocente = desc.match(/\[👨‍🏫?\s*DOCENTE(?::\s*([^\]]+))?\]/i);
    if (matchDocente) {
      return {
        type: 'DOCENTE',
        label: 'Docente',
        name: matchDocente[1] ? matchDocente[1].trim() : ''
      };
    }
    if (desc.toUpperCase().includes('ALUMNO')) {
      return { type: 'ALUMNO', label: 'Alumno', name: '' };
    }
    return { type: 'DOCENTE', label: 'Docente', name: '' };
  };

  const mergeWithLocalSignatures = (serverTickets) => {
    if (!Array.isArray(serverTickets)) return [];
    return serverTickets.map(t => {
      let fEntrega = t.firmaEntrega;
      let fRecepcion = t.firmaRecepcion;
      try {
        if (!fEntrega && typeof localStorage !== 'undefined') {
          fEntrega = localStorage.getItem(`upn_sign_entrega_${t.id}`);
        }
        if (!fRecepcion && typeof localStorage !== 'undefined') {
          fRecepcion = localStorage.getItem(`upn_sign_recepcion_${t.id}`);
        }
      } catch (e) {}
      return {
        ...t,
        firmaEntrega: fEntrega || null,
        firmaRecepcion: fRecepcion || null
      };
    });
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickets(mergeWithLocalSignatures(json.data));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const silentRefreshTickets = async () => {
    try {
      const res = await fetch('/api/tickets');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickets(mergeWithLocalSignatures(json.data));
      }
    } catch (err) {}
  };

  useEffect(() => {
    loadTickets();
    const interval = setInterval(silentRefreshTickets, 4000);
    return () => clearInterval(interval);
  }, []);

  // Prefill from external views directly into inline form inputs (NO WINDOW OPENS!)
  useEffect(() => {
    if (initialNewTicket) {
      if (initialNewTicket.ambiente) {
        setRoomInput(initialNewTicket.ambiente);
      }
      if (initialNewTicket.descripcionSolucion) {
        const ben = parseBeneficiary(initialNewTicket.descripcionSolucion);
        setBeneficiaryType(ben.type);
        if (ben.name) setPersonName(ben.name);
      }
      if (initialNewTicket.tipoSolicitud) {
        const found = CORE_MATERIALS.find(m => initialNewTicket.tipoSolicitud.toUpperCase().includes(m.id));
        if (found) setSelectedMaterialVal(found.id);
      }
      if (onClearInitialTicket) onClearInitialTicket();
    }
  }, [initialNewTicket]);

  // 1-Tap PDF download (directly downloads official slip voucher, NO MODAL!)
  const handleQuickDownloadPdf = (e, ticket) => {
    e.stopPropagation();
    const ben = parseBeneficiary(ticket.descripcionSolucion);
    const recipientName = ticket.recibidoPor || ben.name || 'Docente / Solicitante';

    generateCargoPdf({
      ticket,
      entregadoPor: recipientName,
      recibidoPor: recipientName,
      firmaEntrega: ticket.firmaEntrega || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_entrega_${ticket.id}`) : null),
      firmaRecepcion: ticket.firmaRecepcion || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_recepcion_${ticket.id}`) : null)
    });
  };

  // Dinámica Paso 1: El docente/alumno firma que RECIBE el material ("Recibí")
  const handleRegisterLoan = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Material
    let matName = '';
    let matDesc = '';
    if (selectedMaterialVal === 'MANUAL') {
      const cleanManual = manualItemText.trim();
      if (!cleanManual) {
        setToastMessage('⚠️ Escribe el material que estás prestando');
        setTimeout(() => setToastMessage(''), 2500);
        return;
      }
      matName = cleanManual.toUpperCase();
      matDesc = `Préstamo de ${cleanManual}`;
    } else {
      const item = CORE_MATERIALS.find(m => m.id === selectedMaterialVal) || CORE_MATERIALS[0];
      matName = item.label.replace(/^[^\w\s]+/, '').trim().toUpperCase();
      matDesc = item.desc;
    }

    const rawRoom = roomInput.trim().toUpperCase();
    const cleanRoom = rawRoom || (beneficiaryType === 'DOCENTE' ? 'DOCENCIA' : 'SEDE');
    const pab = cleanRoom.startsWith('B') ? 'B' : (cleanRoom.startsWith('A') ? 'A' : 'SEDE');
    const floor = (cleanRoom === 'DOCENCIA' || cleanRoom === 'SEDE' || cleanRoom === 'GENERAL')
      ? 'Sede'
      : deduceFloor(cleanRoom);

    const personTag = personName.trim() ? `: ${personName.trim().toUpperCase()}` : '';
    const prefix = beneficiaryType === 'ALUMNO' ? `[🎓 ALUMNO${personTag}]` : `[👨‍🏫 DOCENTE${personTag}]`;
    const finalDesc = `${prefix} ${matDesc}`;

    // Capturar Firma del Solicitante que recibe el material ("Recibí conforme")
    const finalFirmaRecepcion = solicitanteFormSignRef.current ? solicitanteFormSignRef.current.getDataUrl() : null;

    const payload = {
      ambiente: cleanRoom,
      piso: floor,
      pabellon: pab,
      tipoSolicitud: matName,
      responsable: 'OPERACIONES SEDE',
      estado: 'EN PROCESO',
      descripcionSolucion: finalDesc,
      rango: '',
      firmaEntrega: null, // Se firmará al devolver ("Entregué")
      entregadoPor: personName.trim() ? personName.trim().toUpperCase() : '',
      firmaRecepcion: finalFirmaRecepcion,
      recibidoPor: personName.trim() ? personName.trim().toUpperCase() : ''
    };

    setSubmittingLoan(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        const createdTicket = json.data;
        if (finalFirmaRecepcion) {
          try { 
            localStorage.setItem(`upn_sign_recepcion_${createdTicket.id}`, finalFirmaRecepcion); 
          } catch (e) {}
        }

        setTickets(prev => [createdTicket, ...prev]);
        setToastMessage('✅ Préstamo registrado con éxito');
        
        // Reset form
        setPersonName('');
        setRoomInput('');
        setManualItemText('');
        setSelectedMaterialVal('PLUMONES');
        if (solicitanteFormSignRef.current) solicitanteFormSignRef.current.clear();
        setActiveViewTab('ACTIVOS');
        setTimeout(() => setToastMessage(''), 2500);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('❌ Error al guardar el préstamo');
      setTimeout(() => setToastMessage(''), 2500);
    } finally {
      setSubmittingLoan(false);
    }
  };

  // Dinámica Paso 2: Al devolver el objeto, el docente/alumno vuelve a firmar ("Entregué")
  const handleConfirmReturnWithSignature = async (ticket) => {
    const drawnReturnSign = returnSignCanvasRef.current ? returnSignCanvasRef.current.getDataUrl() : null;
    
    try {
      if (drawnReturnSign) {
        // Esta firma certifica que el docente/alumno ENTREGÓ el material de vuelta
        localStorage.setItem(`upn_sign_entrega_${ticket.id}`, drawnReturnSign);
      }
    } catch (e) {}

    const now = new Date();
    const returnTime = now.toTimeString().slice(0, 5);
    const newDesc = ticket.descripcionSolucion.includes('DEVUELTO') 
      ? ticket.descripcionSolucion 
      : `${ticket.descripcionSolucion} [DEVUELTO ${returnTime}]`;

    const updates = { 
      estado: 'ATENDIDO',
      descripcionSolucion: newDesc,
      firmaEntrega: drawnReturnSign, // Firma de devolución ("Entregué")
      fechaFirma: now.toISOString()
    };

    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updates } : t));
    setInlineReceiveTicketId(null);
    setToastMessage('✅ Material devuelto con éxito');
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

  // Recibir devolución directa sin firma (por si el docente tuvo que salir de prisa)
  const handleMarkReturnedDirect = async (ticket) => {
    const updates = { 
      estado: 'ATENDIDO',
      descripcionSolucion: ticket.descripcionSolucion.includes('DEVUELTO') 
        ? ticket.descripcionSolucion 
        : `${ticket.descripcionSolucion} [DEVUELTO]`
    };

    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updates } : t));
    setInlineReceiveTicketId(null);
    setToastMessage(`✅ Material devuelto y archivado`);
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

  // Guardar firma pendiente del solicitante (Recibí) en la tarjeta
  const handleSaveCardSignature = async (ticketId) => {
    const drawnSignature = cardSignCanvasRef.current ? cardSignCanvasRef.current.getDataUrl() : null;
    if (!drawnSignature) {
      setInlineSignTicketId(null);
      return;
    }

    try {
      localStorage.setItem(`upn_sign_recepcion_${ticketId}`, drawnSignature);
    } catch (e) {}

    const updates = { firmaRecepcion: drawnSignature };
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updates } : t));
    setInlineSignTicketId(null);
    setToastMessage('✅ Firma de recepción guardada');
    setTimeout(() => setToastMessage(''), 2500);

    try {
      await fetch(`/api/tickets/${ticketId}`, {
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
    setToastMessage(`↺ Préstamo reactivado en Activos`);
    setTimeout(() => setToastMessage(''), 2000);

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
    if (!confirm('¿Eliminar este registro de préstamo?')) return;
    setTickets(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
  };

  // Filtered lists
  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets;
    const s = search.toLowerCase();
    return tickets.filter(t => 
      (t.ambiente || '').toLowerCase().includes(s) ||
      (t.tipoSolicitud || '').toLowerCase().includes(s) ||
      (t.descripcionSolucion || '').toLowerCase().includes(s)
    );
  }, [tickets, search]);

  const activeLoans = useMemo(() => {
    return filteredTickets.filter(t => t.estado === 'PENDIENTE' || t.estado === 'EN PROCESO');
  }, [filteredTickets]);

  const concludedLoans = useMemo(() => {
    return filteredTickets.filter(t => t.estado === 'ATENDIDO');
  }, [filteredTickets]);

  return (
    <div className="space-y-3 pb-32 md:pb-12 w-full max-w-4xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <ToastBanner
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* =========================================================================
          CABECERA Y PESTAÑAS (ACTIVOS / DEVUELTOS)
          ========================================================================= */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <HandHelping className="w-5 h-5 text-amber-500 stroke-[2.4]" />
          <h1 className="text-base font-black text-slate-950 dark:text-white tracking-tight">
            Préstamos de Material
          </h1>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
          <button
            onClick={() => setActiveViewTab('ACTIVOS')}
            className={`h-8 px-3 rounded-lg font-bold text-xs transition flex items-center gap-1.5 active:scale-95 ${
              activeViewTab === 'ACTIVOS'
                ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Activos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FDBA30] text-slate-950">
              {activeLoans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveViewTab('CONCLUIDOS')}
            className={`h-8 px-3 rounded-lg font-bold text-xs transition flex items-center gap-1.5 active:scale-95 ${
              activeViewTab === 'CONCLUIDOS'
                ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Devueltos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500 text-white">
              {concludedLoans.length}
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          FORMULARIO ÁGIL: PASO 1 (DOCENTE O ALUMNO FIRMA QUE RECIBIÓ EL OBJETO)
          ========================================================================= */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-xs">
        <form onSubmit={handleRegisterLoan} className="space-y-2.5">
          {/* Fila 1: Beneficiario + Nombre + Aula */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-4 grid grid-cols-2 gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setBeneficiaryType('DOCENTE')}
                className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 ${
                  beneficiaryType === 'DOCENTE'
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <User className="w-3.5 h-3.5 stroke-[2.4]" />
                <span>Docente</span>
              </button>

              <button
                type="button"
                onClick={() => setBeneficiaryType('ALUMNO')}
                className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 ${
                  beneficiaryType === 'ALUMNO'
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 stroke-[2.4]" />
                <span>Alumno</span>
              </button>
            </div>

            <div className="sm:col-span-5">
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder={beneficiaryType === 'DOCENTE' ? 'Nombre del Docente' : 'Nombre o Código del Alumno'}
                className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 font-bold focus:outline-none focus:border-[#FDBA30]"
              />
            </div>

            <div className="sm:col-span-3">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="Aula (Opcional)"
                className="w-full h-10 px-3 text-xs font-mono font-bold bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-center uppercase focus:outline-none focus:border-[#FDBA30]"
              />
            </div>
          </div>

          {/* Fila 2: Materiales Rápidos */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CORE_MATERIALS.map(item => {
              const isSelected = selectedMaterialVal === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedMaterialVal(item.id)}
                  className={`h-8 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 border ${
                    isSelected
                      ? 'bg-slate-950 dark:bg-zinc-800 text-white border-slate-950 dark:border-zinc-700 font-black shadow-xs ring-2 ring-amber-400/40'
                      : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  <span>{item.label}</span>
                  {isSelected && <Check className="w-3 h-3 stroke-[3] text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Campo de Material Manual si seleccionó "Otro" */}
          {selectedMaterialVal === 'MANUAL' && (
            <input
              type="text"
              required
              autoFocus
              value={manualItemText}
              onChange={(e) => setManualItemText(e.target.value)}
              placeholder="Escribe el material a prestar: Extensión, Parlante, Puntero..."
              className="w-full h-9 px-3 text-xs font-bold bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          )}

          {/* Fila 3: Firma del Solicitante */}
          <div className="bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-1">
            <SignatureCanvas
              ref={solicitanteFormSignRef}
              title="Firma del Solicitante"
              subtitle="Firma directamente con el dedo en pantalla"
              height={100}
              compact={true}
            />
          </div>

          {/* Botón Único de Registro (1 Toque) */}
          <button
            type="submit"
            disabled={submittingLoan}
            className="w-full h-11 bg-[#FDBA30] hover:bg-[#ffc642] active:bg-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 active:scale-98"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            <span>{submittingLoan ? 'Registrando...' : 'Registrar Préstamo'}</span>
          </button>
        </form>
      </div>

      {/* =========================================================================
          BUSCADOR RÁPIDO (SIN BOTONES REDUNDANTES)
          ========================================================================= */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[2.2]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar préstamo por aula, persona o material..."
          className="w-full pl-10 pr-9 py-2 text-xs bg-white dark:bg-[#0c0c0f] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FDBA30]"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        )}
      </div>

      {/* =========================================================================
          LISTADO DE PRÉSTAMOS (ACTIVOS O DEVUELTOS)
          ========================================================================= */}
      {loading ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200 dark:border-zinc-800">
          <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Cargando...</p>
        </div>
      ) : activeViewTab === 'ACTIVOS' ? (
        activeLoans.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200 dark:border-zinc-800 px-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 stroke-[2.2]" />
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              No hay préstamos activos pendientes de devolución
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeLoans.map(ticket => {
              const ben = parseBeneficiary(ticket.descripcionSolucion);
              const isSigningInline = inlineSignTicketId === ticket.id;
              const isReceivingInline = inlineReceiveTicketId === ticket.id;

              return (
                <div 
                  key={ticket.id}
                  className="bg-white dark:bg-[#0c0c0f] border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-xs bg-slate-900 dark:bg-zinc-800 text-white px-2 py-0.5 rounded-lg">
                          {ticket.ambiente || 'DOCENCIA'}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {ben.type === 'ALUMNO' ? '🎓 Alumno' : '👨‍🏫 Docente'}{ben.name ? `: ${ben.name}` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 stroke-[2.2]" />
                        <span>{ticket.horaReporte || '--:--'}</span>
                      </span>
                    </div>

                    {/* Material */}
                    <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium mb-2">
                      {ticket.tipoSolicitud}
                    </p>

                    {/* Estado de Firma Inicial */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {ticket.firmaRecepcion ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Firma registrada</span>
                        </span>
                      ) : isSigningInline ? null : (
                        <button
                          type="button"
                          onClick={() => setInlineSignTicketId(ticket.id)}
                          className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60 transition inline-flex items-center gap-1 active:scale-95"
                        >
                          <PenTool className="w-3 h-3 text-amber-500" />
                          <span>✍️ Firmar pendiente</span>
                        </button>
                      )}
                    </div>

                    {/* Panel de Firma Inicial si faltaba firmar */}
                    {isSigningInline && (
                      <div className="my-2 p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
                        <SignatureCanvas
                          ref={cardSignCanvasRef}
                          title="Firma del Solicitante"
                          height={90}
                          compact={true}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveCardSignature(ticket.id)}
                            className="flex-1 h-8 bg-[#FDBA30] hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition"
                          >
                            Guardar Firma
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineSignTicketId(null)}
                            className="h-8 px-3 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-lg transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PASO 2: Panel de Devolución */}
                    {isReceivingInline && (
                      <div className="my-2 p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-2">
                        <SignatureCanvas
                          ref={returnSignCanvasRef}
                          title="Firma de Devolución"
                          subtitle="Firma directamente con el dedo en pantalla"
                          height={95}
                          compact={true}
                        />
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleConfirmReturnWithSignature(ticket)}
                            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg transition inline-flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Confirmar Devolución</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkReturnedDirect(ticket)}
                            className="h-8 px-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-[11px] rounded-lg transition"
                            title="Recibir sin requerir firma"
                          >
                            Sin firma
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineReceiveTicketId(null)}
                            className="h-8 px-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-[11px] rounded-lg transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={(e) => handleQuickDownloadPdf(e, ticket)}
                      className="h-9 px-3 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 border border-slate-200 dark:border-zinc-800 active:scale-95"
                      title="Descargar Acta de Cargo en PDF directamente"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300 stroke-[2.2]" />
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInlineReceiveTicketId(ticket.id)}
                      className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95"
                      title="Registrar devolución con firma"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.4]" />
                      <span>Recibir Devolución</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(ticket.id)}
                      className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center justify-center border border-slate-200 dark:border-zinc-800 active:scale-95 shrink-0"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        concludedLoans.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200 dark:border-zinc-800 px-4">
            <p className="text-xs text-slate-500 dark:text-zinc-400">No hay préstamos concluidos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {concludedLoans.map(ticket => {
              const ben = parseBeneficiary(ticket.descripcionSolucion);

              return (
                <div 
                  key={ticket.id}
                  className="bg-white dark:bg-[#0c0c0f] border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between opacity-90"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                          {ticket.ambiente || 'DOCENCIA'}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {ben.type === 'ALUMNO' ? '🎓 Alumno' : '👨‍🏫 Docente'}{ben.name ? `: ${ben.name}` : ''}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        DEVUELTO
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-zinc-400 mb-2">
                      {ticket.tipoSolicitud}
                    </p>

                    {/* Firmas registradas */}
                    <div className="flex items-center gap-1 flex-wrap mb-2">
                      {ticket.firmaRecepcion && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                          ✓ Préstamo firmado
                        </span>
                      )}
                      {ticket.firmaEntrega && (
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                          ✓ Devolución firmada
                        </span>
                      )}
                      {ticket.firmaRecepcion && ticket.firmaEntrega && (
                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                          ★ Doble firma completa
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                      {ticket.fecha} · {ticket.horaReporte}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleQuickDownloadPdf(e, ticket)}
                        className="h-8 px-2.5 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-slate-200 dark:border-zinc-800 active:scale-95"
                      >
                        <Download className="w-3 h-3 stroke-[2.2]" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReopen(ticket)}
                        className="h-8 px-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-amber-200/80 dark:border-amber-800/80 active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3 stroke-[2.2]" />
                        <span>Reabrir</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ticket.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
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
    </div>
  );
}
