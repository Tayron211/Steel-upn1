import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar, 
  Plus, 
  Search, 
  Clock, 
  Building, 
  User, 
  Trash2, 
  CalendarDays,
  CalendarPlus,
  DoorOpen,
  Users,
  Flame,
  X,
  Check,
  ChevronDown
} from 'lucide-react';
import ToastBanner from './ToastBanner';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';

const CAMPUS_ROOMS_CATALOG = [
  // --- PABELLÓN A ---
  // Sótano
  { abrv: 'AS01', nombre: 'Laboratorio ZAM AS-01', pabellon: 'A', piso: 'SÓTANO', categoria: 'LABORATORIO', tipo: 'Laboratorio ZAM', aforo: 30 },
  { abrv: 'AS02', nombre: 'Taller de Audio AS-02', pabellon: 'A', piso: 'SÓTANO', categoria: 'TALLER', tipo: 'Taller de Audio', aforo: 10 },
  { abrv: 'AS03', nombre: 'Taller de Audio AS-03', pabellon: 'A', piso: 'SÓTANO', categoria: 'TALLER', tipo: 'Taller de Audio', aforo: 10 },
  { abrv: 'AS04', nombre: 'Laboratorio de Fotografía AS-04', pabellon: 'A', piso: 'SÓTANO', categoria: 'LABORATORIO', tipo: 'Lab. Fotografía', aforo: 20 },
  { abrv: 'AS05', nombre: 'Laboratorio de Fotografía AS-05', pabellon: 'A', piso: 'SÓTANO', categoria: 'LABORATORIO', tipo: 'Lab. Fotografía', aforo: 20 },
  // 1er Piso
  { abrv: 'A101', nombre: 'Taller de Edición A-101', pabellon: 'A', piso: '1ER PISO', categoria: 'TALLER', tipo: 'Taller de Edición', aforo: 21 },
  // 2do Piso
  { abrv: 'A201', nombre: 'Aula A-201', pabellon: 'A', piso: '2DO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A202', nombre: 'Aula A-202', pabellon: 'A', piso: '2DO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  // 3er Piso
  { abrv: 'A301', nombre: 'Aula A-301', pabellon: 'A', piso: '3ER PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A302', nombre: 'Aula A-302', pabellon: 'A', piso: '3ER PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A303', nombre: 'Aula A-303', pabellon: 'A', piso: '3ER PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A304', nombre: 'Aula A-304', pabellon: 'A', piso: '3ER PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A305', nombre: 'Aula A-305', pabellon: 'A', piso: '3ER PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A306', nombre: 'Sala de Conferencias A-306', pabellon: 'A', piso: '3ER PISO', categoria: 'ESPECIAL', tipo: 'Sala de Conferencias', aforo: 60 },
  // 4to Piso
  { abrv: 'A401', nombre: 'Aula A-401', pabellon: 'A', piso: '4TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A402', nombre: 'Aula A-402', pabellon: 'A', piso: '4TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A403', nombre: 'Laboratorio de Diseño y Producción Digital A-403', pabellon: 'A', piso: '4TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. Diseño Digital', aforo: 40 },
  { abrv: 'A404', nombre: 'Aula A-404', pabellon: 'A', piso: '4TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A405', nombre: 'Aula A-405', pabellon: 'A', piso: '4TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 20 },
  { abrv: 'A406', nombre: 'Aula de Litigación A-406', pabellon: 'A', piso: '4TO PISO', categoria: 'ESPECIAL', tipo: 'Aula de Litigación', aforo: 37 },
  { abrv: 'A407', nombre: 'Sala de Conferencias A-407', pabellon: 'A', piso: '4TO PISO', categoria: 'ESPECIAL', tipo: 'Sala de Conferencias', aforo: 60 },
  // 5to Piso
  { abrv: 'A501', nombre: 'Aula A-501', pabellon: 'A', piso: '5TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A502', nombre: 'Aula A-502', pabellon: 'A', piso: '5TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'A503', nombre: 'Laboratorio de Diseño Gráfico A-503', pabellon: 'A', piso: '5TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. Diseño Gráfico', aforo: 40 },
  { abrv: 'A504', nombre: 'Laboratorio de Diseño Gráfico A-504', pabellon: 'A', piso: '5TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. Diseño Gráfico', aforo: 40 },
  { abrv: 'A505', nombre: 'Laboratorio de Cómputo A-505', pabellon: 'A', piso: '5TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. de Cómputo', aforo: 40 },
  { abrv: 'A506', nombre: 'Laboratorio de Cómputo A-506', pabellon: 'A', piso: '5TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. de Cómputo', aforo: 40 },
  { abrv: 'A507', nombre: 'Aula Multifuncional A-507', pabellon: 'A', piso: '5TO PISO', categoria: 'AULA', tipo: 'Aula Multifuncional', aforo: 16 },
  { abrv: 'A508', nombre: 'Laboratorio de Cómputo A-508', pabellon: 'A', piso: '5TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. de Cómputo', aforo: 40 },
  { abrv: 'A509', nombre: 'Laboratorio de Cómputo A-509', pabellon: 'A', piso: '5TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. de Cómputo', aforo: 40 },
  { abrv: 'A510', nombre: 'Laboratorio de Cómputo A-510', pabellon: 'A', piso: '5TO PISO', categoria: 'LABORATORIO', tipo: 'Lab. de Cómputo', aforo: 40 },

  // --- PABELLÓN B ---
  // 1er Piso
  { abrv: 'B101', nombre: 'Laboratorio de Impresión 3D B-101', pabellon: 'B', piso: '1ER PISO', categoria: 'LABORATORIO', tipo: 'Lab. Impresión 3D', aforo: 5 },
  { abrv: 'B102', nombre: 'Taller de Creatividad B-102', pabellon: 'B', piso: '1ER PISO', categoria: 'TALLER', tipo: 'Taller Creatividad', aforo: 40 },
  { abrv: 'B103', nombre: 'Taller de Diseño Industrial B-103', pabellon: 'B', piso: '1ER PISO', categoria: 'TALLER', tipo: 'Taller Diseño Ind.', aforo: 30 },
  { abrv: 'B104', nombre: 'Taller de Arquitectura y Dibujo B-104', pabellon: 'B', piso: '1ER PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B105', nombre: 'Taller de Materiales de Construcción B-105', pabellon: 'B', piso: '1ER PISO', categoria: 'TALLER', tipo: 'Taller Materiales', aforo: 28 },
  { abrv: 'B106', nombre: 'Taller de Soldadura B-106', pabellon: 'B', piso: '1ER PISO', categoria: 'TALLER', tipo: 'Taller Soldadura', aforo: 20 },
  // 2do Piso
  { abrv: 'B201', nombre: 'Aula B-201', pabellon: 'B', piso: '2DO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B202', nombre: 'Aula B-202', pabellon: 'B', piso: '2DO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B203', nombre: 'Taller de Arquitectura y Dibujo B-203', pabellon: 'B', piso: '2DO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B204', nombre: 'Taller de Arquitectura y Dibujo B-204', pabellon: 'B', piso: '2DO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B205', nombre: 'Taller de Arquitectura y Dibujo B-205', pabellon: 'B', piso: '2DO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B206', nombre: 'Aula B-206', pabellon: 'B', piso: '2DO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B207', nombre: 'Aula B-207', pabellon: 'B', piso: '2DO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  // 3er Piso
  { abrv: 'B301', nombre: 'Aula B-301', pabellon: 'B', piso: '3ER PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B302', nombre: 'Aula B-302', pabellon: 'B', piso: '3ER PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B303', nombre: 'Taller de Arquitectura y Dibujo B-303', pabellon: 'B', piso: '3ER PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B304', nombre: 'Taller de Arquitectura y Dibujo B-304', pabellon: 'B', piso: '3ER PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B305', nombre: 'Taller de Arquitectura y Dibujo B-305', pabellon: 'B', piso: '3ER PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B306', nombre: 'Taller de Arquitectura y Dibujo B-306', pabellon: 'B', piso: '3ER PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  // 4to Piso
  { abrv: 'B401', nombre: 'Aula B-401', pabellon: 'B', piso: '4TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 20 },
  { abrv: 'B402', nombre: 'Aula B-402', pabellon: 'B', piso: '4TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 20 },
  { abrv: 'B403', nombre: 'Taller de Arquitectura y Dibujo B-403', pabellon: 'B', piso: '4TO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B404', nombre: 'Taller de Arquitectura y Dibujo B-404', pabellon: 'B', piso: '4TO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B405', nombre: 'Taller de Arquitectura y Dibujo B-405', pabellon: 'B', piso: '4TO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B406', nombre: 'Taller de Arquitectura y Dibujo B-406', pabellon: 'B', piso: '4TO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  // 5to Piso
  { abrv: 'B501', nombre: 'Aula B-501', pabellon: 'B', piso: '5TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B502', nombre: 'Aula B-502', pabellon: 'B', piso: '5TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B503', nombre: 'Aula B-503', pabellon: 'B', piso: '5TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 20 },
  { abrv: 'B504', nombre: 'Aula B-504', pabellon: 'B', piso: '5TO PISO', categoria: 'AULA', tipo: 'Aula', aforo: 40 },
  { abrv: 'B505', nombre: 'Taller de Arquitectura y Dibujo B-505', pabellon: 'B', piso: '5TO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B506', nombre: 'Taller de Arquitectura y Dibujo B-506', pabellon: 'B', piso: '5TO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 },
  { abrv: 'B507', nombre: 'Taller de Arquitectura y Dibujo B-507', pabellon: 'B', piso: '5TO PISO', categoria: 'TALLER', tipo: 'Taller Arquitectura', aforo: 40 }
];

const inferCategoria = (rm) => {
  if (rm.categoria) return rm.categoria;
  const text = `${rm.nombre || ''} ${rm.tipo || ''}`.toUpperCase();
  if (text.includes('LAB')) return 'LABORATORIO';
  if (text.includes('TALLER')) return 'TALLER';
  if (text.includes('CONFERENCIA') || text.includes('LITIGAC')) return 'ESPECIAL';
  return 'AULA';
};

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:20', '09:00', '09:10', '10:00', '10:50',
  '11:00', '11:40', '12:00', '12:30', '13:00', '13:20', '14:00', '14:30',
  '15:00', '15:20', '16:00', '16:10', '17:00', '17:50', '18:00', '18:40',
  '19:00', '19:30', '20:00', '20:20', '21:00', '21:10', '22:00', '22:50'
];

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

const PISOS_DISPONIBLES = [
  { label: 'Todos', short: 'Todos', val: '' },
  { label: 'Sótano', short: 'Sót', val: 'SOT' },
  { label: 'Piso 1', short: 'P1', val: '1ER PISO' },
  { label: 'Piso 2', short: 'P2', val: '2DO PISO' },
  { label: 'Piso 3', short: 'P3', val: '3ER PISO' },
  { label: 'Piso 4', short: 'P4', val: '4TO PISO' },
  { label: 'Piso 5', short: 'P5', val: '5TO PISO' }
];

const DAYS_OF_WEEK = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_UPPER = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const normalizeDay = (d) =>
  String(d || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const deducePisoFromAula = (aula) => {
  const code = String(aula || '').toUpperCase().trim();
  if (code.startsWith('AS')) return 'SÓTANO';
  const match = code.match(/^[AB](\d)/);
  if (!match) return '';
  const floor = match[1];
  if (floor === '1') return '1ER PISO';
  if (floor === '2') return '2DO PISO';
  if (floor === '3') return '3ER PISO';
  if (floor === '4') return '4TO PISO';
  if (floor === '5') return '5TO PISO';
  return '';
};

const matchesPiso = (pisoField, targetVal) => {
  if (!pisoField || !targetVal) return false;
  const f = String(pisoField).toUpperCase();
  const t = String(targetVal).toUpperCase();
  if (t === 'SOT' || t.includes('SOT')) return f.includes('SOT') || f.includes('SÓT');
  if (t === '1ER PISO' || t.includes('1ER')) return f.includes('1ER') || f.includes('PRIMER') || f.includes('PISO 1');
  if (t === '2DO PISO' || t.includes('2DO')) return f.includes('2DO') || f.includes('SEGUNDO') || f.includes('PISO 2');
  if (t === '3ER PISO' || t.includes('3ER')) return f.includes('3ER') || f.includes('TERCER') || f.includes('PISO 3');
  if (t === '4TO PISO' || t.includes('4TO')) return f.includes('4TO') || f.includes('CUARTO') || f.includes('PISO 4');
  if (t === '5TO PISO' || t.includes('5TO')) return f.includes('5TO') || f.includes('QUINTO') || f.includes('PISO 5');
  return f.includes(t);
};

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

const timeToMins = (tStr) => {
  if (!tStr) return 0;
  const [h, m] = String(tStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function ReservationsView() {
  const [reservas, setReservas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [dayClasses, setDayClasses] = useState([]);
  const [modalDayClasses, setModalDayClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Vista: 'RESERVAS' (Reservas registradas) | 'FREE_ROOMS' (Aulas libres hoy y próximos días)
  const [viewMode, setViewMode] = useState('RESERVAS');

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedPabellon, setSelectedPabellon] = useState(''); // '' | 'A' | 'B'
  const [selectedPisos, setSelectedPisos] = useState([]); // Array selección múltiple
  const [selectedDayOffset, setSelectedDayOffset] = useState(null); // null = Todas las fechas, 0 = Hoy, 1 = Mañana, 2..6 = Próximos días
  const [selectedHoraBlock, setSelectedHoraBlock] = useState(() => getCurrentHourBlock()); // '' = Todo el día, o '07:30', etc.

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('ALL'); // 'ALL' | 'AULA' | 'LABORATORIO' | 'TALLER' | 'ESPECIAL'
  const [pickerPabellon, setPickerPabellon] = useState(''); // '' | 'A' | 'B'
  const [pickerPiso, setPickerPiso] = useState(''); // '' | 'SOT' | '1ER PISO' | ...
  const [toastMessage, setToastMessage] = useState('');

  // Generar los próximos 7 días (Hoy + 6 días siguientes)
  const upcomingDays = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const fechaStr = `${yyyy}-${mm}-${dd}`;
      const diaName = DAYS_OF_WEEK[d.getDay()];
      const diaShort = DAYS_SHORT[d.getDay()];
      const mesName = MONTHS_UPPER[d.getMonth()];
      list.push({
        offset: i,
        fecha: fechaStr,
        shortDate: `${dd}/${mm}`,
        diaName,
        diaShort,
        mesName,
        label: i === 0 ? `Hoy (${diaShort})` : i === 1 ? `Mañana (${diaShort})` : `${diaShort} ${dd}/${mm}`
      });
    }
    return list;
  }, []);

  // Día activo para consulta de disponibilidad (si está en null, usa Hoy por defecto para Aulas Libres)
  const activeDayInfo = useMemo(() => {
    const idx = selectedDayOffset !== null ? selectedDayOffset : 0;
    return upcomingDays[idx] || upcomingDays[0];
  }, [selectedDayOffset, upcomingDays]);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    mes: MONTHS_UPPER[new Date().getMonth()],
    dia: DAYS_OF_WEEK[new Date().getDay()],
    inicio: '14:30',
    final: '16:10',
    aula: 'A201',
    ubicacion: '2DO PISO - A',
    docente: '',
    detalle: '',
    usuario: 'Operaciones',
    prioridad: 'NORMAL'
  });

  const handleTogglePiso = (val) => {
    if (!val) {
      setSelectedPisos([]);
      return;
    }
    setSelectedPisos(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    );
  };

  const loadReservasAndRooms = async () => {
    setLoading(true);
    try {
      const [resReservas, resRooms] = await Promise.all([
        fetch('/api/reservations'),
        fetch('/api/rooms')
      ]);
      const [jsonReservas, jsonRooms] = await Promise.all([
        resReservas.json(),
        resRooms.json()
      ]);
      if (jsonReservas.success) setReservas(jsonReservas.data || []);
      if (jsonRooms.success) setRooms(jsonRooms.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar clases programadas del día seleccionado para calcular qué aulas están libres hoy o en los próximos días
  const loadScheduleForDay = async (diaName) => {
    if (!diaName) return;
    setLoadingClasses(true);
    try {
      const res = await fetch(`/api/attendance?dia=${encodeURIComponent(diaName)}`);
      const json = await res.json();
      if (json.success) {
        setDayClasses(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    loadReservasAndRooms();
  }, []);

  useEffect(() => {
    loadScheduleForDay(activeDayInfo.diaName);
  }, [activeDayInfo.diaName]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Catálogo unificado de todas las aulas, laboratorios y talleres
  const allRooms = useMemo(() => {
    const map = new Map();
    CAMPUS_ROOMS_CATALOG.forEach(rm => {
      map.set(rm.abrv.toUpperCase().trim(), {
        ...rm,
        categoria: inferCategoria(rm)
      });
    });
    rooms.forEach(rm => {
      if (!rm.abrv) return;
      const key = rm.abrv.toUpperCase().trim();
      const existing = map.get(key) || {};
      const merged = {
        ...existing,
        ...rm,
        abrv: key,
        nombre: existing.nombre || rm.nombre || `Ambiente ${key}`,
        tipo: existing.tipo || rm.tipo || 'Aula'
      };
      merged.categoria = inferCategoria(merged);
      map.set(key, merged);
    });
    return Array.from(map.values());
  }, [rooms]);

  // Mapa rápido de aulas para obtener piso y pabellón
  const roomMap = useMemo(() => {
    const map = {};
    allRooms.forEach(rm => {
      if (rm.abrv) map[rm.abrv.toUpperCase().trim()] = rm;
    });
    return map;
  }, [allRooms]);

  // Cargar clases del día elegido dentro del modal "Nueva Reserva"
  useEffect(() => {
    const dt = new Date((formData.fecha || new Date().toISOString().split('T')[0]) + 'T12:00:00');
    const diaModal = DAYS_OF_WEEK[dt.getDay()] || formData.dia;
    if (diaModal === activeDayInfo.diaName) {
      setModalDayClasses(dayClasses);
      return;
    }
    let cancelled = false;
    fetch(`/api/attendance?dia=${encodeURIComponent(diaModal)}`)
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j.success) {
          setModalDayClasses(j.data || []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [formData.fecha, activeDayInfo.diaName, dayClasses]);

  // Solo aulas que estén 100% LIBRES en la fecha y rango horario (inicio - final) de la Nueva Reserva
  const freeRoomsForModalTime = useMemo(() => {
    const bStart = timeToMins(formData.inicio);
    const bEnd = timeToMins(formData.final);
    const targetFecha = formData.fecha;

    return allRooms.filter(rm => {
      const code = (rm.abrv || '').toUpperCase().trim();

      // Conflicto con clases programadas ese día
      const classConflict = modalDayClasses.some(c => {
        if ((c.aula || '').toUpperCase().trim() !== code) return false;
        const cStart = timeToMins(c.horaInicioProg);
        const cEnd = timeToMins(c.horaFinalProg);
        return cStart < bEnd && cEnd > bStart;
      });
      if (classConflict) return false;

      // Conflicto con otras reservas en esa misma fecha
      const resConflict = reservas.some(r => {
        if ((r.aula || '').toUpperCase().trim() !== code) return false;
        if (r.fecha !== targetFecha) return false;
        const rStart = timeToMins(r.inicio || r.hora_inicio);
        const rEnd = timeToMins(r.final || r.hora_fin);
        return rStart < bEnd && rEnd > bStart;
      });
      if (resConflict) return false;

      return true;
    });
  }, [allRooms, modalDayClasses, reservas, formData.fecha, formData.inicio, formData.final]);

  // Si el aula seleccionada pasa a estar ocupada al cambiar fecha u horario, autoseleccionar la primera aula libre
  useEffect(() => {
    if (!isModalOpen) return;
    const currentCode = (formData.aula || '').toUpperCase().trim();
    const stillFree = freeRoomsForModalTime.some(r => r.abrv === currentCode);
    if (!stillFree && freeRoomsForModalTime.length > 0) {
      const firstFree = freeRoomsForModalTime[0];
      setFormData(prev => ({
        ...prev,
        aula: firstFree.abrv,
        ubicacion: `${firstFree.piso} - ${firstFree.pabellon}`
      }));
    }
  }, [isModalOpen, freeRoomsForModalTime, formData.aula]);

  // Lista filtrada para el menú selector de Aula / Laboratorio dentro del modal (SOLO AULAS LIBRES)
  const pickerFilteredRooms = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return freeRoomsForModalTime.filter(rm => {
      if (pickerCategory !== 'ALL' && rm.categoria !== pickerCategory) return false;
      if (pickerPabellon && rm.pabellon !== pickerPabellon) return false;
      if (pickerPiso && !matchesPiso(rm.piso, pickerPiso)) return false;
      if (q) {
        const hit =
          (rm.abrv && rm.abrv.toLowerCase().includes(q)) ||
          (rm.nombre && rm.nombre.toLowerCase().includes(q)) ||
          (rm.tipo && rm.tipo.toLowerCase().includes(q)) ||
          (rm.piso && rm.piso.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [freeRoomsForModalTime, pickerCategory, pickerPabellon, pickerPiso, pickerSearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cleanAula = (formData.aula || '').toUpperCase().trim();
      const rm = roomMap[cleanAula];
      const dt = new Date((formData.fecha || new Date().toISOString().split('T')[0]) + 'T12:00:00');
      const computedDia = DAYS_OF_WEEK[dt.getDay()] || formData.dia;
      const computedMes = MONTHS_UPPER[dt.getMonth()] || formData.mes;
      const computedUbicacion = rm
        ? `${rm.piso} - ${rm.pabellon}`
        : `${deducePisoFromAula(cleanAula) || 'SEDE'} - ${cleanAula.startsWith('B') ? 'B' : 'A'}`;

      const payload = {
        ...formData,
        aula: cleanAula,
        dia: computedDia,
        mes: computedMes,
        ubicacion: computedUbicacion
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setReservas(prev => [json.data, ...prev]);
        setToastMessage(`✅ Reserva en Aula ${cleanAula} registrada (${payload.inicio} - ${payload.final})`);
        setTimeout(() => setToastMessage(''), 3000);
        setIsModalOpen(false);
        resetForm();
      } else {
        alert('Error al guardar reserva: ' + (json.error || 'intente nuevamente'));
      }
    } catch (err) {
      console.error(err);
      setToastMessage('❌ Error al registrar reserva');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const resetForm = () => {
    const target = activeDayInfo || upcomingDays[0];
    const blockObj = REAL_BLOCKS.find(b => b.start === selectedHoraBlock) || REAL_BLOCKS[4];
    setFormData({
      fecha: target.fecha,
      mes: target.mesName,
      dia: target.diaName,
      inicio: blockObj.start,
      final: blockObj.end,
      aula: 'A201',
      ubicacion: '2DO PISO - A',
      docente: '',
      detalle: '',
      usuario: 'Operaciones',
      prioridad: 'NORMAL'
    });
  };

  const handleOpenReserveForFreeRoom = (room) => {
    const target = activeDayInfo || upcomingDays[0];
    const blockObj = REAL_BLOCKS.find(b => b.start === selectedHoraBlock) || REAL_BLOCKS.find(b => b.start === getCurrentHourBlock()) || REAL_BLOCKS[0];
    setFormData({
      fecha: target.fecha,
      mes: target.mesName,
      dia: target.diaName,
      inicio: blockObj.start,
      final: blockObj.end,
      aula: room.abrv,
      ubicacion: `${room.piso} - ${room.pabellon}`,
      docente: '',
      detalle: '',
      usuario: 'Operaciones',
      prioridad: 'NORMAL'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;
    setReservas(prev => prev.filter(r => r.id !== id));
    setToastMessage('✅ Reserva cancelada');
    setTimeout(() => setToastMessage(''), 3000);
    await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
  };

  // Filtrado de Reservas Registradas (por Día/Fecha, Pabellón, Piso, Hora y Texto)
  const filtered = useMemo(() => {
    return reservas.filter(r => {
      const code = (r.aula || '').toUpperCase().trim();
      const rm = roomMap[code];
      const pab = rm?.pabellon || (code.startsWith('B') ? 'B' : (code.startsWith('A') ? 'A' : ''));
      const pisoStr = rm?.piso || r.ubicacion || deducePisoFromAula(code);

      if (selectedPabellon && pab !== selectedPabellon) return false;
      if (selectedPisos.length > 0) {
        const matchesAny = selectedPisos.some(p => matchesPiso(pisoStr, p));
        if (!matchesAny) return false;
      }

      if (selectedDayOffset !== null) {
        const target = upcomingDays[selectedDayOffset];
        if (target) {
          const sameFecha = r.fecha === target.fecha;
          const sameDia = normalizeDay(r.dia) === target.diaName;
          if (!sameFecha && !sameDia) return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        return (
          (r.aula && r.aula.toLowerCase().includes(q)) ||
          (r.docente && r.docente.toLowerCase().includes(q)) ||
          (r.detalle && r.detalle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [reservas, roomMap, selectedPabellon, selectedPisos, selectedDayOffset, upcomingDays, search]);

  // Cálculo de Aulas Libres para Hoy y los Próximos Días
  const freeRooms = useMemo(() => {
    const target = activeDayInfo;
    const blockObj = REAL_BLOCKS.find(b => b.start === selectedHoraBlock);

    return allRooms
      .filter(room => {
        if (selectedPabellon && room.pabellon !== selectedPabellon) return false;
        if (selectedPisos.length > 0) {
          const matchesAny = selectedPisos.some(p => matchesPiso(room.piso, p));
          if (!matchesAny) return false;
        }
        if (search) {
          const q = search.toLowerCase();
          const matchRoom =
            (room.abrv && room.abrv.toLowerCase().includes(q)) ||
            (room.nombre && room.nombre.toLowerCase().includes(q)) ||
            (room.tipo && room.tipo.toLowerCase().includes(q));
          if (!matchRoom) return false;
        }
        return true;
      })
      .map(room => {
        const code = (room.abrv || '').toUpperCase().trim();

        // Clases programadas en esta aula en ese día de la semana
        const classesInRoom = dayClasses.filter(
          c => (c.aula || '').toUpperCase().trim() === code
        );

        // Reservas registradas en esta aula para esa fecha
        const reservasInRoom = reservas.filter(
          r => (r.aula || '').toUpperCase().trim() === code && r.fecha === target.fecha
        );

        // Verificar si está ocupada en el bloque horario seleccionado
        let isBusyInSelectedBlock = false;
        if (blockObj) {
          const bStart = blockObj.startM;
          const bEnd = blockObj.endM;

          const classConflict = classesInRoom.some(c => {
            const cStart = timeToMins(c.horaInicioProg);
            const cEnd = timeToMins(c.horaFinalProg);
            return cStart < bEnd && cEnd > bStart;
          });

          const resConflict = reservasInRoom.some(r => {
            const rStart = timeToMins(r.inicio || r.hora_inicio);
            const rEnd = timeToMins(r.final || r.hora_fin);
            return rStart < bEnd && rEnd > bStart;
          });

          isBusyInSelectedBlock = classConflict || resConflict;
        }

        // Calcular cuántos bloques de los 9 totales están libres ese día
        const freeBlocksList = REAL_BLOCKS.filter(b => {
          const cConflict = classesInRoom.some(c => {
            const cStart = timeToMins(c.horaInicioProg);
            const cEnd = timeToMins(c.horaFinalProg);
            return cStart < b.endM && cEnd > b.startM;
          });
          const rConflict = reservasInRoom.some(r => {
            const rStart = timeToMins(r.inicio || r.hora_inicio);
            const rEnd = timeToMins(r.final || r.hora_fin);
            return rStart < b.endM && rEnd > b.startM;
          });
          return !cConflict && !rConflict;
        });

        return {
          ...room,
          isBusyInSelectedBlock,
          freeBlocksCount: freeBlocksList.length,
          freeBlocksList,
          classesCount: classesInRoom.length,
          reservasCount: reservasInRoom.length
        };
      })
      .filter(room => {
        // Si hay un bloque horario activo, mostrar solo las aulas 100% libres en ese bloque
        if (selectedHoraBlock) {
          return !room.isBusyInSelectedBlock;
        }
        // Si seleccionó "Todo el día", mostrar aulas que tengan al menos 1 bloque libre
        return room.freeBlocksCount > 0;
      });
  }, [allRooms, dayClasses, reservas, activeDayInfo, selectedHoraBlock, selectedPabellon, selectedPisos, search]);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <ToastBanner
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Panel Controlador Principal con Filtros por Día (Hoy / Próximos Días), Pabellones, Pisos y Aulas Libres */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3">
        {/* Cabecera + Conmutador Reservas / Aulas Libres + Botón Nueva Reserva */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
                Espacios, Talleres & Disponibilidad
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              Reservas de Ambientes
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Conmutador entre Reservas Programadas y Aulas Libres */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setViewMode('RESERVAS')}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                  viewMode === 'RESERVAS'
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-500 stroke-[2.3]" />
                <span>Reservas ({filtered.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('FREE_ROOMS');
                  if (selectedDayOffset === null) setSelectedDayOffset(0);
                }}
                className={`h-8 px-3 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                  viewMode === 'FREE_ROOMS'
                    ? 'bg-emerald-600 text-white font-black shadow-2xs'
                    : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5 stroke-[2.3]" />
                <span>Aulas Libres ({freeRooms.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="h-9 px-3.5 rounded-xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>Nueva Reserva</span>
            </button>
          </div>
        </div>

        {/* Fila 1: Selector de Hoy y Próximos Días */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          {viewMode === 'RESERVAS' && (
            <button
              type="button"
              onClick={() => setSelectedDayOffset(null)}
              className={`h-8 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 active:scale-95 ${
                selectedDayOffset === null
                  ? 'bg-slate-900 text-white dark:bg-[#FDBA30] dark:text-slate-950 font-black shadow-2xs'
                  : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todas las fechas
            </button>
          )}

          {upcomingDays.map((d) => {
            const isSelected =
              viewMode === 'FREE_ROOMS'
                ? (selectedDayOffset ?? 0) === d.offset
                : selectedDayOffset === d.offset;

            return (
              <button
                key={d.fecha}
                type="button"
                onClick={() => setSelectedDayOffset(d.offset)}
                className={`h-8 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-[#FDBA30] dark:text-slate-950 font-black shadow-2xs'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{d.offset === 0 ? 'Hoy' : d.offset === 1 ? 'Mañana' : d.diaShort}</span>
                <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                  isSelected
                    ? 'bg-white/20 dark:bg-black/15 text-white dark:text-slate-950 font-black'
                    : 'text-slate-400 dark:text-zinc-500'
                }`}>
                  {d.shortDate}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fila 2: Buscador + Filtro Pabellón (Ambos / Pab. A / Pab. B) + Filtro Pisos (Todos / Sót / P1..P5) */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 stroke-[2.2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                viewMode === 'FREE_ROOMS'
                  ? 'Buscar aula libre por código (A201, B102) o laboratorio...'
                  : 'Buscar por aula (A201), docente solicitante o detalle...'
              }
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-[#16161b] focus:border-[#FDBA30] transition font-semibold"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}
          </div>

          {/* Pabellón Pills */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 shrink-0 w-full sm:w-auto">
            {['', 'A', 'B'].map((pab) => (
              <button
                key={pab || 'ALL'}
                type="button"
                onClick={() => setSelectedPabellon(pab)}
                className={`flex-1 sm:flex-initial h-7 px-2.5 rounded-lg text-xs font-bold transition active:scale-95 whitespace-nowrap ${
                  selectedPabellon === pab
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {pab ? `Pab. ${pab}` : 'Ambos'}
              </button>
            ))}
          </div>

          {/* Pisos Pills (Selección Múltiple) */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none w-full sm:w-auto shrink-0 py-0.5">
            {PISOS_DISPONIBLES.map((p) => {
              const isTodos = p.val === '';
              const isSelected = isTodos
                ? selectedPisos.length === 0
                : selectedPisos.includes(p.val);

              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleTogglePiso(p.val)}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition active:scale-95 shrink-0 inline-flex items-center gap-1 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={isTodos ? 'Mostrar todos los pisos' : `Filtrar ${p.label}`}
                >
                  <span>{p.short}</span>
                  {!isTodos && isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fila 3 (En modo Aulas Libres): Selector de Bloque Horario para ver qué aulas están libres en esa hora */}
        {viewMode === 'FREE_ROOMS' && (
          <div className="flex items-center gap-1 overflow-x-auto pt-1.5 border-t border-slate-100 dark:border-zinc-800 scrollbar-none text-[11px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-1 shrink-0">
              Horario:
            </span>
            <button
              type="button"
              onClick={() => setSelectedHoraBlock(getCurrentHourBlock())}
              className={`h-6 px-2.5 rounded-md font-bold transition whitespace-nowrap shrink-0 inline-flex items-center gap-1 active:scale-95 ${
                selectedHoraBlock === getCurrentHourBlock()
                  ? 'bg-emerald-600 text-white font-black shadow-2xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <Clock className="w-3 h-3 stroke-[2.4]" />
              <span>Actual ({getCurrentHourBlock()})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedHoraBlock('')}
              className={`h-6 px-2.5 rounded-md font-bold transition whitespace-nowrap shrink-0 active:scale-95 ${
                !selectedHoraBlock
                  ? 'bg-slate-900 dark:bg-zinc-800 text-white font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
              }`}
            >
              Cualquier hora
            </button>

            {REAL_BLOCKS.map((b) => {
              const isSelected = selectedHoraBlock === b.start;
              return (
                <button
                  key={b.start}
                  type="button"
                  onClick={() => setSelectedHoraBlock(b.start)}
                  className={`h-6 px-2 rounded-md font-mono font-bold transition whitespace-nowrap shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-[#FDBA30] text-slate-950 font-black'
                      : 'bg-slate-100/80 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {b.start} - {b.end}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CONTENIDO SEGÚN MODO: AULAS LIBRES (HOY Y PRÓXIMOS DÍAS) vs RESERVAS PROGRAMADAS */}
      {viewMode === 'FREE_ROOMS' ? (
        <div className="space-y-3">
          {/* Banner informativo de disponibilidad */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 p-3.5 rounded-2xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <DoorOpen className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-200 leading-tight">
                  {freeRooms.length} Aulas Libres para {activeDayInfo.offset === 0 ? 'Hoy' : activeDayInfo.offset === 1 ? 'Mañana' : activeDayInfo.diaName} ({activeDayInfo.fecha})
                  {selectedHoraBlock ? ` · Bloque ${selectedHoraBlock}` : ' · Durante el día'}
                </h3>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Sin clases programadas ni reservas activas en el horario seleccionado. Haz clic en cualquier aula para reservarla.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('RESERVAS')}
              className="text-xs font-bold bg-white dark:bg-zinc-800 text-emerald-900 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Ver Reservas ({filtered.length})
            </button>
          </div>

          {loading || loadingClasses ? (
            <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Verificando disponibilidad de aulas para {activeDayInfo.diaName}...</p>
            </div>
          ) : freeRooms.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs px-4">
              <DoorOpen className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2 stroke-[1.8]" />
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No hay aulas libres con estos filtros</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Prueba seleccionando otro bloque horario, piso o pabellón.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {freeRooms.map((room) => {
                const blockObj = REAL_BLOCKS.find(b => b.start === selectedHoraBlock);
                return (
                  <div
                    key={room.abrv}
                    onClick={() => handleOpenReserveForFreeRoom(room)}
                    className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between cursor-pointer transition-all duration-150 active:scale-98 group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-2">
                        <span className="font-mono font-black text-sm bg-slate-900 dark:bg-zinc-800 group-hover:bg-[#FDBA30] group-hover:text-slate-950 text-white px-2.5 py-0.5 rounded-xl transition-colors">
                          {room.abrv}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          LIBRE
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-800 dark:text-white break-words mb-1 group-hover:text-amber-500 transition-colors">
                        {room.nombre}
                      </h4>

                      <div className="flex flex-wrap items-center gap-1 mb-2.5">
                        <span className="inline-block text-[10px] font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                          {room.tipo} · Pab. {room.pabellon} ({room.piso})
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Aforo: <strong className="text-slate-900 dark:text-white">{room.aforo} pers.</strong></span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {room.freeBlocksCount}/9 bloques libres
                          </span>
                        </div>

                        <div className="text-[10px] font-mono font-semibold text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-zinc-800 flex items-center justify-between">
                          <span>{activeDayInfo.diaShort} {activeDayInfo.shortDate}</span>
                          <span className="text-slate-800 dark:text-zinc-200 font-bold">
                            {blockObj ? `${blockObj.start} - ${blockObj.end}` : 'Varios horarios'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReserveForFreeRoom(room);
                      }}
                      className="w-full mt-2.5 h-8 bg-amber-400 hover:bg-[#FDBA30] active:bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 stroke-[2.4]" />
                      <span>Reservar {activeDayInfo.offset === 0 ? 'Hoy' : activeDayInfo.diaShort}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Grid of Reservation Cards */
        loading ? (
          <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Cargando reservas programadas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs px-4 space-y-2">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2 stroke-[1.8]" />
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No se encontraron reservas para este filtro</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Puedes revisar qué ambientes están libres o limpiar los filtros de piso/pabellón.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              {(selectedDayOffset !== null || selectedPabellon || selectedPisos.length > 0 || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayOffset(null);
                    setSelectedPabellon('');
                    setSelectedPisos([]);
                    setSearch('');
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 transition"
                >
                  Ver todas las reservas
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setViewMode('FREE_ROOMS');
                  if (selectedDayOffset === null) setSelectedDayOffset(0);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition inline-flex items-center gap-1.5"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Ver Aulas Libres ({freeRooms.length})</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(r => {
              const isImportante = r.prioridad === 'IMPORTANTE';
              const rm = roomMap[(r.aula || '').toUpperCase().trim()];
              const displayUbicacion = r.ubicacion || (rm ? `${rm.piso} - ${rm.pabellon}` : 'UPN Comas');

              return (
                <div
                  key={r.id}
                  className={`rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between ${
                    isImportante 
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60' 
                      : 'bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-0.5 rounded-xl font-mono tracking-tight">
                          {r.aula}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400">
                          {displayUbicacion}
                        </span>
                      </div>

                      <span className={`inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isImportante 
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800/80' 
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                      }`}>
                        {isImportante && <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.2]" />}
                        <span>{r.prioridad || 'NORMAL'}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono bg-slate-50 dark:bg-[#121216] px-3 py-1.5 rounded-xl border border-slate-200/70 dark:border-zinc-800 mb-3">
                      <span className="text-slate-600 dark:text-zinc-300 font-semibold">
                        {r.dia} · {r.fecha}
                      </span>
                      <span className="text-slate-900 dark:text-white font-bold inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
                        <span>{r.inicio || r.hora_inicio} - {r.final || r.hora_fin}</span>
                      </span>
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="text-xs font-bold text-slate-900 dark:text-white inline-flex items-start gap-1.5 w-full">
                        <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 stroke-[2.2] shrink-0 mt-0.5" />
                        <span className="break-words leading-tight">{r.docente || 'Solicitante no especificado'}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 pl-5 font-medium leading-relaxed break-words" title={r.detalle || r.motivo}>
                        {r.detalle || r.motivo || 'Sin detalle de actividad.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
                    <span>Por: <strong className="text-slate-700 dark:text-zinc-300 font-semibold">{r.usuario}</strong></span>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center justify-center"
                      title="Cancelar Reserva"
                    >
                      <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal: New Reservation - 100% Symmetrical */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 max-h-[90vh] overflow-y-auto animate-spring-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800 mb-4">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 flex items-center justify-center shadow-xs shrink-0">
                  <Calendar className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                    Nueva Reserva de Ambiente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Préstamo de aula o laboratorio con horario definido
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    <span>Aula / Laboratorio Libre *</span>
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                      {freeRoomsForModalTime.length} libres
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPickerSearch('');
                      setIsRoomPickerOpen(true);
                    }}
                    className="w-full h-10 text-xs px-3 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition flex items-center justify-between gap-2 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-mono font-black text-[11px] border border-amber-300/60 dark:border-amber-800/60 shrink-0">
                        {formData.aula || 'ELEGIR'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 truncate">
                        {roomMap[(formData.aula || '').toUpperCase().trim()]?.tipo ||
                          roomMap[(formData.aula || '').toUpperCase().trim()]?.nombre ||
                          'Ver menú de aulas y labs'}
                      </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0 stroke-[2.5]" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Fecha *</label>
                  <CustomDatePicker
                    value={formData.fecha}
                    onChange={(val) => setFormData({ ...formData, fecha: val })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Hora Inicio *</label>
                  <CustomSelect
                    value={formData.inicio}
                    onChange={(val) => setFormData({ ...formData, inicio: val })}
                    options={TIME_OPTIONS}
                    placeholder="Hora Inicio"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Hora Final *</label>
                  <CustomSelect
                    value={formData.final}
                    onChange={(val) => setFormData({ ...formData, final: val })}
                    options={TIME_OPTIONS}
                    placeholder="Hora Final"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Docente / Solicitante *</label>
                <input
                  type="text"
                  required
                  value={formData.docente}
                  onChange={(e) => setFormData({ ...formData, docente: e.target.value })}
                  placeholder="Apellidos y Nombres"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Detalle / Motivo *</label>
                <textarea
                  rows="2.5"
                  required
                  value={formData.detalle}
                  onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                  placeholder="Ej: Uso de laboratorio para taller práctico de arquitectura..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Prioridad</label>
                  <CustomSelect
                    value={formData.prioridad}
                    onChange={(val) => setFormData({ ...formData, prioridad: val })}
                    options={[
                      { value: 'NORMAL', label: 'Normal' },
                      { value: 'IMPORTANTE', label: 'Importante / Evento' }
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Registrado por</label>
                  <input
                    type="text"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 sm:h-12 rounded-2xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200/90 dark:border-zinc-700 transition flex items-center justify-center text-center active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-11 sm:h-12 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition flex items-center justify-center text-center active:scale-95"
                >
                  Confirmar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Menú Selector de Todas las Aulas, Laboratorios y Talleres */}
      {isRoomPickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 sm:p-4 animate-backdrop-fade"
          onClick={() => setIsRoomPickerOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200/90 dark:border-zinc-800 max-h-[88vh] flex flex-col animate-spring-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Menú de Aulas y Laboratorios */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 flex items-center justify-center shadow-xs shrink-0">
                  <DoorOpen className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                    Aulas y Laboratorios Libres ({formData.inicio} - {formData.final})
                  </h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 truncate">
                    ✓ Solo se muestran ambientes libres el {formData.fecha} ({pickerFilteredRooms.length} disponibles)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoomPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Buscador + Filtros Rápidos (Categoría, Pabellón y Piso) */}
            <div className="py-3 space-y-2.5 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
              {/* Buscador */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Buscar aula libre por código (A201, A505, B101, AS04) o nombre..."
                  className="w-full h-9 pl-9 pr-8 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPickerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Pestañas por Tipo de Ambiente Libre: Todos | Aulas | Laboratorios | Talleres | Especiales */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {[
                  { id: 'ALL', label: 'Todos Libres', count: freeRoomsForModalTime.length },
                  { id: 'AULA', label: '🏫 Aulas', count: freeRoomsForModalTime.filter(r => r.categoria === 'AULA').length },
                  { id: 'LABORATORIO', label: '🔬 Laboratorios', count: freeRoomsForModalTime.filter(r => r.categoria === 'LABORATORIO').length },
                  { id: 'TALLER', label: '📐 Talleres', count: freeRoomsForModalTime.filter(r => r.categoria === 'TALLER').length },
                  { id: 'ESPECIAL', label: '🎙️ Conferencias / Litigación', count: freeRoomsForModalTime.filter(r => r.categoria === 'ESPECIAL').length }
                ].map(cat => {
                  const active = pickerCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPickerCategory(cat.id)}
                      className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 active:scale-95 ${
                        active
                          ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-zinc-800'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                        active ? 'bg-slate-950/15 text-slate-950' : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}>
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Filtros de Pabellón y Piso */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                  {[
                    { label: 'Ambos Pab.', val: '' },
                    { label: 'Pab. A', val: 'A' },
                    { label: 'Pab. B', val: 'B' }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPickerPabellon(p.val)}
                      className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                        pickerPabellon === p.val
                          ? 'bg-slate-900 dark:bg-[#FDBA30] text-white dark:text-slate-950 font-black'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 overflow-x-auto no-scrollbar">
                  {PISOS_DISPONIBLES.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPickerPiso(p.val)}
                      className={`h-6 px-2 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                        pickerPiso === p.val
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grilla de Aulas y Laboratorios */}
            <div className="overflow-y-auto py-3 pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[52vh]">
              {pickerFilteredRooms.length === 0 ? (
                <div className="col-span-full py-10 text-center">
                  <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    No se encontraron aulas o laboratorios con ese filtro
                  </p>
                </div>
              ) : (
                pickerFilteredRooms.map(rm => {
                  const isSelected = (formData.aula || '').toUpperCase().trim() === rm.abrv;
                  const catBadge =
                    rm.categoria === 'LABORATORIO'
                      ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/60'
                      : rm.categoria === 'TALLER'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                      : rm.categoria === 'ESPECIAL'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';

                  return (
                    <button
                      key={rm.abrv}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          aula: rm.abrv,
                          ubicacion: `${rm.piso} - ${rm.pabellon}`
                        }));
                        setIsRoomPickerOpen(false);
                      }}
                      className={`p-3 rounded-2xl border text-left transition flex items-start justify-between gap-2.5 active:scale-[0.98] ${
                        isSelected
                          ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500/80 ring-1 ring-amber-400/40'
                          : 'bg-slate-50/70 dark:bg-zinc-900/70 hover:bg-slate-100 dark:hover:bg-zinc-800/80 border-slate-200/80 dark:border-zinc-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2 py-0.5 rounded-lg font-mono text-xs font-black tracking-tight border ${
                            isSelected
                              ? 'bg-[#FDBA30] text-slate-950 border-amber-400'
                              : 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border-slate-200 dark:border-zinc-700'
                          }`}>
                            {rm.abrv}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${catBadge}`}>
                            {rm.categoria === 'LABORATORIO'
                              ? '🔬 Laboratorio'
                              : rm.categoria === 'TALLER'
                              ? '📐 Taller'
                              : rm.categoria === 'ESPECIAL'
                              ? '🎙️ Especial'
                              : '🏫 Aula'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {rm.nombre}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                          <span>{rm.piso} · Pab. {rm.pabellon}</span>
                          {rm.aforo && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Users className="w-3 h-3" /> {rm.aforo} pers.
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#FDBA30] text-slate-950'
                          : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
