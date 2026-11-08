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
  GraduationCap,
  PenTool,
  Download,
  Calendar,
  Building2,
  Grid3X3,
  Layers,
  Eye
} from 'lucide-react';
import ToastBanner from './ToastBanner';
import SignatureCanvas from './SignatureCanvas';
import CustomSelect from './CustomSelect';
import { useAssistants } from '../utils/assistants';
import { generateCargoPdf } from '../utils/cargoPdfGenerator';

const CAMPUS_ROOMS = [
  // --- PABELLÓN A ---
  // Sótano
  { abrv: 'AS01', nombre: 'Laboratorio ZAM AS-01', pabellon: 'A', piso: 'SÓTANO', pisoOrder: 0, categoria: 'LABORATORIO', tag: 'Lab. ZAM', aforo: 30 },
  { abrv: 'AS02', nombre: 'Taller de Audio AS-02', pabellon: 'A', piso: 'SÓTANO', pisoOrder: 0, categoria: 'TALLER', tag: 'Taller Audio', aforo: 10 },
  { abrv: 'AS03', nombre: 'Taller de Audio AS-03', pabellon: 'A', piso: 'SÓTANO', pisoOrder: 0, categoria: 'TALLER', tag: 'Taller Audio', aforo: 10 },
  { abrv: 'AS04', nombre: 'Laboratorio de Fotografía AS-04', pabellon: 'A', piso: 'SÓTANO', pisoOrder: 0, categoria: 'LABORATORIO', tag: 'Lab. Foto', aforo: 20 },
  { abrv: 'AS05', nombre: 'Laboratorio de Fotografía AS-05', pabellon: 'A', piso: 'SÓTANO', pisoOrder: 0, categoria: 'LABORATORIO', tag: 'Lab. Foto', aforo: 20 },
  // 1er Piso
  { abrv: 'A101', nombre: 'Taller de Edición A-101', pabellon: 'A', piso: '1ER PISO', pisoOrder: 1, categoria: 'TALLER', tag: 'Taller Edición', aforo: 21 },
  // 2do Piso
  { abrv: 'A201', nombre: 'Aula A-201', pabellon: 'A', piso: '2DO PISO', pisoOrder: 2, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A202', nombre: 'Aula A-202', pabellon: 'A', piso: '2DO PISO', pisoOrder: 2, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  // 3er Piso
  { abrv: 'A301', nombre: 'Aula A-301', pabellon: 'A', piso: '3ER PISO', pisoOrder: 3, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A302', nombre: 'Aula A-302', pabellon: 'A', piso: '3ER PISO', pisoOrder: 3, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A303', nombre: 'Aula A-303', pabellon: 'A', piso: '3ER PISO', pisoOrder: 3, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A304', nombre: 'Aula A-304', pabellon: 'A', piso: '3ER PISO', pisoOrder: 3, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A305', nombre: 'Aula A-305', pabellon: 'A', piso: '3ER PISO', pisoOrder: 3, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A306', nombre: 'Sala de Conferencias A-306', pabellon: 'A', piso: '3ER PISO', pisoOrder: 3, categoria: 'ESPECIAL', tag: 'Conferencias', aforo: 60 },
  // 4to Piso
  { abrv: 'A401', nombre: 'Aula A-401', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A402', nombre: 'Aula A-402', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A403', nombre: 'Laboratorio de Diseño y Producción Digital A-403', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'LABORATORIO', tag: 'Lab. Diseño', aforo: 40 },
  { abrv: 'A404', nombre: 'Aula A-404', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A405', nombre: 'Aula A-405', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'AULA', tag: 'Aula', aforo: 20 },
  { abrv: 'A406', nombre: 'Aula de Litigación A-406', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'ESPECIAL', tag: 'Litigación', aforo: 37 },
  { abrv: 'A407', nombre: 'Sala de Conferencias A-407', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'ESPECIAL', tag: 'Conferencias', aforo: 60 },
  { abrv: 'OFICINA', nombre: 'Oficina de Operaciones', pabellon: 'A', piso: '4TO PISO', pisoOrder: 4, categoria: 'OFICINA', tag: 'Operaciones', aforo: 5 },
  // 5to Piso
  { abrv: 'A501', nombre: 'Aula A-501', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A502', nombre: 'Aula A-502', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'A503', nombre: 'Laboratorio de Diseño Gráfico A-503', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'LABORATORIO', tag: 'Lab. Diseño', aforo: 40 },
  { abrv: 'A504', nombre: 'Laboratorio de Diseño Gráfico A-504', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'LABORATORIO', tag: 'Lab. Diseño', aforo: 40 },
  { abrv: 'A505', nombre: 'Laboratorio de Cómputo A-505', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'LABORATORIO', tag: 'Lab. Cómputo', aforo: 40 },
  { abrv: 'A506', nombre: 'Laboratorio de Cómputo A-506', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'LABORATORIO', tag: 'Lab. Cómputo', aforo: 40 },
  { abrv: 'A507', nombre: 'Aula Multifuncional A-507', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'AULA', tag: 'Multifunción', aforo: 16 },
  { abrv: 'A508', nombre: 'Laboratorio de Cómputo A-508', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'LABORATORIO', tag: 'Lab. Cómputo', aforo: 40 },
  { abrv: 'A509', nombre: 'Laboratorio de Cómputo A-509', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'LABORATORIO', tag: 'Lab. Cómputo', aforo: 40 },
  { abrv: 'A510', nombre: 'Laboratorio de Cómputo A-510', pabellon: 'A', piso: '5TO PISO', pisoOrder: 5, categoria: 'LABORATORIO', tag: 'Lab. Cómputo', aforo: 40 },

  // --- PABELLÓN B ---
  // 1er Piso
  { abrv: 'B101', nombre: 'Laboratorio de Impresión 3D B-101', pabellon: 'B', piso: '1ER PISO', pisoOrder: 1, categoria: 'LABORATORIO', tag: 'Lab. 3D', aforo: 5 },
  { abrv: 'B102', nombre: 'Taller de Creatividad B-102', pabellon: 'B', piso: '1ER PISO', pisoOrder: 1, categoria: 'TALLER', tag: 'Creatividad', aforo: 40 },
  { abrv: 'B103', nombre: 'Taller de Diseño Industrial B-103', pabellon: 'B', piso: '1ER PISO', pisoOrder: 1, categoria: 'TALLER', tag: 'Taller', aforo: 30 },
  { abrv: 'B104', nombre: 'Taller de Arquitectura y Dibujo B-104', pabellon: 'B', piso: '1ER PISO', pisoOrder: 1, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B105', nombre: 'Taller de Materiales de Construcción B-105', pabellon: 'B', piso: '1ER PISO', pisoOrder: 1, categoria: 'TALLER', tag: 'Materiales', aforo: 28 },
  { abrv: 'B106', nombre: 'Taller de Soldadura B-106', pabellon: 'B', piso: '1ER PISO', pisoOrder: 1, categoria: 'TALLER', tag: 'Soldadura', aforo: 20 },
  // 2do Piso
  { abrv: 'B201', nombre: 'Aula B-201', pabellon: 'B', piso: '2DO PISO', pisoOrder: 2, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B202', nombre: 'Aula B-202', pabellon: 'B', piso: '2DO PISO', pisoOrder: 2, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B203', nombre: 'Taller de Arquitectura y Dibujo B-203', pabellon: 'B', piso: '2DO PISO', pisoOrder: 2, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B204', nombre: 'Taller de Arquitectura y Dibujo B-204', pabellon: 'B', piso: '2DO PISO', pisoOrder: 2, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B205', nombre: 'Taller de Arquitectura y Dibujo B-205', pabellon: 'B', piso: '2DO PISO', pisoOrder: 2, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B206', nombre: 'Aula B-206', pabellon: 'B', piso: '2DO PISO', pisoOrder: 2, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B207', nombre: 'Aula B-207', pabellon: 'B', piso: '2DO PISO', pisoOrder: 2, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  // 3er Piso
  { abrv: 'B301', nombre: 'Aula B-301', pabellon: 'B', piso: '3ER PISO', pisoOrder: 3, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B302', nombre: 'Aula B-302', pabellon: 'B', piso: '3ER PISO', pisoOrder: 3, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B303', nombre: 'Taller de Arquitectura y Dibujo B-303', pabellon: 'B', piso: '3ER PISO', pisoOrder: 3, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B304', nombre: 'Taller de Arquitectura y Dibujo B-304', pabellon: 'B', piso: '3ER PISO', pisoOrder: 3, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B305', nombre: 'Taller de Arquitectura y Dibujo B-305', pabellon: 'B', piso: '3ER PISO', pisoOrder: 3, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B306', nombre: 'Taller de Arquitectura y Dibujo B-306', pabellon: 'B', piso: '3ER PISO', pisoOrder: 3, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  // 4to Piso
  { abrv: 'B401', nombre: 'Aula B-401', pabellon: 'B', piso: '4TO PISO', pisoOrder: 4, categoria: 'AULA', tag: 'Aula', aforo: 20 },
  { abrv: 'B402', nombre: 'Aula B-402', pabellon: 'B', piso: '4TO PISO', pisoOrder: 4, categoria: 'AULA', tag: 'Aula', aforo: 20 },
  { abrv: 'B403', nombre: 'Taller de Arquitectura y Dibujo B-403', pabellon: 'B', piso: '4TO PISO', pisoOrder: 4, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B404', nombre: 'Taller de Arquitectura y Dibujo B-404', pabellon: 'B', piso: '4TO PISO', pisoOrder: 4, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B405', nombre: 'Taller de Arquitectura y Dibujo B-405', pabellon: 'B', piso: '4TO PISO', pisoOrder: 4, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B406', nombre: 'Taller de Arquitectura y Dibujo B-406', pabellon: 'B', piso: '4TO PISO', pisoOrder: 4, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  // 5to Piso
  { abrv: 'B501', nombre: 'Aula B-501', pabellon: 'B', piso: '5TO PISO', pisoOrder: 5, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B502', nombre: 'Aula B-502', pabellon: 'B', piso: '5TO PISO', pisoOrder: 5, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B503', nombre: 'Aula B-503', pabellon: 'B', piso: '5TO PISO', pisoOrder: 5, categoria: 'AULA', tag: 'Aula', aforo: 20 },
  { abrv: 'B504', nombre: 'Aula B-504', pabellon: 'B', piso: '5TO PISO', pisoOrder: 5, categoria: 'AULA', tag: 'Aula', aforo: 40 },
  { abrv: 'B505', nombre: 'Taller de Arquitectura y Dibujo B-505', pabellon: 'B', piso: '5TO PISO', pisoOrder: 5, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B506', nombre: 'Taller de Arquitectura y Dibujo B-506', pabellon: 'B', piso: '5TO PISO', pisoOrder: 5, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 },
  { abrv: 'B507', nombre: 'Taller de Arquitectura y Dibujo B-507', pabellon: 'B', piso: '5TO PISO', pisoOrder: 5, categoria: 'TALLER', tag: 'Taller Arq.', aforo: 40 }
];

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

  const asistentes = useAssistants();

  // Form State
  const [beneficiaryType, setBeneficiaryType] = useState('DOCENTE'); // 'DOCENTE' | 'ALUMNO'
  const [personName, setPersonName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [loanResponsable, setLoanResponsable] = useState('TAYRON SALINAS');
  const [selectedMaterialVal, setSelectedMaterialVal] = useState('PLUMONES');
  const [manualItemText, setManualItemText] = useState('');
  const [submittingLoan, setSubmittingLoan] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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
      .catch(() => {});
  }, []);

  const filteredCalendarRooms = useMemo(() => {
    return roomsList.filter(room => {
      if (calendarPabellon !== 'TODOS' && room.pabellon !== calendarPabellon) return false;
      if (calendarCategory !== 'TODOS' && room.categoria !== calendarCategory) return false;
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
               (room.tag && room.tag.toLowerCase().includes(q));
      }
      return true;
    });
  }, [roomsList, calendarPabellon, calendarPiso, calendarCategory, calendarSearch]);

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
      } catch (e) {}
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
    } catch (err) {}
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

  // Prefill from external views directly into inline form inputs (NO WINDOW OPENS!)
  useEffect(() => {
    if (initialNewTicket) {
      setActiveViewTab('ACTIVOS');
      
      const toTop = () => {
        try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
        const anchor = document.getElementById('tickets-top-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'instant', block: 'start' });
      };

      toTop();
      requestAnimationFrame(toTop);
      setTimeout(toTop, 40);
      setTimeout(toTop, 120);
      setTimeout(toTop, 250);

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

      // Foco inmediato con preventScroll: true para que jamás desplace la vista hacia abajo
      setTimeout(() => {
        const input = document.getElementById('prestamo-person-name');
        if (input) {
          try {
            input.focus({ preventScroll: true });
          } catch (_) {
            input.focus();
          }
        }
        toTop();
      }, 80);

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
      responsable: loanResponsable || 'TAYRON SALINAS',
      estado: 'EN PROCESO',
      usuario: beneficiaryType, // 'DOCENTE' o 'ALUMNO'
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
    <div className="space-y-4 pb-32 md:pb-12 w-full max-w-7xl 2xl:max-w-[1720px] mx-auto">
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
      <div id="tickets-top-anchor" className="flex flex-wrap items-center justify-between gap-2 px-1 scroll-mt-20">
        <div className="flex items-center gap-2 min-w-0">
          <HandHelping className="w-5 h-5 text-amber-500 stroke-[2.4] shrink-0" />
          <h1 className="text-base font-black text-slate-950 dark:text-white tracking-tight whitespace-nowrap">
            Préstamos de Material
          </h1>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0">
          <button
            onClick={() => {
              setActiveViewTab('ACTIVOS');
              window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              if (document.documentElement) document.documentElement.scrollTop = 0;
              if (document.body) document.body.scrollTop = 0;
            }}
            className={`h-8 px-3 rounded-lg font-bold text-xs transition flex items-center gap-1.5 active:scale-95 whitespace-nowrap ${
              activeViewTab === 'ACTIVOS'
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
            className={`h-8 px-3 rounded-lg font-bold text-xs transition flex items-center gap-1.5 active:scale-95 whitespace-nowrap ${
              activeViewTab === 'CONCLUIDOS'
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
      </div>

      {/* =========================================================================
          FORMULARIO ÁGIL: PASO 1 (DOCENTE O ALUMNO FIRMA QUE RECIBIÓ EL OBJETO)
          ========================================================================= */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200 dark:border-zinc-800 rounded-2xl p-3 sm:p-4 shadow-xs">
        <form onSubmit={handleRegisterLoan} className="space-y-2.5">
          {/* Fila 1: Beneficiario + Nombre + Aula + Responsable */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-3 grid grid-cols-2 gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
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

            <div className="sm:col-span-4">
              <input
                id="prestamo-person-name"
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder={beneficiaryType === 'DOCENTE' ? 'Nombre del Docente' : 'Nombre o Código del Alumno'}
                className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 font-bold focus:outline-none focus:border-[#FDBA30]"
              />
            </div>

            <div className="sm:col-span-2 relative">
              <button
                type="button"
                onClick={() => setIsRoomCalendarOpen(true)}
                className={`w-full h-10 px-2.5 text-xs font-mono font-bold rounded-xl border transition flex items-center justify-between active:scale-98 ${
                  roomInput
                    ? 'bg-amber-100/80 dark:bg-amber-950/50 border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-[#141418] border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:border-amber-400 dark:hover:border-amber-500'
                }`}
                title="Abrir mapa de aulas estilo calendario"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{roomInput ? `Aula ${roomInput}` : 'Aula'}</span>
                </div>
                {roomInput ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoomInput('');
                    }}
                    className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    title="Quitar aula"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-tight bg-slate-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-zinc-300">
                    Elegir
                  </span>
                )}
              </button>
            </div>

            <div className="sm:col-span-3">
              <CustomSelect
                value={loanResponsable}
                onChange={setLoanResponsable}
                options={asistentes}
                placeholder="Responsable / Asistente"
                className="h-10 text-xs font-bold"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
            {activeLoans.map(ticket => {
              const ben = parseBeneficiary(ticket.descripcionSolucion);
              const isSigningInline = inlineSignTicketId === ticket.id;
              const isReceivingInline = inlineReceiveTicketId === ticket.id;

              return (
                <div 
                  key={ticket.id}
                  className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-amber-400/80 dark:hover:border-zinc-700 transition-all overflow-hidden"
                >
                  <div className="space-y-2.5">
                    {/* Header: Aula, Ubicación y Hora */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-black text-xs sm:text-sm bg-slate-900 dark:bg-zinc-800 text-amber-400 dark:text-amber-400 px-2.5 py-0.5 rounded-xl shrink-0 shadow-2xs tracking-tight">
                          {ticket.ambiente || 'DOCENCIA'}
                        </span>
                        {(ticket.pabellon || ticket.piso) && (
                          <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                            {ticket.pabellon ? `Pab. ${ticket.pabellon}` : ''} {ticket.piso ? `(${ticket.piso})` : ''}
                          </span>
                        )}
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
                          subtitle="Firma directamente con el dedo en pantalla"
                          height={85}
                          compact={true}
                          autoOpen={true}
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
                        className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
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
                        {(ticket.pabellon || ticket.piso) && (
                          <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                            {ticket.pabellon ? `Pab. ${ticket.pabellon}` : ''} {ticket.piso ? `(${ticket.piso})` : ''}
                          </span>
                        )}
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
      {isRoomCalendarOpen && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsRoomCalendarOpen(false)}
        >
          <div 
            className="w-full max-w-2xl bg-white dark:bg-[#0c0c10] border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
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
                onClick={() => setIsRoomCalendarOpen(false)}
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
                  className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    calendarPabellon === 'A'
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
                  className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    calendarPabellon === 'B'
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
                  className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                    calendarPabellon === 'TODOS'
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
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition active:scale-95 shrink-0 ${
                        isActive
                          ? 'bg-slate-950 dark:bg-zinc-800 text-[#FDBA30] font-black shadow-xs'
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Filtro por Tipo de Ambiente (Aulas, Laboratorios, Talleres del Excel) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                {[
                  { id: 'TODOS', label: 'Todos los Ambientes' },
                  { id: 'AULA', label: '🏫 Aulas' },
                  { id: 'LABORATORIO', label: '🔬 Laboratorios' },
                  { id: 'TALLER', label: '📐 Talleres' }
                ].map((cat) => {
                  const isActive = calendarCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCalendarCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition active:scale-95 shrink-0 ${
                        isActive
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
                    const isLab = room.categoria === 'LABORATORIO';
                    const isTaller = room.categoria === 'TALLER';
                    const isEspecial = room.categoria === 'ESPECIAL' || room.categoria === 'OFICINA';

                    return (
                      <button
                        key={room.abrv}
                        type="button"
                        title={`${room.nombre} · ${room.piso} (${room.pabellon})`}
                        onClick={() => {
                          setRoomInput(room.abrv);
                          setIsRoomCalendarOpen(false);
                          setToastMessage(`✅ ${room.nombre || room.abrv} seleccionada`);
                          setTimeout(() => setToastMessage(''), 1800);
                        }}
                        className={`p-2 sm:p-2.5 rounded-2xl border transition-all duration-150 flex flex-col items-center justify-center text-center active:scale-95 group relative ${
                          isSelected
                            ? 'bg-[#FDBA30] text-slate-950 border-[#FDBA30] shadow-md ring-2 ring-amber-400 font-black'
                            : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border-slate-200/90 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                        }`}
                      >
                        <span className={`font-mono text-sm sm:text-base font-black tracking-tight leading-none ${
                          isSelected ? 'text-slate-950' : 'text-slate-900 dark:text-white'
                        }`}>
                          {room.abrv}
                        </span>

                        {/* Subtítulo dinámico con data del Excel: AULA, LABORATORIO, TALLER (SIN TEXTOS DE PISO COMO TERCER, CUARTO) */}
                        <div className="mt-1">
                          {isLab ? (
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md inline-block leading-tight ${
                              isSelected
                                ? 'bg-slate-950 text-sky-300'
                                : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60'
                            }`}>
                              {room.tag}
                            </span>
                          ) : isTaller ? (
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md inline-block leading-tight ${
                              isSelected
                                ? 'bg-slate-950 text-purple-300'
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60'
                            }`}>
                              {room.tag}
                            </span>
                          ) : isEspecial ? (
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md inline-block leading-tight ${
                              isSelected
                                ? 'bg-slate-950 text-amber-300'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60'
                            }`}>
                              {room.tag}
                            </span>
                          ) : (
                            <span className={`text-[9.5px] font-bold leading-tight ${
                              isSelected ? 'text-slate-900 font-black' : 'text-slate-400 dark:text-zinc-500'
                            }`}>
                              Aula
                            </span>
                          )}
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
                    setIsRoomCalendarOpen(false);
                  }}
                  className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition"
                >
                  🏢 Docencia
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRoomInput('');
                    setIsRoomCalendarOpen(false);
                  }}
                  className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition"
                >
                  ❌ Sin Aula
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsRoomCalendarOpen(false)}
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
          MODAL DE DETALLES DEL PRÉSTAMO Y PREVISUALIZACIÓN DE FIRMAS
          ========================================================================= */}
      {detailTicket && typeof document !== 'undefined' && createPortal(
        (() => {
          const ben = parseBeneficiary(detailTicket.descripcionSolucion);
          const cleanDetailText = (detailTicket.descripcionSolucion || '')
            .replace(/\[(?:🎓|👨‍🏫)?\s*(?:ALUMNO|DOCENTE)(?::\s*[^\]]+)?\]\s*/i, '')
            .trim();
          const returnTimeMatch = (detailTicket.descripcionSolucion || '').match(/\[DEVUELTO\s+([^\]]+)\]/i);
          const returnTimeStr = returnTimeMatch ? returnTimeMatch[1] : null;
          const fRecepcion = detailTicket.firmaRecepcion || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_recepcion_${detailTicket.id}`) : null);
          const fEntrega = detailTicket.firmaEntrega || (typeof localStorage !== 'undefined' ? localStorage.getItem(`upn_sign_entrega_${detailTicket.id}`) : null);

          return (
            <div
              className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-md animate-backdrop-fade"
              onClick={() => setDetailTicket(null)}
            >
              <div
                className="w-full max-w-lg bg-white dark:bg-[#0c0c10] border border-slate-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-spring-up"
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
                        <span className="font-mono font-black text-xs bg-slate-900 dark:bg-zinc-800 text-white px-2.5 py-0.5 rounded-lg border border-slate-700">
                          {detailTicket.ambiente || 'DOCENCIA'}
                        </span>
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/70 inline-flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" />
                          {detailTicket.estado === 'ATENDIDO' ? 'DEVUELTO / CONCLUIDO' : detailTicket.estado}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white leading-tight mt-1 truncate">
                        Detalles del Préstamo y Firmas
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailTicket(null)}
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

                  {/* Grilla de Información del Solicitante y Horarios */}
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
                        Ambiente / Ubicación
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                        {detailTicket.ambiente || 'DOCENCIA'} · {detailTicket.piso || 'Sede'}
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

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800">
                      <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                        Hora de Devolución
                      </div>
                      <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {returnTimeStr ? `${returnTimeStr} hrs` : 'Concluido'}
                      </div>
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
                        const target = detailTicket;
                        setDetailTicket(null);
                        handleReopen(target);
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
                    onClick={() => setDetailTicket(null)}
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
    </div>
  );
}
