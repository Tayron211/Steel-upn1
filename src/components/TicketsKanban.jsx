import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createDbChangeGate } from '../utils/webSignGate';
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
  Users,
  GraduationCap,
  PenTool,
  Download,
  Calendar,
  Building2,
  Grid3X3,
  Layers,
  Eye,
  Plus,
  Copy,
  Table,
  LayoutGrid,
  AlertTriangle
} from 'lucide-react';
import ToastBanner from './ToastBanner';
import SignatureCanvas from './SignatureCanvas';
import { useFadeModal } from '../utils/useFadeModal';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';
import CustomTimePicker from './CustomTimePicker';
import { useAssistants } from '../utils/assistants';
import { getLoggedAssistantName, isAdmin } from '../utils/auth';
import { generateCargoPdf } from '../utils/cargoPdfGenerator';

import { CAMPUS_ROOMS } from '../utils/campusRooms';

const copyRichTableToClipboard = async (plainText, htmlText) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && window.ClipboardItem) {
    try {
      const blobHtml = new Blob([htmlText], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const item = new window.ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (e) {
      console.warn('ClipboardItem copy failed, trying fallback:', e);
    }
  }

  if (typeof document !== 'undefined') {
    try {
      let copyOk = false;
      const listener = (e) => {
        e.preventDefault();
        e.clipboardData.setData('text/html', htmlText);
        e.clipboardData.setData('text/plain', plainText);
        copyOk = true;
      };
      document.addEventListener('copy', listener);
      const successful = document.execCommand('copy');
      document.removeEventListener('copy', listener);
      if (copyOk || successful) return true;
    } catch (err) {
      console.warn('Fallback copy listener falló:', err);
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(plainText);
        return true;
      } catch (e) {
        console.warn('navigator.clipboard.writeText falló:', e);
      }
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = plainText;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Error en fallback execCommand copy:', err);
      return false;
    }
  }
  return false;
};

const CORE_MATERIALS = [
  { id: 'PROYECTOR', label: 'PROYECTOR', icon: '📽️', desc: 'Préstamo de Proyector' },
  { id: 'PUNTERO', label: 'PUNTERO', icon: '🎯', desc: 'Préstamo de Puntero' },
  { id: 'CABLE HDMI', label: 'CABLE HDMI', icon: '🔌', desc: 'Préstamo de Cable HDMI' },
  { id: 'ADAPTADOR', label: 'ADAPTADOR', icon: '⚡', desc: 'Préstamo de Adaptador' },
  { id: 'CUTTING', label: 'CUTTING', icon: '🔪', desc: 'Préstamo de Cutting' },
  { id: 'MOUSE', label: 'MOUSE', icon: '🖱️', desc: 'Préstamo de Mouse' },
  { id: 'CAMARA WEB', label: 'CAMARA WEB', icon: '📷', desc: 'Préstamo de Cámara Web' },
  { id: 'CABLE DE RED', label: 'CABLE DE RED', icon: '🌐', desc: 'Préstamo de Cable de Red' },
  { id: 'AUDIFONOS', label: 'AUDIFONOS', icon: '🎧', desc: 'Préstamo de Audífonos' },
  { id: 'ADAPTADOR VGA/HDMI', label: 'ADAPT. VGA/HDMI', icon: '🔌', desc: 'Préstamo de Adaptador VGA/HDMI' },
  { id: 'CAMARA DIGITAL', label: 'CAMARA DIGITAL', icon: '📸', desc: 'Préstamo de Cámara Digital' },
  { id: 'MANUAL', label: 'OTRO / MANUAL', icon: '✏️', desc: '' }
];

const computeRango = (timeStr) => {
  const m = String(timeStr || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '10:00 – 11:00';
  const hh = parseInt(m[1], 10);
  const nextH = (hh + 1) % 24;
  return `${String(hh).padStart(2, '0')}:00 – ${String(nextH).padStart(2, '0')}:00`;
};

const getDayOfWeek = (dateStr) => {
  if (!dateStr) return 'LUNES';
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return 'LUNES';
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return days[date.getUTCDay()] || 'LUNES';
};

const deduceFloor = (roomStr) => {
  const s = String(roomStr || '').toUpperCase().trim();
  if (s.startsWith('AS')) return 'SÓTANO';
  const num = s.replace(/\D/g, '');
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

const cleanExcelVal = (val) => {
  if (!val) return '';
  const s = String(val).trim();
  if (s.includes('#') || s.toUpperCase().includes('REF') || s.toUpperCase().includes('N/D') || s.toUpperCase().includes('VAL')) return '';
  return s;
};

const getTicketPabPisoText = (ticket) => {
  if (!ticket) return '';
  const room = (ticket.ambiente || '').toUpperCase().trim();
  let pab = cleanExcelVal(ticket.pabellon);
  let piso = cleanExcelVal(ticket.piso);

  // Si pabellon o piso vinieron con error de fórmula de Excel (#¡REF!), deducirlos limpiamente del aula
  if (!pab && room) {
    if (room.startsWith('B')) pab = 'B';
    else if (room.startsWith('A')) pab = 'A';
  }
  if (!piso && room && room !== 'DOCENCIA' && room !== 'SEDE') {
    piso = deduceFloor(room);
  }

  pab = cleanExcelVal(pab);
  piso = cleanExcelVal(piso);

  const parts = [];
  if (pab && pab !== 'SEDE') parts.push(`Pab. ${pab}`);
  if (piso && piso !== 'Sede' && piso !== 'SEDE') parts.push(`(${piso})`);
  return parts.join(' ');
};

export default function TicketsKanban({
  initialNewTicket,
  onClearInitialTicket,
  openModalTrigger = null,
  onConsumeModalTrigger = null,
  onPendingCountChange = null
}) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeViewTab, setActiveViewTab] = useState('ACTIVOS'); // 'ACTIVOS' | 'CONCLUIDOS'

  const asistentes = useAssistants();

  // Modal State para Registrar Préstamo de Material
  const [isNewLoanModalOpen, setIsNewLoanModalOpen] = useState(false);

  // Form State (100% Sincronizado con las 12 columnas de ATENCIONES 2026-2)
  // Columna 1 & 2: FECHA y DIA
  const [loanDate, setLoanDate] = useState(() => new Date().toISOString().split('T')[0]);
  // Columna 3 & 4: HORA DE REPORTE y RANGO
  const [loanTime, setLoanTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [loanRango, setLoanRango] = useState(() => computeRango(new Date().toTimeString().slice(0, 5)));
  // Columna 5, 6, 7: AMBIENTE, PISO y PABELLÓN
  const [roomInput, setRoomInput] = useState('');
  // Columna 8: TIPO DE SOLICITUD (Multiselección + opción manual)
  const [selectedMaterials, setSelectedMaterials] = useState(['PROYECTOR']);
  const [manualItemText, setManualItemText] = useState('');
  // Columna 9: ESTADO
  const [loanStatus, setLoanStatus] = useState('EN PROCESO'); // 'EN PROCESO' | 'ATENDIDO' | 'PENDIENTE'
  // Columna 10: USUARIO
  const [beneficiaryType, setBeneficiaryType] = useState('DOCENTE'); // 'DOCENTE' | 'ALUMNO'
  const [personName, setPersonName] = useState('');
  // Columna 11: DESCRIPCIÓN / SOLUCIÓN
  const [loanDescription, setLoanDescription] = useState('');
  // Columna 12: RESPONSABLE (Autocompletado con el asistente autenticado)
  const [loanResponsable, setLoanResponsable] = useState(() => getLoggedAssistantName());

  useEffect(() => {
    if (!isAdmin()) {
      setLoanResponsable(getLoggedAssistantName());
    }
  }, [isNewLoanModalOpen]);

  const [submittingLoan, setSubmittingLoan] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Helper para multiselección de materiales
  const toggleMaterial = (id) => {
    setSelectedMaterials(prev => {
      if (prev.includes(id)) {
        return prev.filter(m => m !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Inline Card Signing (Zero popups!)
  const [inlineSignTicketId, setInlineSignTicketId] = useState(null);
  const [inlineReceiveTicketId, setInlineReceiveTicketId] = useState(null);
  const [detailTicket, setDetailTicket] = useState(null);

  // Signature canvas refs
  const solicitanteFormSignRef = useRef(null);
  const cardSignCanvasRef = useRef(null);
  const returnSignCanvasRef = useRef(null);

  // Search filter
  const [search, setSearch] = useState('');

  // Classroom Calendar Picker State (Excel catalog & categorization)
  const [isRoomCalendarOpen, setIsRoomCalendarOpen] = useState(false);

  const roomCalendarFade = useFadeModal(isRoomCalendarOpen, () => setIsRoomCalendarOpen(false), 200);
  const detailTicketFade = useFadeModal(detailTicket, () => setDetailTicket(null), 200);
  const newLoanFade = useFadeModal(isNewLoanModalOpen, () => setIsNewLoanModalOpen(false), 200);
  const [calendarPabellon, setCalendarPabellon] = useState('A'); // 'A' | 'B' | 'TODOS'
  const [calendarPiso, setCalendarPiso] = useState('TODOS');
  const [calendarCategory, setCalendarCategory] = useState('TODOS'); // 'TODOS' | 'AULA' | 'LABORATORIO' | 'TALLER'
  const [calendarSearch, setCalendarSearch] = useState('');
  const [roomsList, setRoomsList] = useState(CAMPUS_ROOMS);

  useEffect(() => {
    fetch('/api/rooms')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data && json.data.length > 0) {
          const roomMap = new Map(CAMPUS_ROOMS.map(r => [r.abrv, r]));
          const merged = json.data.map(r => {
            const existing = roomMap.get(r.abrv);
            if (existing) {
              return {
                ...existing,
                nombre: r.nombre || existing.nombre,
                piso: r.piso || existing.piso,
                pabellon: r.pabellon || existing.pabellon,
                aforo: r.aforo || existing.aforo
              };
            }
            const nLower = (r.nombre || '').toLowerCase();
            const isLab = nLower.includes('laboratorio');
            const isTaller = nLower.includes('taller');
            let cat = isLab ? 'LABORATORIO' : isTaller ? 'TALLER' : 'AULA';
            let tag = isLab ? 'Laboratorio' : isTaller ? 'Taller' : 'Aula';
            if (nLower.includes('cómputo')) tag = 'Lab. Cómputo';
            return {
              abrv: r.abrv,
              nombre: r.nombre || r.abrv,
              pabellon: r.pabellon || (r.abrv.startsWith('B') ? 'B' : 'A'),
              piso: r.piso || '',
              pisoOrder: r.piso?.includes('SÓT') ? 0 : r.piso?.includes('1') ? 1 : r.piso?.includes('2') ? 2 : r.piso?.includes('3') ? 3 : r.piso?.includes('4') ? 4 : 5,
              categoria: cat,
              tag: tag,
              aforo: r.aforo || 40
            };
          });

          merged.sort((a, b) => {
            if (a.pabellon !== b.pabellon) return a.pabellon.localeCompare(b.pabellon);
            if (a.pisoOrder !== b.pisoOrder) return a.pisoOrder - b.pisoOrder;
            return a.abrv.localeCompare(b.abrv);
          });
          setRoomsList(merged);
        }
      })
      .catch(() => { });
  }, []);

  const filteredCalendarRooms = useMemo(() => {
    return roomsList.filter(room => {
      if (calendarPabellon !== 'TODOS' && room.pabellon !== calendarPabellon) return false;
      if (calendarCategory !== 'TODOS') {
        if (calendarCategory === 'AULA') {
          if (room.categoria !== 'AULA' && room.tipoAmbiente !== 'AULA') return false;
        } else if (calendarCategory === 'TALLER_ESP') {
          if (room.categoria !== 'TALLER_ESP' && room.tipoAmbiente !== 'TALLER ESPECIALIZADO') return false;
        } else if (calendarCategory === 'TALLER_ARQ') {
          if (room.categoria !== 'TALLER_ARQ' && room.tipoAmbiente !== 'TALLER DE ARQUITECTURA Y DIBUJO') return false;
        } else if (calendarCategory === 'LAB_ESP') {
          if (room.categoria !== 'LAB_ESP' && room.tipoAmbiente !== 'LABORATORIO ESPECIALIZADO') return false;
        } else if (calendarCategory === 'LAB_COMPUTO') {
          if (room.categoria !== 'LAB_COMPUTO' && room.tipoAmbiente !== 'LABORATORIO DE CÓMPUTO') return false;
        }
      }
      if (calendarPiso !== 'TODOS') {
        const pNorm = (room.piso || '').toUpperCase();
        if (calendarPiso === 'SÓTANO' && !pNorm.includes('SÓT') && !pNorm.includes('SOT')) return false;
        if (calendarPiso === '1ER PISO' && !pNorm.includes('1') && !pNorm.includes('PRIMER')) return false;
        if (calendarPiso === '2DO PISO' && !pNorm.includes('2') && !pNorm.includes('SEGUNDO')) return false;
        if (calendarPiso === '3ER PISO' && !pNorm.includes('3') && !pNorm.includes('TERCER')) return false;
        if (calendarPiso === '4TO PISO' && !pNorm.includes('4') && !pNorm.includes('CUARTO')) return false;
        if (calendarPiso === '5TO PISO' && !pNorm.includes('5') && !pNorm.includes('QUINTO')) return false;
      }
      if (calendarSearch.trim()) {
        const q = calendarSearch.trim().toLowerCase();
        return room.abrv.toLowerCase().includes(q) ||
          (room.nombre && room.nombre.toLowerCase().includes(q)) ||
          (room.tag && room.tag.toLowerCase().includes(q)) ||
          (room.tipoAmbiente && room.tipoAmbiente.toLowerCase().includes(q));
      }
      return true;
    });
  }, [roomsList, calendarPabellon, calendarPiso, calendarCategory, calendarSearch]);

  const parseBeneficiary = (desc = '') => {
    const raw = String(desc || '');
    const matchAlumno = raw.match(/\[🎓?\s*ALUMNO(?::\s*([^\]]+))?\]/i);
    if (matchAlumno) {
      return {
        type: 'ALUMNO',
        label: 'Alumno',
        name: matchAlumno[1] ? matchAlumno[1].trim() : ''
      };
    }
    const matchDocente = raw.match(/\[👨‍🏫?\s*DOCENTE(?::\s*([^\]]+))?\]/i);
    if (matchDocente) {
      return {
        type: 'DOCENTE',
        label: 'Docente',
        name: matchDocente[1] ? matchDocente[1].trim() : ''
      };
    }
    if (raw.toUpperCase().includes('ALUMNO')) {
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
      } catch (e) { }
      return {
        ...t,
        firmaEntrega: fEntrega || null,
        firmaRecepcion: fRecepcion || null
      };
    });
  };

  const loadTickets = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
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

  const dbChanged = useMemo(() => createDbChangeGate(), []);

  const silentRefreshTickets = async () => {
    try {
      if (!(await dbChanged())) return; // sin escrituras nuevas -> no gastar lecturas de D1
      const res = await fetch('/api/tickets');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickets(mergeWithLocalSignatures(json.data));
      }
    } catch (err) { }
  };

  useEffect(() => {
    loadTickets(true);
    const handlePulled = () => loadTickets(false);
    window.addEventListener('upn:excel-pulled', handlePulled);
    const interval = setInterval(silentRefreshTickets, 30000);
    return () => {
      window.removeEventListener('upn:excel-pulled', handlePulled);
      clearInterval(interval);
    };
  }, []);

  // Prefill desde vistas externas y apertura automática del modal
  useEffect(() => {
    if (initialNewTicket) {
      setActiveViewTab('ACTIVOS');
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
        if (found) setSelectedMaterials([found.id]);
      }
      setIsNewLoanModalOpen(true);
      if (onClearInitialTicket) onClearInitialTicket();
    }
  }, [initialNewTicket]);

  useEffect(() => {
    if (openModalTrigger) {
      setActiveViewTab('ACTIVOS');
      setIsNewLoanModalOpen(true);
      if (onConsumeModalTrigger) onConsumeModalTrigger();
    }
  }, [openModalTrigger]);

  // 1-Tap PDF download (directly downloads official slip voucher, NO MODAL!)
  const handleQuickDownloadPdf = (e, ticket) => {
    e.stopPropagation();
    const ben = parseBeneficiary(ticket.descripcionSolucion);
    const recipientName = ticket.recibidoPor || ben.name || 'Docente / Solicitante';
    const assistantName = ticket.responsable || ticket.asistente || getLoggedAssistantName();

    generateCargoPdf({
      ticket,
      entregadoPor: assistantName,
      recibidoPor: recipientName,
      firmaEntrega: ticket.firmaEntrega || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_entrega_${ticket.id}`) : null),
      firmaRecepcion: ticket.firmaRecepcion || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_recepcion_${ticket.id}`) : null)
    });
  };

  // Actualiza hora de reporte y recalcula automáticamente el rango horario (ej. 10:00 – 11:00)
  const handleTimeChange = (newTime) => {
    setLoanTime(newTime);
    setLoanRango(computeRango(newTime));
  };

  // Generador oficial de Tabla de Préstamos en HTML y TSV (12 columnas oficiales de ATENCIONES 2026-2)
  // FECHA | DIA | HORA DE REPORTE | RANGO | AMBIENTE | PISO | PABELLÓN | TIPO DE SOLICITUD | ESTADO | USUARIO | DESCRIPCIÓN / SOLUCIÓN | RESPONSABLE
  const generateTicketsTableData = (items) => {
    const list = Array.isArray(items) ? items : [items];
    const headers = ['FECHA', 'DIA', 'HORA DE REPORTE', 'RANGO', 'AMBIENTE', 'PISO', 'PABELLÓN', 'TIPO DE SOLICITUD', 'ESTADO', 'USUARIO', 'DESCRIPCIÓN / SOLUCIÓN', 'RESPONSABLE'];

    const thStyle = 'background-color:#FFC000;color:#000000;font-weight:bold;border:1px solid #000000;padding:6px 10px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:11pt;white-space:nowrap;';
    const tdCenter = 'border:1px solid #000000;padding:6px 8px;font-family:Calibri,Arial,sans-serif;font-size:10pt;text-align:center;background-color:#FFFFFF;color:#000000;white-space:nowrap;';
    const tdLeft = 'border:1px solid #000000;padding:6px 8px;font-family:Calibri,Arial,sans-serif;font-size:10pt;text-align:left;background-color:#FFFFFF;color:#000000;white-space:nowrap;';

    const rowsHtml = list.map(ticket => {
      let rawFecha = ticket.fecha || new Date().toISOString().split('T')[0];
      let fecha = rawFecha;
      if (rawFecha.includes('-')) {
        const parts = rawFecha.split('T')[0].split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          fecha = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const rawDia = ticket.dia || getDayOfWeek(rawFecha) || 'LUNES';
      const dia = String(rawDia).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      let hora = ticket.horaReporte || ticket.hora_reporte || '';
      if (hora.length > 5 && hora.includes(':')) hora = hora.slice(0, 5);
      if (!hora) {
        const now = new Date();
        hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }

      const rango = ticket.rango || computeRango(hora);
      const ambiente = (ticket.ambiente || 'DOCENCIA').toUpperCase().trim();
      const piso = cleanExcelVal(ticket.piso) || deduceFloor(ambiente) || 'PRIMER PISO';
      const cleanPab = cleanExcelVal(ticket.pabellon);
      const pabellon = cleanPab || (ambiente.startsWith('B') ? 'B' : (ambiente.startsWith('A') ? 'A' : 'SEDE'));
      const tipo = (ticket.tipoSolicitud || 'PROYECTOR').toUpperCase().trim();
      const hasSign1 = Boolean(
        (ticket.firmaRecepcion && String(ticket.firmaRecepcion).length > 20) ||
        (ticket.firma_recepcion && String(ticket.firma_recepcion).length > 20)
      );
      const hasSign2 = Boolean(
        (ticket.firmaDevolucion && String(ticket.firmaDevolucion).length > 20) ||
        (ticket.firma_devolucion && String(ticket.firma_devolucion).length > 20) ||
        (ticket.firmaEntrega && String(ticket.firmaEntrega).length > 20) ||
        (ticket.firma_entrega && String(ticket.firma_entrega).length > 20)
      );
      const isDevuelto = Boolean(
        ticket.fechaDevolucion ||
        ticket.fecha_devolucion ||
        String(ticket.descripcionSolucion || ticket.descripcion || '').toUpperCase().includes('DEVUELTO')
      );

      // Solo saldrá ATENDIDO cuando estén las dos firmas y devuelto; mientras solo esté en una firma seguirá EN PROCESO
      const estado = (hasSign1 && hasSign2 && isDevuelto) ? 'ATENDIDO' : 'EN PROCESO';
      const usuario = ticket.usuario || (String(ticket.descripcionSolucion || '').toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE');
      const descripcion = ticket.descripcionSolucion || ticket.descripcion || '';
      const responsable = (ticket.responsable || 'TAYRON SALINAS').toUpperCase().trim();

      const isAtendido = estado === 'ATENDIDO' || estado === 'DEVUELTO' || estado === 'RESUELTO';
      const isProceso = estado === 'EN PROCESO';
      const bgCol = isAtendido ? '#C6EFCE' : isProceso ? '#FFC7CE' : '#FFEB9C';
      const textCol = isAtendido ? '#006100' : isProceso ? '#9C0006' : '#9C5700';

      const tdEstado = `border:1px solid #000000;padding:6px 8px;font-family:Calibri,Arial,sans-serif;font-size:10pt;text-align:center;font-weight:bold;background-color:${bgCol};color:${textCol};white-space:nowrap;`;

      return `<tr>
        <td style="${tdCenter}">${fecha}</td>
        <td style="${tdCenter}">${dia}</td>
        <td style="${tdCenter}">${hora}</td>
        <td style="${tdCenter}">${rango}</td>
        <td style="${tdCenter}">${ambiente}</td>
        <td style="${tdCenter}">${piso}</td>
        <td style="${tdCenter}">${pabellon}</td>
        <td style="${tdLeft}">${tipo}</td>
        <td style="${tdEstado}">${estado}</td>
        <td style="${tdCenter}">${usuario}</td>
        <td style="${tdLeft}">${descripcion}</td>
        <td style="${tdLeft}">${responsable}</td>
      </tr>`;
    }).join('');

    const html = `
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<!--StartFragment-->
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #000000;font-family:Calibri,Arial,sans-serif;font-size:10pt;">
  <thead>
    <tr>
      ${headers.map(h => `<th style="${thStyle}">${h}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>
<!--EndFragment-->`.trim();

    const plainRows = list.map(ticket => {
      let rawFecha = ticket.fecha || new Date().toISOString().split('T')[0];
      let fecha = rawFecha;
      if (rawFecha.includes('-')) {
        const parts = rawFecha.split('T')[0].split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          fecha = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const rawDia = ticket.dia || getDayOfWeek(rawFecha) || 'LUNES';
      const dia = String(rawDia).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      let hora = ticket.horaReporte || ticket.hora_reporte || '';
      if (hora.length > 5 && hora.includes(':')) hora = hora.slice(0, 5);
      if (!hora) {
        const now = new Date();
        hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }

      const rango = ticket.rango || computeRango(hora);
      const ambiente = (ticket.ambiente || 'DOCENCIA').toUpperCase().trim();
      const piso = cleanExcelVal(ticket.piso) || deduceFloor(ambiente) || 'PRIMER PISO';
      const cleanPab = cleanExcelVal(ticket.pabellon);
      const pabellon = cleanPab || (ambiente.startsWith('B') ? 'B' : (ambiente.startsWith('A') ? 'A' : 'SEDE'));
      const tipo = (ticket.tipoSolicitud || 'PROYECTOR').toUpperCase().trim();
      const hasSign1 = Boolean(
        (ticket.firmaRecepcion && String(ticket.firmaRecepcion).length > 20) ||
        (ticket.firma_recepcion && String(ticket.firma_recepcion).length > 20)
      );
      const hasSign2 = Boolean(
        (ticket.firmaDevolucion && String(ticket.firmaDevolucion).length > 20) ||
        (ticket.firma_devolucion && String(ticket.firma_devolucion).length > 20) ||
        (ticket.firmaEntrega && String(ticket.firmaEntrega).length > 20) ||
        (ticket.firma_entrega && String(ticket.firma_entrega).length > 20)
      );
      const isDevuelto = Boolean(
        ticket.fechaDevolucion ||
        ticket.fecha_devolucion ||
        String(ticket.descripcionSolucion || ticket.descripcion || '').toUpperCase().includes('DEVUELTO')
      );

      // Solo saldrá ATENDIDO cuando estén las dos firmas y devuelto; mientras solo esté en una firma seguirá EN PROCESO
      const estado = (hasSign1 && hasSign2 && isDevuelto) ? 'ATENDIDO' : 'EN PROCESO';
      const usuario = ticket.usuario || (String(ticket.descripcionSolucion || '').toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE');
      const descripcion = ticket.descripcionSolucion || ticket.descripcion || '';
      const responsable = (ticket.responsable || 'TAYRON SALINAS').toUpperCase().trim();

      return [fecha, dia, hora, rango, ambiente, piso, pabellon, tipo, estado, usuario, descripcion, responsable].join('\t');
    });

    const plain = [headers.join('\t'), ...plainRows].join('\n');
    return { html, plain };
  };

  // Copia la fila de Excel en formato Tabla HTML rico + TSV (solo para devueltos/atendidos)
  const copyTicketExcelRow = async (ticket) => {
    try {
      const { html, plain } = generateTicketsTableData(ticket);
      const ok = await copyRichTableToClipboard(plain, html);
      if (ok) {
        setToastMessage(`📋 Tabla copiada (${ticket.ambiente} · ${ticket.tipoSolicitud})`);
      } else {
        setToastMessage('❌ No se pudo copiar al portapapeles');
      }
      setTimeout(() => setToastMessage(''), 2500);
    } catch (err) {
      console.error('Error al copiar ticket:', err);
      setToastMessage('❌ Error al copiar tabla');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  // Copiar toda la tabla de préstamos en Formato Oficial Excel
  const handleCopyAllTicketsTable = async (itemsToCopy) => {
    try {
      const list = itemsToCopy && itemsToCopy.length > 0 ? itemsToCopy : concludedLoans;
      if (list.length === 0) {
        setToastMessage('⚠️ No hay préstamos para copiar');
        setTimeout(() => setToastMessage(''), 2000);
        return;
      }
      const { html, plain } = generateTicketsTableData(list);
      const ok = await copyRichTableToClipboard(plain, html);
      if (ok) {
        setToastMessage(`📋 Tabla de préstamos copiada (${list.length} filas en formato oficial)`);
      } else {
        setToastMessage('❌ No se pudo copiar la tabla');
      }
      setTimeout(() => setToastMessage(''), 2500);
    } catch (err) {
      console.error('Error al copiar tabla completa:', err);
      setToastMessage('❌ Error al copiar tabla');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  // Dinámica Paso 1: El docente/alumno firma que RECIBE el material ("Recibí")
  const handleRegisterLoan = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Material / Tipo de Solicitud (Multiselección + Manual)
    const selectedList = Array.isArray(selectedMaterials) ? [...selectedMaterials] : [];
    const hasManual = selectedList.includes('MANUAL');
    const standardMaterials = selectedList.filter(id => id !== 'MANUAL');

    let allSelectedNames = [...standardMaterials];
    if (hasManual) {
      const cleanManual = manualItemText.trim().toUpperCase();
      if (cleanManual) {
        allSelectedNames.push(cleanManual);
      } else if (standardMaterials.length === 0) {
        setToastMessage('⚠️ Escribe el material que estás prestando');
        setTimeout(() => setToastMessage(''), 2500);
        return;
      }
    }

    if (allSelectedNames.length === 0) {
      setToastMessage('⚠️ Selecciona al menos un material');
      setTimeout(() => setToastMessage(''), 2500);
      return;
    }

    const matName = allSelectedNames.join(', ');
    const matDesc = `Préstamo de ${matName}`;

    const rawRoom = roomInput.trim().toUpperCase();
    const cleanRoom = rawRoom || (beneficiaryType === 'DOCENTE' ? 'DOCENCIA' : 'SEDE');
    const pab = cleanRoom.startsWith('B') ? 'B' : (cleanRoom.startsWith('A') ? 'A' : 'SEDE');
    const floor = (cleanRoom === 'DOCENCIA' || cleanRoom === 'SEDE' || cleanRoom === 'GENERAL')
      ? 'Sede'
      : deduceFloor(cleanRoom);

    const personTag = personName.trim() ? `: ${personName.trim().toUpperCase()}` : '';
    const prefix = beneficiaryType === 'ALUMNO' ? `[🎓 ALUMNO${personTag}]` : `[👨‍🏫 DOCENTE${personTag}]`;
    const extraDetail = loanDescription.trim() ? ` - ${loanDescription.trim()}` : '';
    const finalDesc = `${prefix} ${matDesc}${extraDetail}`;

    // Capturar Firma del Solicitante que recibe el material ("Recibí conforme")
    const finalFirmaRecepcion = solicitanteFormSignRef.current ? solicitanteFormSignRef.current.getDataUrl() : null;

    const finalDate = loanDate || new Date().toISOString().split('T')[0];
    const finalDay = getDayOfWeek(finalDate) || 'LUNES';
    const finalTime = loanTime || new Date().toTimeString().slice(0, 5);
    const finalRango = loanRango || computeRango(finalTime);

    const payload = {
      fecha: finalDate,
      dia: finalDay,
      horaReporte: finalTime,
      rango: finalRango,
      ambiente: cleanRoom,
      piso: floor,
      pabellon: pab,
      tipoSolicitud: matName,
      responsable: (isAdmin() ? loanResponsable : getLoggedAssistantName()) || getLoggedAssistantName(),
      estado: loanStatus || 'EN PROCESO',
      usuario: beneficiaryType, // 'DOCENTE' o 'ALUMNO'
      descripcionSolucion: finalDesc,
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
          } catch (e) { }
        }

        setTickets(prev => [createdTicket, ...prev]);
        setToastMessage('✅ Préstamo registrado con éxito en ATENCIONES');

        // Reset form
        setPersonName('');
        setRoomInput('');
        setManualItemText('');
        setLoanDescription('');
        setSelectedMaterials(['PROYECTOR']);
        setLoanStatus('EN PROCESO');
        if (solicitanteFormSignRef.current) solicitanteFormSignRef.current.clear();
        setIsNewLoanModalOpen(false);
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
  const handleConfirmReturnWithSignature = async (ticket, passedSignature = null) => {
    const drawnReturnSign = passedSignature || (returnSignCanvasRef.current ? returnSignCanvasRef.current.getDataUrl() : null);

    try {
      if (drawnReturnSign) {
        // Esta firma certifica que el docente/alumno ENTREGÓ el material de vuelta
        localStorage.setItem(`upn_sign_entrega_${ticket.id}`, drawnReturnSign);
        localStorage.setItem(`upn_sign_devolucion_${ticket.id}`, drawnReturnSign);
      }
    } catch (e) { }

    const now = new Date();
    const returnTime = now.toTimeString().slice(0, 5);
    const newDesc = ticket.descripcionSolucion.includes('DEVUELTO')
      ? ticket.descripcionSolucion
      : `${ticket.descripcionSolucion} [DEVUELTO ${returnTime}]`;

    // REGLA ESTRICTA: Solo saldrá ATENDIDO cuando estén las DOS firmas (inicial + devolución) y devuelto.
    // Mientras solo esté en una firma (o ninguna), seguirá EN PROCESO.
    const hasInitialSign = Boolean(
      (ticket.firmaRecepcion && String(ticket.firmaRecepcion).length > 20) ||
      (ticket.firma_recepcion && String(ticket.firma_recepcion).length > 20) ||
      localStorage.getItem(`upn_sign_recepcion_${ticket.id}`)
    );
    const hasReturnSign = Boolean(drawnReturnSign && String(drawnReturnSign).length > 20);

    const finalEstado = (hasInitialSign && hasReturnSign) ? 'ATENDIDO' : 'EN PROCESO';

    const updates = {
      estado: finalEstado,
      descripcionSolucion: newDesc,
      firmaEntrega: drawnReturnSign || ticket.firmaEntrega || null,
      firmaDevolucion: drawnReturnSign || null,
      fechaFirma: now.toISOString(),
      fechaDevolucion: now.toISOString()
    };

    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updates } : t));
    setInlineReceiveTicketId(null);
    if (finalEstado === 'ATENDIDO') {
      setToastMessage('✅ Material devuelto con doble firma (Concluido y Atendido)');
    } else {
      setToastMessage('⏳ Devolución registrada con una sola firma (Permanece En Proceso hasta completar ambas firmas)');
    }
    setTimeout(() => setToastMessage(''), 3000);

    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      triggerAutoSyncLinkedExcel();
    } catch (err) {
      console.error(err);
    }
  };

  // Recibir devolución directa sin firma (por si el docente tuvo que salir de prisa)
  const handleMarkReturnedDirect = async (ticket) => {
    const now = new Date();
    const returnTime = now.toTimeString().slice(0, 5);
    const hasInitialSign = Boolean(
      (ticket.firmaRecepcion && String(ticket.firmaRecepcion).length > 20) ||
      (ticket.firma_recepcion && String(ticket.firma_recepcion).length > 20) ||
      localStorage.getItem(`upn_sign_recepcion_${ticket.id}`)
    );
    const hasReturnSign = Boolean(
      (ticket.firmaDevolucion && String(ticket.firmaDevolucion).length > 20) ||
      (ticket.firmaEntrega && String(ticket.firmaEntrega).length > 20) ||
      localStorage.getItem(`upn_sign_devolucion_${ticket.id}`)
    );

    // Si no tiene ambas firmas, sigue EN PROCESO
    const finalEstado = (hasInitialSign && hasReturnSign) ? 'ATENDIDO' : 'EN PROCESO';

    const updates = {
      estado: finalEstado,
      descripcionSolucion: ticket.descripcionSolucion.includes('DEVUELTO')
        ? ticket.descripcionSolucion
        : `${ticket.descripcionSolucion} [DEVUELTO ${returnTime}]`,
      fechaDevolucion: now.toISOString()
    };

    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...updates } : t));
    setInlineReceiveTicketId(null);
    if (finalEstado === 'ATENDIDO') {
      setToastMessage('✅ Material devuelto con doble firma (Concluido)');
    } else {
      setToastMessage('⏳ Devolución registrada sin firma completa (Permanece En Proceso)');
    }
    setTimeout(() => setToastMessage(''), 3000);

    try {
      await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      triggerAutoSyncLinkedExcel();
    } catch (err) {
      console.error(err);
    }
  };

  // Guardar firma pendiente del solicitante (Recibí) en la tarjeta
  const handleSaveCardSignature = async (ticketId, passedSignature = null) => {
    const drawnSignature = passedSignature || (cardSignCanvasRef.current ? cardSignCanvasRef.current.getDataUrl() : null);
    if (!drawnSignature) {
      setInlineSignTicketId(null);
      return;
    }

    try {
      localStorage.setItem(`upn_sign_recepcion_${ticketId}`, drawnSignature);
    } catch (e) { }

    const targetTicket = tickets.find(t => t.id === ticketId);
    const hasReturnSign = Boolean(
      targetTicket && (
        (targetTicket.firmaDevolucion && String(targetTicket.firmaDevolucion).length > 20) ||
        (targetTicket.firmaEntrega && String(targetTicket.firmaEntrega).length > 20) ||
        localStorage.getItem(`upn_sign_devolucion_${ticketId}`)
      )
    );
    const isDevuelto = Boolean(
      targetTicket && (
        targetTicket.fechaDevolucion ||
        String(targetTicket.descripcionSolucion || '').toUpperCase().includes('DEVUELTO')
      )
    );

    const finalEstado = (drawnSignature && hasReturnSign && isDevuelto) ? 'ATENDIDO' : 'EN PROCESO';

    const updates = {
      firmaRecepcion: drawnSignature,
      estado: finalEstado,
      fechaFirma: new Date().toISOString()
    };
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...updates } : t));
    setInlineSignTicketId(null);
    if (finalEstado === 'ATENDIDO') {
      setToastMessage('✅ Ambas firmas completadas y material devuelto (Atendido)');
    } else {
      setToastMessage('✅ Firma de recepción guardada (Permanece En Proceso hasta devolución)');
    }
    setTimeout(() => setToastMessage(''), 2500);

    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      triggerAutoSyncLinkedExcel();
    } catch (err) {
      console.error(err);
    }
  };

  // Limpiar todas las devoluciones archivadas en la app
  const handleClearConcluded = async () => {
    if (!window.confirm('¿Está seguro de limpiar todas las devoluciones archivadas en la app?')) return;
    try {
      const res = await fetch('/api/tickets/clear-concluded', { method: 'POST' });
      const j = await res.json();
      if (j && j.success) {
        setTickets(prev => prev.filter(t => t.estado === 'PENDIENTE' || t.estado === 'EN PROCESO'));
        setToastMessage('✅ Devoluciones limpiadas exitosamente en la app');
        setTimeout(() => setToastMessage(''), 2500);
      }
    } catch (err) {
      console.error(err);
      setToastMessage('❌ Error al limpiar devoluciones');
      setTimeout(() => setToastMessage(''), 2500);
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
    return filteredTickets
      .filter(t => t.estado === 'PENDIENTE' || t.estado === 'EN PROCESO')
      .sort((a, b) => {
        const dateA = a.fecha || '';
        const dateB = b.fecha || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const timeA = a.horaReporte || '';
        const timeB = b.horaReporte || '';
        if (timeA !== timeB) return timeB.localeCompare(timeA);
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
  }, [filteredTickets]);

  // Sincronizar el contador de alertas de préstamos exactamente con las tarjetas activas
  useEffect(() => {
    if (typeof onPendingCountChange === 'function') {
      onPendingCountChange(activeLoans.length);
    }
  }, [activeLoans.length, onPendingCountChange]);

  const concludedLoans = useMemo(() => {
    return filteredTickets
      .filter(t => t.estado === 'ATENDIDO')
      .sort((a, b) => {
        const dateA = a.fecha || '';
        const dateB = b.fecha || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        const timeA = a.horaReporte || '';
        const timeB = b.horaReporte || '';
        if (timeA !== timeB) return timeB.localeCompare(timeA);
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
  }, [filteredTickets]);

  return (
    <div className="space-y-4 pb-32 md:pb-12 w-full max-w-[1880px] mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <ToastBanner
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* =========================================================================
          CABECERA, CONMUTADOR (ACTIVOS / DEVUELTOS) Y BOTÓN REGISTRAR PRÉSTAMO
          ========================================================================= */}
      <div id="tickets-top-anchor" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 scroll-mt-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-500 flex items-center justify-center shrink-0">
            <HandHelping className="w-5 h-5 stroke-[2.4]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight truncate">
              Préstamos de Material
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium hidden sm:block">
              Control de entrega y devolución de recursos académicos
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0">
            <button
              onClick={() => {
                setActiveViewTab('ACTIVOS');
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                if (document.documentElement) document.documentElement.scrollTop = 0;
                if (document.body) document.body.scrollTop = 0;
              }}
              className={`h-8 px-3 rounded-lg font-bold text-xs transition flex items-center gap-1.5 active:scale-95 whitespace-nowrap ${activeViewTab === 'ACTIVOS'
                  ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <span>Activos</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none bg-[#FDBA30] text-slate-950">
                {activeLoans.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveViewTab('CONCLUIDOS');
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                if (document.documentElement) document.documentElement.scrollTop = 0;
                if (document.body) document.body.scrollTop = 0;
              }}
              className={`h-8 px-3 rounded-lg font-bold text-xs transition flex items-center gap-1.5 active:scale-95 whitespace-nowrap ${activeViewTab === 'CONCLUIDOS'
                  ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <span>Devoluciones</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none bg-emerald-500 text-white">
                {concludedLoans.length}
              </span>
            </button>
          </div>

          {/* Botón para Limpiar Devoluciones (solo visible en la pestaña Devoluciones si hay registros) */}
          {activeViewTab === 'CONCLUIDOS' && concludedLoans.length > 0 && (
            <button
              type="button"
              onClick={handleClearConcluded}
              className="h-9 px-3 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 shadow-xs transition inline-flex items-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
              title="Limpiar todas las devoluciones archivadas"
            >
              <Trash2 className="w-4 h-4 stroke-[2]" />
              <span className="hidden sm:inline">Limpiar Devoluciones</span>
            </button>
          )}

          {/* Botón Principal: Registrar Préstamo (Alineado a la derecha en móvil para pulgar derecho) */}
          <button
            type="button"
            onClick={() => setIsNewLoanModalOpen(true)}
            className="h-9 px-3.5 rounded-xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0 ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Registrar Préstamo</span>
          </button>
        </div>
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
          <div key="activos" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 animate-fade-in">
            {activeLoans.map(ticket => {
              const ben = parseBeneficiary(ticket.descripcionSolucion);
              const isSigningInline = inlineSignTicketId === ticket.id;
              const isReceivingInline = inlineReceiveTicketId === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-[#0c0c0f] border-2 border-amber-400/70 dark:border-amber-500/40 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-amber-500 transition-all overflow-hidden relative"
                >
                  <div className="space-y-2.5">
                    {/* Alerta Destacada en Tarjeta: Cada préstamo activo constituye 1 Alerta que coincide con el contador superior */}
                    {!ticket.firmaRecepcion ? (
                      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-300 text-[11px] font-black">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5] text-amber-500 shrink-0 animate-pulse" />
                          <span className="truncate">Falta Firma de Solicitante</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black shrink-0 tracking-wider">
                          ALERTA
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-300 text-[11px] font-black">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 stroke-[2.4] text-amber-500 shrink-0" />
                          <span className="truncate">Pendiente de Devolución</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black shrink-0 tracking-wider">
                          ALERTA
                        </span>
                      </div>
                    )}

                    {/* Header: Aula, Ubicación y Hora */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-black text-xs sm:text-sm bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 px-2.5 py-0.5 rounded-xl shrink-0 shadow-xs tracking-tight">
                          {ticket.ambiente || 'DOCENCIA'}
                        </span>
                        {(() => {
                          const pabPisoStr = getTicketPabPisoText(ticket);
                          if (!pabPisoStr) return null;
                          return (
                            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                              {pabPisoStr}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-zinc-800 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500 stroke-[2.3]" />
                        <span>{ticket.horaReporte || '--:--'}</span>
                      </span>
                    </div>

                    {/* Fila 2: Beneficiario (Docente o Alumno) y Estado de Firma */}
                    <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 flex items-center justify-center shrink-0 shadow-2xs">
                          {ben.type === 'ALUMNO' ? (
                            <GraduationCap className="w-4 h-4 stroke-[2.2]" />
                          ) : (
                            <User className="w-4 h-4 stroke-[2.2]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            {ben.type === 'ALUMNO' ? 'Alumno' : 'Docente Solicitante'}
                          </div>
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {ben.name || (ben.type === 'ALUMNO' ? 'Alumno' : 'Docente')}
                          </div>
                        </div>
                      </div>

                      {ticket.firmaRecepcion ? (
                        <button
                          type="button"
                          onClick={() => setDetailTicket(ticket)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 transition active:scale-95 shrink-0"
                          title="Ver firma registrada"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Firmado</span>
                          <Eye className="w-3 h-3 ml-0.5 opacity-75" />
                        </button>
                      ) : isSigningInline ? null : (
                        <button
                          type="button"
                          onClick={() => setInlineSignTicketId(ticket.id)}
                          className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800/80 transition inline-flex items-center gap-1 active:scale-95 shrink-0"
                          title="Firmar préstamo"
                        >
                          <PenTool className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
                          <span>Firmar</span>
                        </button>
                      )}
                    </div>

                    {/* Fila 3: Material Prestado Destacado */}
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Material:
                      </span>
                      <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-zinc-100 uppercase tracking-tight bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-0.5 rounded-lg truncate">
                        {ticket.tipoSolicitud}
                      </span>
                    </div>

                    {/* Panel de Firma Inicial si faltaba firmar */}
                    {isSigningInline && (
                      <div className="my-2 p-2 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2 overflow-hidden">
                        <SignatureCanvas
                          ref={cardSignCanvasRef}
                          title="Firma del Solicitante"
                          height={85}
                          compact={true}
                          autoOpen={true}
                          onConfirm={(signDataUrl) => handleSaveCardSignature(ticket.id, signDataUrl)}
                          onClose={() => setInlineSignTicketId(null)}
                        />
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveCardSignature(ticket.id)}
                            className="h-8 bg-[#FDBA30] hover:bg-amber-400 active:bg-amber-500 text-slate-950 font-black text-xs rounded-lg transition flex items-center justify-center whitespace-nowrap active:scale-95 shadow-2xs"
                          >
                            Guardar Firma
                          </button>
                          <button
                            type="button"
                            onClick={() => setInlineSignTicketId(null)}
                            className="h-8 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-lg transition flex items-center justify-center active:scale-95"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PASO 2: Panel de Devolución (Diseño adaptable 100% contenido en tarjeta) */}
                    {isReceivingInline && (
                      <div className="my-2 p-2 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-2 overflow-hidden">
                        <SignatureCanvas
                          ref={returnSignCanvasRef}
                          title="Firma de Devolución"
                          subtitle="Firma directamente con el dedo o mouse"
                          height={85}
                          compact={true}
                          autoOpen={true}
                          onConfirm={(signDataUrl) => handleConfirmReturnWithSignature(ticket, signDataUrl)}
                          onClose={() => setInlineReceiveTicketId(null)}
                        />
                        <div className="space-y-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleConfirmReturnWithSignature(ticket)}
                            className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-lg transition flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Confirmar Devolución</span>
                          </button>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMarkReturnedDirect(ticket)}
                              className="h-7.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-[11px] rounded-lg transition flex items-center justify-center active:scale-95"
                              title="Recibir sin requerir firma"
                            >
                              Sin firma
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineReceiveTicketId(null)}
                              className="h-7.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-[11px] rounded-lg transition flex items-center justify-center active:scale-95"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta en Activos */}
                  <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                      Por: <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{ticket.responsable || 'OPERACIONES'}</strong>
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setInlineReceiveTicketId(ticket.id)}
                        className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap"
                        title="Registrar devolución con firma"
                      >
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5] shrink-0" />
                        <span>Devolución</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(ticket.id)}
                        className="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center justify-center border border-slate-200 dark:border-zinc-800 active:scale-95 shrink-0"
                        title="Eliminar préstamo"
                      >
                        <Trash2 className="w-4 h-4 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        concludedLoans.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200 dark:border-zinc-800 px-4">
            <p className="text-xs text-slate-500 dark:text-zinc-400">No hay devoluciones registradas</p>
          </div>
        ) : (
          <div key="devueltos" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 animate-fade-in">
            {concludedLoans.map(ticket => {
              const ben = parseBeneficiary(ticket.descripcionSolucion);

              return (
                <div
                  key={ticket.id}
                  className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between opacity-95 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors overflow-hidden"
                >
                  <div className="space-y-2.5">
                    {/* Header: Aula, Beneficiario y Estado Devuelto */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs sm:text-sm bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2.5 py-0.5 rounded-xl border border-slate-200 dark:border-zinc-700 shrink-0">
                          {ticket.ambiente || 'DOCENCIA'}
                        </span>
                        {(() => {
                          const pabPisoStr = getTicketPabPisoText(ticket);
                          if (!pabPisoStr) return null;
                          return (
                            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                              {pabPisoStr}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                        DEVUELTO
                      </span>
                    </div>

                    {/* Fila 2: Beneficiario */}
                    <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0 shadow-2xs">
                          {ben.type === 'ALUMNO' ? (
                            <GraduationCap className="w-4 h-4 stroke-[2.2]" />
                          ) : (
                            <User className="w-4 h-4 stroke-[2.2]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            {ben.type === 'ALUMNO' ? 'Alumno' : 'Docente'}
                          </div>
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {ben.name || (ben.type === 'ALUMNO' ? 'Alumno' : 'Docente')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {ticket.firmaRecepcion && ticket.firmaEntrega ? (
                          <span className="text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                            ★ Doble firma
                          </span>
                        ) : (
                          <>
                            {ticket.firmaRecepcion && (
                              <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                ✓ Préstamo
                              </span>
                            )}
                            {ticket.firmaEntrega && (
                              <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                                ✓ Devolución
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Fila 3: Material */}
                    <div className="flex items-center justify-between gap-2 px-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        Material:
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-zinc-200 uppercase tracking-tight truncate">
                        {ticket.tipoSolicitud}
                      </span>
                    </div>
                  </div>

                  {/* Acciones de la Tarjeta en Devoluciones (PDF habilitado exclusivamente aquí) */}
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                      {ticket.fecha} · {ticket.horaReporte}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyTicketExcelRow(ticket)}
                        className="h-8 px-2.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-[#FDBA30] dark:bg-zinc-800 dark:hover:bg-[#FDBA30] text-slate-700 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-slate-950 border border-slate-200 dark:border-zinc-700 transition flex items-center gap-1 active:scale-95 shadow-2xs"
                        title="Copiar fila de Excel (ATENCIONES 2026-2)"
                      >
                        <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Copiar</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleQuickDownloadPdf(e, ticket)}
                        className="h-8 px-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-900 dark:text-zinc-100 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 border border-slate-200 dark:border-zinc-700 active:scale-95"
                        title="Descargar Acta de Devolución en PDF"
                      >
                        <Download className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTicket(ticket)}
                        className="h-8 px-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-lg text-xs font-black transition inline-flex items-center gap-1 border border-amber-300 dark:border-amber-800/80 active:scale-95"
                        title="Ver firmas y detalles del préstamo"
                      >
                        <Eye className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Firmas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ticket.id)}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center justify-center border border-slate-200 dark:border-zinc-800 active:scale-95"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* =========================================================================
          MODAL DE SELECCIÓN DE AULAS ESTILO CALENDARIO (Distribución de Sede)
          ========================================================================= */}
      {roomCalendarFade.shouldRender && createPortal(
        <div
          className={`fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm ${roomCalendarFade.backdropClass}`}
          onClick={() => roomCalendarFade.requestClose()}
        >
          <div
            className={`w-full max-w-2xl bg-white dark:bg-[#0c0c10] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${roomCalendarFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Calendario */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FDBA30] text-slate-950 flex items-center justify-center shadow-xs">
                  <Calendar className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white leading-tight">
                    Seleccionar Aula
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    Distribución de aulas de campus UPN Comas
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => roomCalendarFade.requestClose()}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition active:scale-95"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Controles de Navegación por Pabellón y Piso (Estilo Meses / Días de Calendario) */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 space-y-3 bg-white dark:bg-[#0c0c10]">
              {/* Selector de Pabellón */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCalendarPabellon('A')}
                  className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${calendarPabellon === 'A'
                      ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-xs ring-1 ring-amber-400/50'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Pabellón A</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarPabellon('B')}
                  className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${calendarPabellon === 'B'
                      ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-xs ring-1 ring-amber-400/50'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Pabellón B</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarPabellon('TODOS')}
                  className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${calendarPabellon === 'TODOS'
                      ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-xs ring-1 ring-amber-400/50'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Todos</span>
                </button>
              </div>

              {/* Selector de Pisos (Estilo Pestañas de Calendario) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
                {['TODOS', 'SÓTANO', '1ER PISO', '2DO PISO', '3ER PISO', '4TO PISO', '5TO PISO'].map((pisoKey) => {
                  const isActive = calendarPiso === pisoKey;
                  const label = pisoKey === 'TODOS'
                    ? 'Todos los Pisos'
                    : pisoKey === 'SÓTANO'
                      ? 'Sótano'
                      : pisoKey === '1ER PISO'
                        ? 'Piso 1'
                        : pisoKey === '2DO PISO'
                          ? 'Piso 2'
                          : pisoKey === '3ER PISO'
                            ? 'Piso 3'
                            : pisoKey === '4TO PISO'
                              ? 'Piso 4'
                              : 'Piso 5';
                  return (
                    <button
                      key={pisoKey}
                      type="button"
                      onClick={() => setCalendarPiso(pisoKey)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition active:scale-95 shrink-0 ${isActive
                          ? 'bg-slate-950 dark:bg-zinc-800 text-[#FDBA30] font-black shadow-xs'
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Filtro por Tipo Oficial de Ambiente (Hoja AMBIENTES de CONTROL DOCENTE.xlsx) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                {[
                  { id: 'TODOS', label: 'Todos los Ambientes' },
                  { id: 'AULA', label: '🏫 Aulas' },
                  { id: 'TALLER_ESP', label: '🛠️ Talleres Espec.' },
                  { id: 'TALLER_ARQ', label: '📐 Talleres Arq.' },
                  { id: 'LAB_ESP', label: '🔬 Labs. Espec.' },
                  { id: 'LAB_COMPUTO', label: '💻 Labs. Cómputo' }
                ].map((cat) => {
                  const isActive = calendarCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCalendarCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition active:scale-95 shrink-0 ${isActive
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs ring-1 ring-amber-500/50'
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                        }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Buscador Rápido de Aula */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={calendarSearch}
                  onChange={(e) => setCalendarSearch(e.target.value)}
                  placeholder="Filtrar por código o nombre (ej. 301, Cómputo, Foto, AS01)..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-bold"
                />
                {calendarSearch && (
                  <button
                    type="button"
                    onClick={() => setCalendarSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Rejilla de Aulas Estilo Calendario (4 cols en móvil, 6 en desktop) */}
            <div className="p-4 flex-1 overflow-y-auto max-h-[50vh] custom-scrollbar bg-slate-50/50 dark:bg-[#09090b]">
              {filteredCalendarRooms.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Grid3X3 className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300 dark:text-zinc-600" />
                  <p className="text-xs font-bold">No se encontraron aulas con ese filtro</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-2.5">
                  {filteredCalendarRooms.map((room) => {
                    const isSelected = roomInput === room.abrv;
                    const isTallerEsp = room.categoria === 'TALLER_ESP' || room.tipoAmbiente === 'TALLER ESPECIALIZADO';
                    const isTallerArq = room.categoria === 'TALLER_ARQ' || room.tipoAmbiente === 'TALLER DE ARQUITECTURA Y DIBUJO';
                    const isLabEsp = room.categoria === 'LAB_ESP' || room.tipoAmbiente === 'LABORATORIO ESPECIALIZADO';
                    const isLabComputo = room.categoria === 'LAB_COMPUTO' || room.tipoAmbiente === 'LABORATORIO DE CÓMPUTO';
                    const isOficina = room.categoria === 'OFICINA' || room.tipoAmbiente === 'OFICINA';

                    return (
                      <button
                        key={room.abrv}
                        type="button"
                        title={`${room.nombre} · ${room.piso} (${room.pabellon}) · Aforo: ${room.aforo} personas`}
                        onClick={() => {
                          setRoomInput(room.abrv);
                          setIsRoomCalendarOpen(false);
                          setToastMessage(`✅ ${room.nombre || room.abrv} seleccionada (Aforo: ${room.aforo} pers.)`);
                          setTimeout(() => setToastMessage(''), 1800);
                        }}
                        className={`p-2 sm:p-2.5 rounded-2xl border transition-all duration-150 flex flex-col items-center justify-between text-center active:scale-95 group relative min-h-[92px] ${isSelected
                            ? 'bg-[#FDBA30] text-slate-950 border-[#FDBA30] shadow-md ring-2 ring-amber-400 font-black'
                            : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border-slate-200/90 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                          }`}
                      >
                        <span className={`font-mono text-sm sm:text-base font-black tracking-tight leading-none ${isSelected ? 'text-slate-950' : 'text-slate-900 dark:text-white'
                          }`}>
                          {room.abrv}
                        </span>

                        {/* Subtítulo dinámico con data del Excel: TALLER ESPECIALIZADO, TALLER ARQ, LAB ESP, LAB CÓMPUTO, AULA */}
                        <div className="mt-1">
                          {isTallerEsp ? (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md inline-block leading-tight border ${isSelected
                                ? 'bg-slate-950 text-purple-300 border-slate-950'
                                : 'bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60'
                              }`}>
                              Taller Espec.
                            </span>
                          ) : isTallerArq ? (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md inline-block leading-tight border ${isSelected
                                ? 'bg-slate-950 text-teal-300 border-slate-950'
                                : 'bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/60'
                              }`}>
                              Taller Arq.
                            </span>
                          ) : isLabEsp ? (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md inline-block leading-tight border ${isSelected
                                ? 'bg-slate-950 text-sky-300 border-slate-950'
                                : 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60'
                              }`}>
                              Lab. Espec.
                            </span>
                          ) : isLabComputo ? (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md inline-block leading-tight border ${isSelected
                                ? 'bg-slate-950 text-blue-300 border-slate-950'
                                : 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60'
                              }`}>
                              Lab. Cómputo
                            </span>
                          ) : isOficina ? (
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md inline-block leading-tight border ${isSelected
                                ? 'bg-slate-950 text-amber-300 border-slate-950'
                                : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
                              }`}>
                              Oficina
                            </span>
                          ) : (
                            <span className={`text-[9.5px] font-bold leading-tight ${isSelected ? 'text-slate-900 font-black' : 'text-slate-500 dark:text-zinc-400'
                              }`}>
                              Aula
                            </span>
                          )}
                        </div>

                        {/* Aforo oficial de la Hoja AMBIENTES */}
                        <div className={`mt-1 flex items-center justify-center gap-1 text-[10px] font-bold tracking-tight ${isSelected ? 'text-slate-950' : 'text-slate-500 dark:text-zinc-400'
                          }`}>
                          <Users className="w-3 h-3 stroke-[2.2] shrink-0" />
                          <span>{room.aforo} pers.</span>
                        </div>

                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pie con Opciones Rápidas */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-[#0c0c10] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setRoomInput('DOCENCIA');
                    roomCalendarFade.requestClose();
                  }}
                  className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition"
                >
                  🏢 Docencia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoomInput('');
                    roomCalendarFade.requestClose();
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition"
                >
                  ❌ Sin Aula
                </button>
              </div>

              <button
                type="button"
                onClick={() => roomCalendarFade.requestClose()}
                className="h-10 px-5 text-xs font-black bg-slate-950 dark:bg-zinc-800 hover:bg-slate-800 text-white rounded-xl transition active:scale-95 shadow-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* =========================================================================
          MODAL DE DETALLES DEL PRÉSTAMO Y PREVISUALIZACIÓN DE FIRMAS CON FADE
          ========================================================================= */}
      {detailTicketFade.shouldRender && typeof document !== 'undefined' && createPortal(
        (() => {
          const currentDetailTicket = detailTicketFade.cachedData || detailTicket;
          if (!currentDetailTicket) return null;
          const ben = parseBeneficiary(currentDetailTicket.descripcionSolucion);
          const cleanDetailText = (currentDetailTicket.descripcionSolucion || '')
            .replace(/\[(?:🎓|👨‍🏫)?\s*(?:ALUMNO|DOCENTE)(?::\s*[^\]]+)?\]\s*/i, '')
            .trim();
          const returnTimeMatch = (currentDetailTicket.descripcionSolucion || '').match(/\[DEVUELTO\s+([^\]]+)\]/i);
          const returnTimeStr = returnTimeMatch ? returnTimeMatch[1] : null;
          const fRecepcion = currentDetailTicket.firmaRecepcion || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_recepcion_${currentDetailTicket.id}`) : null);
          const fEntrega = currentDetailTicket.firmaEntrega || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_entrega_${currentDetailTicket.id}`) : null);

          return (
            <div
              className={`fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md ${detailTicketFade.backdropClass}`}
              onClick={() => detailTicketFade.requestClose()}
            >
              <div
                className={`w-full max-w-lg bg-white dark:bg-[#0c0c10] border border-slate-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${detailTicketFade.modalClass}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Encabezado */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-zinc-900/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#FDBA30] text-slate-950 flex items-center justify-center shadow-xs shrink-0">
                      <Eye className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 px-2.5 py-0.5 rounded-lg">
                          {currentDetailTicket.ambiente || 'DOCENCIA'}
                        </span>
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/70 inline-flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          {currentDetailTicket.estado === 'ATENDIDO' ? 'DEVUELTO / CONCLUIDO' : currentDetailTicket.estado}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white leading-tight mt-1 truncate">
                        Detalles del Préstamo y Firmas
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => detailTicketFade.requestClose()}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition shrink-0"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {/* Cuerpo con Detalles y Previsualización de Firmas */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                  {/* Bloque Material Principal */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/60">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      Material / Requerimiento Prestado
                    </div>
                    <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white mt-0.5">
                      {detailTicket.tipoSolicitud || 'PRÉSTAMO DE MATERIAL'}
                    </div>
                    {cleanDetailText && (
                      <div className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                        {cleanDetailText}
                      </div>
                    )}
                  </div>

                  {/* Grilla de Información del Solicitante, Asistente y Horarios */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                        Solicitante ({ben.label})
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5 break-words">
                        {ben.type === 'ALUMNO' ? '🎓 ' : '👨‍🏫 '}
                        {ben.name || detailTicket.recibidoPor || detailTicket.entregadoPor || 'Registrado en sede'}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                        Asistente que Registró
                      </div>
                      <div className="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5 break-words flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 flex items-center justify-center text-[10px] font-black shrink-0">
                          {(detailTicket.responsable || 'T').charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate">{detailTicket.responsable || 'TAYRON SALINAS'}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                        Ambiente / Ubicación
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                        {String(detailTicket.ambiente || 'DOCENCIA').replace(/#¡?REF!?/gi, '').trim() || 'DOCENCIA'}
                        {detailTicket.piso && !String(detailTicket.piso).includes('REF') ? ` · ${detailTicket.piso}` : ''}
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                        Fecha y Hora de Entrega
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                        {detailTicket.fecha || '--'} · {detailTicket.horaReporte || '--:--'}
                      </div>
                    </div>

                    <div className="col-span-2 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                          Hora de Devolución
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {returnTimeStr ? `${returnTimeStr} hrs` : (detailTicket.estado === 'ATENDIDO' ? 'Concluido' : 'Pendiente')}
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${detailTicket.estado === 'ATENDIDO'
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                        }`}>
                        {detailTicket.estado === 'ATENDIDO' ? '✓ DEVUELTO' : '⏳ PENDIENTE'}
                      </span>
                    </div>
                  </div>

                  {/* Previsualización de las 2 Firmas (Préstamo y Devolución) */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Previsualización de Conformidad y Firmas
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Firma 1: Préstamo / Recepción inicial */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between shadow-2xs">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                            1. Firma de Préstamo (Recibí)
                          </span>
                          {fRecepcion ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                              ✓ Firmado
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-500">
                              Sin firma
                            </span>
                          )}
                        </div>
                        <div className="h-32 rounded-xl bg-white border border-slate-300 dark:border-zinc-700 flex items-center justify-center p-3 shadow-inner overflow-hidden">
                          {fRecepcion ? (
                            <img
                              src={fRecepcion}
                              alt="Firma de recepción del préstamo"
                              className="max-h-full max-w-full object-contain filter contrast-125"
                            />
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              No se adjuntó firma inicial
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Firma 2: Devolución del material */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between shadow-2xs">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-[11px] font-black text-blue-700 dark:text-blue-400">
                            2. Firma de Devolución (Entregué)
                          </span>
                          {fEntrega ? (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
                              ✓ Firmado
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-500">
                              Sin firma
                            </span>
                          )}
                        </div>
                        <div className="h-32 rounded-xl bg-white border border-slate-300 dark:border-zinc-700 flex items-center justify-center p-3 shadow-inner overflow-hidden">
                          {fEntrega ? (
                            <img
                              src={fEntrega}
                              alt="Firma de devolución del material"
                              className="max-h-full max-w-full object-contain filter contrast-125"
                            />
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Devolución registrada sin firma
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pie de Acciones */}
                <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-[#0c0c10] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {detailTicket.estado === 'ATENDIDO' && (
                      <button
                        type="button"
                        onClick={(e) => handleQuickDownloadPdf(e, detailTicket)}
                        className="h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 border border-slate-200 dark:border-zinc-800 transition active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 stroke-[2.3]" />
                        <span>Descargar PDF</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const target = currentDetailTicket;
                        detailTicketFade.requestClose(() => {
                          setDetailTicket(null);
                          handleReopen(target);
                        });
                      }}
                      className="h-10 px-3 rounded-xl bg-slate-100 dark:bg-zinc-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-600 dark:text-zinc-400 hover:text-amber-800 dark:hover:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 border border-slate-200 dark:border-zinc-800 transition active:scale-95"
                      title="Devolver este registro a préstamos activos"
                    >
                      <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
                      <span>Reabrir</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => detailTicketFade.requestClose()}
                    className="h-10 px-5 rounded-xl bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 text-xs font-black transition active:scale-95 shadow-xs"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* =========================================================================
          MODAL FLOTANTE: REGISTRAR ATENCIÓN / PRÉSTAMO CON FADE IN Y FADE OUT
          ========================================================================= */}
      {newLoanFade.shouldRender && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm ${newLoanFade.backdropClass}`}
          onClick={() => newLoanFade.requestClose()}
        >
          <div
            className={`w-full max-w-2xl bg-white dark:bg-[#0c0c10] border border-slate-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${newLoanFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#FDBA30] text-slate-950 flex items-center justify-center shadow-xs shrink-0">
                  <HandHelping className="w-5 h-5 stroke-[2.4]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-slate-950 dark:text-white leading-tight truncate">
                    Registrar Atención / Préstamo de Material
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold truncate">
                    Sincronizado con la hoja ATENCIONES 2026-2 del Excel Maestro
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => newLoanFade.requestClose()}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-90 shrink-0"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Contenido del Formulario Scrolleable Simplificado y Elegante */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 max-h-[80vh] scrollbar-none">
              <form id="new-loan-modal-form" onSubmit={handleRegisterLoan} className="space-y-3.5">

                {/* 1. Fila de Horario: Fecha, Hora y Rango Automático */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 items-end">
                  <div className="sm:col-span-5">
                    <label className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      <span>Fecha</span>
                      <span className="text-amber-500 font-black">{getDayOfWeek(loanDate)}</span>
                    </label>
                    <CustomDatePicker
                      value={loanDate}
                      onChange={(val) => setLoanDate(val)}
                      required
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Hora de Reporte
                    </label>
                    <CustomTimePicker
                      value={loanTime}
                      onChange={handleTimeChange}
                      required
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Rango
                    </label>
                    <div className="h-10 px-2.5 bg-slate-100 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-amber-600 dark:text-amber-400 tracking-tight text-center">
                      {loanRango || computeRango(loanTime)}
                    </div>
                  </div>
                </div>

                {/* 2. Fila: Ambiente / Aula y Solicitante */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  {/* Aula Unificada */}
                  <div className="sm:col-span-5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                        Ambiente / Aula
                      </label>
                      {roomInput && (
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          {deduceFloor(roomInput)}
                        </span>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                        placeholder="Ej. B206, A509..."
                        className="w-full h-10 pl-3 pr-20 text-xs font-mono font-bold uppercase bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FDBA30]"
                      />
                      <div className="absolute right-1 flex items-center gap-1">
                        {roomInput && (
                          <button
                            type="button"
                            onClick={() => setRoomInput('')}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded"
                            title="Limpiar aula"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsRoomCalendarOpen(true)}
                          className="h-8 px-2 text-[11px] font-bold bg-[#FDBA30] hover:bg-amber-400 text-slate-950 rounded-lg flex items-center gap-1 transition active:scale-95"
                          title="Elegir desde mapa de aulas"
                        >
                          <Calendar className="w-3 h-3 stroke-[2.4]" />
                          <span>Mapa</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Solicitante con Selector de Rol */}
                  <div className="sm:col-span-7">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                        Solicitante
                      </label>
                      <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setBeneficiaryType('DOCENTE')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                            beneficiaryType === 'DOCENTE'
                              ? 'bg-[#FDBA30] text-slate-950 font-black'
                              : 'text-slate-500 dark:text-zinc-400'
                          }`}
                        >
                          Docente
                        </button>
                        <button
                          type="button"
                          onClick={() => setBeneficiaryType('ALUMNO')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                            beneficiaryType === 'ALUMNO'
                              ? 'bg-[#FDBA30] text-slate-950 font-black'
                              : 'text-slate-500 dark:text-zinc-400'
                          }`}
                        >
                          Alumno
                        </button>
                      </div>
                    </div>
                    <input
                      id="prestamo-person-name"
                      type="text"
                      required
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      placeholder={beneficiaryType === 'DOCENTE' ? 'Apellidos y Nombres del Docente...' : 'Nombre o código del estudiante...'}
                      className="w-full h-10 px-3.5 text-xs bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 font-bold focus:outline-none focus:border-[#FDBA30] transition"
                    />
                  </div>
                </div>

                {/* 3. Materiales: Pastillas Compactas y Elegantes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Materiales Solicitados
                    </label>
                    <span className="text-[10px] font-bold text-amber-500">
                      {selectedMaterials.length > 0 ? `${selectedMaterials.length} seleccionado(s)` : 'Selecciona material'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {CORE_MATERIALS.map(item => {
                      const isSelected = selectedMaterials.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleMaterial(item.id)}
                          className={`h-8 px-2.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 active:scale-95 border ${
                            isSelected
                              ? 'bg-[#FDBA30] text-slate-950 border-amber-500 font-black shadow-xs ring-1 ring-amber-400'
                              : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 border-slate-200 dark:border-zinc-800'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-slate-950 shrink-0 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>

                  {selectedMaterials.includes('MANUAL') && (
                    <div className="mt-2">
                      <input
                        type="text"
                        required
                        autoFocus
                        value={manualItemText}
                        onChange={(e) => setManualItemText(e.target.value)}
                        placeholder="Escribe el material solicitado manualmente (ej. PARLANTE, EXTENSIÓN, DISPLAYPORT)..."
                        className="w-full h-9 px-3 text-xs font-bold bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Estado y Responsable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Estado
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setLoanStatus('EN PROCESO')}
                        className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 ${
                          loanStatus === 'EN PROCESO'
                            ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span>EN PROCESO</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLoanStatus('ATENDIDO')}
                        className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 active:scale-95 ${
                          loanStatus === 'ATENDIDO'
                            ? 'bg-emerald-600 text-white font-black shadow-xs'
                            : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span>ATENDIDO</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Responsable / Asistente
                    </label>
                    {isAdmin() ? (
                      <CustomSelect
                        value={loanResponsable}
                        onChange={setLoanResponsable}
                        options={asistentes}
                        placeholder="Responsable"
                        className="h-10 text-xs font-bold"
                      />
                    ) : (
                      <div className="h-10 px-3.5 flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 select-none">
                        <span className="truncate">{getLoggedAssistantName()}</span>
                        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 uppercase tracking-wider bg-amber-200/60 dark:bg-amber-950 px-2 py-0.5 rounded-md">
                          Autenticado
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Detalle / Solución */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Descripción / Detalle Opcional
                  </label>
                  <input
                    type="text"
                    value={loanDescription}
                    onChange={(e) => setLoanDescription(e.target.value)}
                    placeholder="Ej. Proyector no muestra imagen, uso en laboratorio, configuración de periféricos..."
                    className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 font-medium focus:outline-none focus:border-[#FDBA30]"
                  />
                </div>

                {/* 6. Firma del Solicitante */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Firma del Solicitante (Recibí Conforme)
                  </label>
                  <div className="bg-slate-50 dark:bg-zinc-900/60 p-2 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    <SignatureCanvas
                      ref={solicitanteFormSignRef}
                      title="Firma del Solicitante"
                      subtitle="Toca para firmar en pantalla amplia o directamente aquí"
                      height={75}
                      compact={true}
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer con Botón Registrar */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => newLoanFade.requestClose()}
                className="h-10 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition active:scale-95"
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="new-loan-modal-form"
                disabled={submittingLoan}
                className="h-10 px-5 bg-[#FDBA30] hover:bg-[#ffc642] active:bg-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-xs transition inline-flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                <span>{submittingLoan ? 'Registrando...' : 'Registrar Atención / Préstamo'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
