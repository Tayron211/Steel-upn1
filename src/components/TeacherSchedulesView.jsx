import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  GraduationCap,
  Calendar,
  Clock,
  DoorOpen,
  Search,
  BookOpen,
  Check,
  Copy,
  Layers,
  ChevronRight,
  Filter,
  Sparkles,
  RefreshCw,
  Sun,
  Sunset,
  Moon,
  ChevronDown,
  ChevronsUpDown,
  Hash,
  FileSpreadsheet,
  X,
  Eye
} from 'lucide-react';
import ToastBanner from './ToastBanner';
import { useFadeModal } from '../utils/useFadeModal';

// Helper de copia enriquecida a portapapeles: Formato tabla HTML para Excel (con colores) + Texto TSV
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
  }

  return false;
};

// Generador de tablas con estilos oficiales UPN para exportar o pegar en Excel
const generateTeacherScheduleTable = (teachers) => {
  const teacherList = Array.isArray(teachers) ? teachers : [teachers];
  const headers = ['N°', 'DOCENTE', 'DÍA', 'HORA INICIO', 'HORA FIN', 'AULA', 'NRC', 'CURSO', 'CARRERA / SECCIÓN'];

  const tsvRows = [headers.join('\t')];
  let globalIndex = 1;
  const tableRowsHtml = [];

  teacherList.forEach(t => {
    t.classes.forEach(c => {
      const docName = (t.name || c.docente || '').trim();
      const dia = c.dia || '';
      const inicio = c.horaInicioProg || '';
      const fin = c.horaFinalProg || '';
      const aula = c.aula || '';
      const nrc = c.nrc || '-';
      const curso = c.curso || 'CURSO PROGRAMADO';
      const carreraSec = [c.carrera, c.seccion ? `Sec: ${c.seccion}` : ''].filter(Boolean).join(' • ') || 'UPN';

      tsvRows.push([globalIndex, docName, dia, inicio, fin, aula, nrc, curso, carreraSec].join('\t'));

      tableRowsHtml.push(`
        <tr style="background-color:#FFFFFF;color:#000000;">
          <td style="border:1px solid #000000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;background-color:#F2F2F2;">${globalIndex}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:left;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;white-space:nowrap;">${docName}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:10pt;white-space:nowrap;">${dia}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;white-space:nowrap;">${inicio}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;white-space:nowrap;">${fin}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;background-color:#FFF2CC;color:#B25900;white-space:nowrap;">${aula}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;background-color:#E0E7FF;color:#312E81;white-space:nowrap;">${nrc}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:left;font-family:Calibri,Arial,sans-serif;font-size:10pt;">${curso}</td>
          <td style="border:1px solid #000000;padding:5px 8px;text-align:left;font-family:Calibri,Arial,sans-serif;font-size:9.5pt;color:#4B5563;">${carreraSec}</td>
        </tr>
      `);
      globalIndex++;
    });
  });

  const html = `
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<!--StartFragment-->
<table border="1" cellpadding="5" cellspacing="0" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt;border:1px solid #000000;text-align:center;">
  <thead>
    <tr style="background-color:#FFC000;color:#000000;">
      ${headers.map(h => `<th style="border:1px solid #000000;padding:6px 10px;background-color:#FFC000;color:#000000;font-weight:bold;font-family:Calibri,Arial,sans-serif;font-size:11pt;text-align:center;white-space:nowrap;">${h}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${tableRowsHtml.join('')}
  </tbody>
</table>
<!--EndFragment-->
  `.trim();

  return { html, plain: tsvRows.join('\n'), totalRows: globalIndex - 1 };
};

const DAYS_ORDER = [
  { id: 'LUNES', short: 'LUN', label: 'Lunes' },
  { id: 'MARTES', short: 'MAR', label: 'Martes' },
  { id: 'MIERCOLES', short: 'MIÉ', label: 'Miércoles' },
  { id: 'JUEVES', short: 'JUE', label: 'Jueves' },
  { id: 'VIERNES', short: 'VIE', label: 'Viernes' },
  { id: 'SABADO', short: 'SÁB', label: 'Sábado' },
  { id: 'DOMINGO', short: 'DOM', label: 'Domingo' }
];

const normalizeDay = (d) => {
  if (!d) return '';
  return String(d)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export default function TeacherSchedulesView() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJornada, setSelectedJornada] = useState('ALL'); // 'ALL' | 'MANANA' | 'TARDE' | 'NOCHE'
  const [toastMessage, setToastMessage] = useState('');

  // Día actual predeterminado (incluyendo Domingo = 0)
  const currentDayIndex = new Date().getDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const defaultDay = currentDayIndex === 0
    ? 'DOMINGO'
    : (currentDayIndex >= 1 && currentDayIndex <= 6
      ? DAYS_ORDER[currentDayIndex - 1].id
      : 'LUNES');

  // Selección múltiple de días (Set de IDs en mayúsculas sin tildes)
  const [selectedDays, setSelectedDays] = useState(() => [defaultDay]);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    fetch('/api/attendance')
      .then(res => res.json())
      .then(json => {
        if (!isCancelled && json.success && Array.isArray(json.data)) {
          setClasses(json.data);
        }
      })
      .catch(err => console.error('Error cargando horarios de docentes:', err))
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const toggleDay = (dayId) => {
    setSelectedDays(prev => {
      if (prev.includes(dayId)) {
        if (prev.length === 1) return prev; // Mantener al menos 1 seleccionado
        return prev.filter(d => d !== dayId);
      } else {
        return [...prev, dayId];
      }
    });
  };

  const selectToday = () => {
    setSelectedDays([defaultDay]);
  };

  const selectWeekdays = () => {
    setSelectedDays(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES']);
  };

  const selectWeekend = () => {
    setSelectedDays(['SABADO', 'DOMINGO']);
  };

  const selectAllDays = () => {
    setSelectedDays(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
  };

  // Filtrado y agrupación de clases por docente
  const teachersGrouped = useMemo(() => {
    if (!Array.isArray(classes) || classes.length === 0) return [];

    const normSelectedDays = new Set(selectedDays.map(normalizeDay));
    const query = searchTerm.trim().toLowerCase();

    // 1. Filtrar clases que coincidan con los días seleccionados
    const dayFilteredClasses = classes.filter(c => {
      const cDay = normalizeDay(c.dia);
      if (!normSelectedDays.has(cDay)) return false;

      // Filtro de jornada
      if (selectedJornada !== 'ALL') {
        const startMin = timeToMinutes(c.horaInicioProg);
        if (selectedJornada === 'MANANA' && (startMin < 7 * 60 || startMin >= 13 * 60)) return false;
        if (selectedJornada === 'TARDE' && (startMin < 13 * 60 || startMin >= 18 * 60)) return false;
        if (selectedJornada === 'NOCHE' && startMin < 18 * 60) return false;
      }

      // Filtro de búsqueda por texto (docente, curso, aula, carrera)
      if (query) {
        const doc = (c.docente || '').toLowerCase();
        const curso = (c.curso || '').toLowerCase();
        const aula = (c.aula || '').toLowerCase();
        const carrera = (c.carrera || '').toLowerCase();
        if (!doc.includes(query) && !curso.includes(query) && !aula.includes(query) && !carrera.includes(query)) {
          return false;
        }
      }

      return true;
    });

    // 2. Agrupar por nombre de docente
    const map = new Map();
    dayFilteredClasses.forEach(c => {
      const rawName = (c.docente || '').trim();
      if (!rawName || rawName.includes('#N/D') || rawName.length < 3) return;

      const normName = rawName.toUpperCase();
      if (!map.has(normName)) {
        map.set(normName, {
          name: normName,
          classes: []
        });
      }
      map.get(normName).classes.push(c);
    });

    // 3. Ordenar las clases de cada docente cronológicamente por día y hora
    const result = Array.from(map.values()).map(doc => {
      const sortedClasses = [...doc.classes].sort((a, b) => {
        const dayA = normalizeDay(a.dia);
        const dayB = normalizeDay(b.dia);
        const dayOrderA = DAYS_ORDER.findIndex(d => d.id === dayA);
        const dayOrderB = DAYS_ORDER.findIndex(d => d.id === dayB);
        if (dayOrderA !== dayOrderB) return dayOrderA - dayOrderB;

        return timeToMinutes(a.horaInicioProg) - timeToMinutes(b.horaInicioProg);
      });

      // Calcular horas totales
      let totalMinutes = 0;
      const uniqueDays = new Set();
      const uniqueRooms = new Set();

      sortedClasses.forEach(cl => {
        const s = timeToMinutes(cl.horaInicioProg);
        const e = timeToMinutes(cl.horaFinalProg);
        if (e > s) totalMinutes += (e - s);
        if (cl.dia) uniqueDays.add(normalizeDay(cl.dia));
        if (cl.aula) uniqueRooms.add(cl.aula.trim().toUpperCase());
      });

      return {
        name: doc.name,
        classes: sortedClasses,
        totalClasses: sortedClasses.length,
        totalHours: (totalMinutes / 60).toFixed(1).replace('.0', ''),
        uniqueDaysCount: uniqueDays.size,
        uniqueRoomsCount: uniqueRooms.size
      };
    });

    // Ordenar docentes alfabéticamente
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [classes, selectedDays, searchTerm, selectedJornada]);

  // Resumen estadístico
  const stats = useMemo(() => {
    let totalClassesCount = 0;
    const roomSet = new Set();

    teachersGrouped.forEach(t => {
      totalClassesCount += t.totalClasses;
      t.classes.forEach(c => {
        if (c.aula) roomSet.add(c.aula.trim().toUpperCase());
      });
    });

    return {
      teachersCount: teachersGrouped.length,
      classesCount: totalClassesCount,
      roomsCount: roomSet.size
    };
  }, [teachersGrouped]);

  // Estado para la ventana flotante (Modal) con el horario detallado del docente
  const [selectedTeacherForModal, setSelectedTeacherForModal] = useState(null);
  const teacherModalFade = useFadeModal(
    selectedTeacherForModal,
    () => setSelectedTeacherForModal(null),
    200,
    { isModal: true }
  );

  // Copia grupal de todas las clases de un docente en formato Tabla Excel con colores oficiales
  const copyTeacherSchedule = async (teacher) => {
    try {
      const { html, plain, totalRows } = generateTeacherScheduleTable(teacher);
      const ok = await copyRichTableToClipboard(plain, html);
      if (ok) {
        setToastMessage(`📋 Tabla Excel copiada: ${teacher.name} (${totalRows} clase${totalRows === 1 ? '' : 's'})`);
      } else {
        setToastMessage('❌ No se pudo copiar la tabla al portapapeles');
      }
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Error al copiar horario de docente:', err);
      setToastMessage('❌ Error al copiar tabla de horario');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  // Copia individual de una clase específica en formato Tabla Excel con colores oficiales
  const copySingleClass = async (c, teacherName) => {
    try {
      const { html, plain } = generateTeacherScheduleTable({
        name: teacherName || c.docente || '',
        classes: [c]
      });
      const ok = await copyRichTableToClipboard(plain, html);
      if (ok) {
        setToastMessage(`📋 Clase copiada para Excel: Aula ${c.aula} (${c.horaInicioProg} - ${c.horaFinalProg})`);
      } else {
        setToastMessage('❌ No se pudo copiar la clase al portapapeles');
      }
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error('Error al copiar clase individual:', err);
      setToastMessage('❌ Error al copiar clase individual');
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-4 pb-36 md:pb-12 animate-fade-in">
      {/* Toast Notificación */}
      {toastMessage && (
        <ToastBanner
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Header Panel con Selector Múltiple de Días */}
      <div className="bg-white dark:bg-[#0c0c10] rounded-3xl p-4 sm:p-6 border border-slate-200/90 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 flex items-center justify-center shadow-xs shrink-0">
              <GraduationCap className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Horarios de Docentes por Día
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Consulta los turnos, aulas asignadas y total de clases de cada docente
              </p>
            </div>
          </div>

          {/* Presets Rápidos de Selección (Scrolleables en móvil) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
            <button
              type="button"
              onClick={selectToday}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${selectedDays.length === 1 && selectedDays[0] === defaultDay
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                }`}
            >
              Hoy ({DAYS_ORDER.find(d => d.id === defaultDay)?.label || defaultDay})
            </button>
            <button
              type="button"
              onClick={selectWeekdays}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${selectedDays.length === 5 && !selectedDays.includes('SABADO') && !selectedDays.includes('DOMINGO')
                  ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                }`}
            >
              Lun a Vie
            </button>
            <button
              type="button"
              onClick={selectWeekend}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${selectedDays.length === 2 && selectedDays.includes('SABADO') && selectedDays.includes('DOMINGO')
                  ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                }`}
            >
              Fin de Semana
            </button>
            <button
              type="button"
              onClick={selectAllDays}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${selectedDays.length === 7
                  ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800/80 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                }`}
            >
              Toda la Semana (7 Días)
            </button>
          </div>
        </div>

        {/* Barra de Selección Múltiple de Días (7 Días en 1 sola fila responsiva) */}
        <div>
          <label className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-2">
            <span>Días Seleccionados ({selectedDays.length} activos)</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold lowercase">
              Toca para marcar o desmarcar
            </span>
          </label>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {DAYS_ORDER.map(d => {
              const isSelected = selectedDays.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  className={`h-10 sm:h-11 rounded-xl sm:rounded-2xl text-xs font-black transition-all flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 active:scale-95 border cursor-pointer ${isSelected
                      ? 'bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 border-[#FDBA30] shadow-[0_4px_16px_rgba(253,186,48,0.35)] scale-[1.02]'
                      : 'bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800'
                    }`}
                >
                  <span className="sm:hidden text-[10px] font-black tracking-tight">{d.short}</span>
                  <span className="hidden sm:inline text-xs truncate">{d.label}</span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 sm:hidden" />
                  )}
                  <div className={`hidden sm:flex w-4 h-4 rounded-full items-center justify-center shrink-0 ${isSelected ? 'bg-slate-950 text-[#FDBA30]' : 'border border-slate-300 dark:border-zinc-700'
                    }`}>
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3.5]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Buscador y Filtro de Jornada */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* Input de Búsqueda */}
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por apellidos o nombres de docente, curso o aula (ej. B101, AS01)..."
              className="w-full h-11 pl-10 pr-9 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#FDBA30]/30 focus:border-[#FDBA30] font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro de Turno / Jornada */}
          <div className="md:col-span-4 flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setSelectedJornada('ALL')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-center transition ${selectedJornada === 'ALL'
                  ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-xs font-black'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedJornada('MANANA')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-center transition ${selectedJornada === 'MANANA'
                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => setSelectedJornada('TARDE')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-center transition ${selectedJornada === 'TARDE'
                  ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
            >
              Tarde
            </button>
            <button
              type="button"
              onClick={() => setSelectedJornada('NOCHE')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-center transition ${selectedJornada === 'NOCHE'
                  ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-950'
                }`}
            >
              Noche
            </button>
          </div>
        </div>

        {/* Barra de Métricas y Estadísticas (Ultra optimizada para móvil) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
          <div className="p-2 sm:p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 block truncate">Docentes</span>
              <span className="text-sm sm:text-lg font-black text-slate-900 dark:text-white font-mono">{stats.teachersCount}</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4]" />
            </div>
          </div>

          <div className="p-2 sm:p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 block truncate">Clases</span>
              <span className="text-sm sm:text-lg font-black text-slate-900 dark:text-white font-mono">{stats.classesCount}</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4]" />
            </div>
          </div>

          <div className="p-2 sm:p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/80 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 block truncate">Aulas</span>
              <span className="text-sm sm:text-lg font-black text-slate-900 dark:text-white font-mono">{stats.roomsCount}</span>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <DoorOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4]" />
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Conteo y Resumen */}
      {!loading && teachersGrouped.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">
            Mostrando <span className="font-black text-slate-900 dark:text-white font-mono">{teachersGrouped.length}</span> docentes · <span className="font-mono text-amber-600 dark:text-amber-400 font-black">{stats.classesCount}</span> clases activas
          </div>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 hidden sm:inline-flex items-center gap-1 font-medium">
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            Toca cualquier tarjeta para ver su horario en ventana flotante
          </span>
        </div>
      )}

      {/* Cuadrícula Uniforme y 100% Simétrica de Tarjetas de Docentes */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-[#0c0c10] rounded-3xl border border-slate-200 dark:border-zinc-800">
          <RefreshCw className="w-8 h-8 text-[#FDBA30] animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">Cargando horarios de docentes...</p>
        </div>
      ) : teachersGrouped.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#0c0c10] rounded-3xl border border-slate-200 dark:border-zinc-800">
          <Search className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No se encontraron docentes con clases programadas</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Prueba seleccionando más días (incluyendo Domingo) o cambiando los filtros de búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 items-start">
          {teachersGrouped.map((teacher) => {
            const uniqueRooms = Array.from(new Set(teacher.classes.map(c => c.aula).filter(Boolean)));
            const roomSummary = uniqueRooms.slice(0, 3).join(', ') + (uniqueRooms.length > 3 ? '...' : '');

            return (
              <div
                key={teacher.name}
                onClick={() => setSelectedTeacherForModal(teacher)}
                className="h-[72px] bg-white dark:bg-[#0c0c10] rounded-2xl p-3 border border-slate-200/90 dark:border-zinc-800 shadow-2xs hover:border-amber-400/80 dark:hover:border-amber-500/60 hover:shadow-md transition-all duration-150 flex flex-col justify-center cursor-pointer group select-none active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 group-hover:bg-[#FDBA30] group-hover:text-slate-950 flex items-center justify-center shrink-0 transition">
                      <GraduationCap className="w-4 h-4 stroke-[2.3]" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3
                        className="font-extrabold text-xs text-slate-950 dark:text-white tracking-tight truncate leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
                        title={teacher.name}
                      >
                        {teacher.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 flex-nowrap overflow-hidden">
                        <span className="shrink-0 text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300">
                          {teacher.totalClasses} {teacher.totalClasses === 1 ? 'Clase' : 'Clases'}
                        </span>
                        <span className="shrink-0 text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {teacher.totalHours} hrs
                        </span>
                        {roomSummary && (
                          <span
                            className="text-[9.5px] font-mono text-slate-500 dark:text-zinc-400 truncate shrink min-w-0"
                            title={`Aulas: ${uniqueRooms.join(', ')}`}
                          >
                            · {roomSummary}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyTeacherSchedule(teacher);
                      }}
                      title="Copiar horario en formato tabla de Excel con colores oficiales"
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950/60 dark:hover:text-amber-300 text-slate-600 dark:text-zinc-300 flex items-center justify-center transition active:scale-90"
                    >
                      <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                    <div
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition shrink-0"
                      title="Ver horario completo en ventana flotante"
                    >
                      <Eye className="w-3.5 h-3.5 stroke-[2.3]" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ventana Flotante (Modal) con la Información y Clases del Docente */}
      {teacherModalFade.shouldRender && typeof document !== 'undefined' && createPortal(
        (() => {
          const doc = teacherModalFade.cachedData || selectedTeacherForModal;
          if (!doc) return null;
          const uniqueRoomsList = Array.from(new Set(doc.classes.map(c => c.aula).filter(Boolean)));

          return (
            <div
              className={`fixed inset-0 z-[999999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-md ${teacherModalFade.backdropClass}`}
              onClick={() => teacherModalFade.requestClose()}
            >
              <div
                className={`w-full max-w-2xl bg-white dark:bg-[#0c0c10] border-t sm:border border-slate-200/90 dark:border-zinc-800 rounded-t-[28px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] ${teacherModalFade.modalClass}`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Indicador táctil superior para móvil tipo Bottom Sheet */}
                <div className="w-10 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full mx-auto mt-2.5 sm:hidden" />

                {/* Cabecera de la Ventana Flotante */}
                <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between gap-3 bg-slate-50/70 dark:bg-zinc-900/40">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#FDBA30] text-slate-950 flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                      <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.4]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/60">
                          Horario Docente UPN
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 truncate max-w-[180px]">
                          {selectedDays.join(' · ')}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-lg md:text-xl font-black text-slate-950 dark:text-white leading-tight tracking-tight break-words">
                        {doc.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] sm:text-[11px] font-black uppercase px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300">
                          {doc.totalClasses} {doc.totalClasses === 1 ? 'Clase' : 'Clases'}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-black uppercase px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {doc.totalHours} hrs totales
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-black uppercase px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          {doc.uniqueRoomsCount} {doc.uniqueRoomsCount === 1 ? 'Aula' : 'Aulas'} ({uniqueRoomsList.join(', ')})
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => teacherModalFade.requestClose()}
                    className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition shrink-0 cursor-pointer active:scale-90"
                    title="Cerrar ventana"
                  >
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Barra de Acción: Copiar todo en bloque (Excel con colores) */}
                <div className="px-4 sm:px-6 py-2 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] sm:text-xs font-bold text-amber-900 dark:text-amber-300">
                    Listado cronológico de clases programadas
                  </span>
                  <button
                    type="button"
                    onClick={() => copyTeacherSchedule(doc)}
                    className="w-full sm:w-auto h-9 sm:h-8 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    title="Copiar todas las clases en formato tabla Excel con colores"
                  >
                    <Copy className="w-3.5 h-3.5 stroke-[2.4]" />
                    <span>Copiar todo en bloque (Excel)</span>
                  </button>
                </div>

                {/* Cuerpo del Modal: Lista de Clases con NRC, Horas y Copia Individual */}
                <div className="p-3.5 sm:p-6 overflow-y-auto max-h-[58vh] sm:max-h-[60vh] space-y-2.5 custom-scrollbar">
                  {doc.classes.map((c, idx) => (
                    <div
                      key={`${c.aula}-${c.horaInicioProg}-${c.dia}-${idx}`}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 flex flex-col gap-1.5 hover:border-amber-400/60 transition group"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-[#FDBA30] text-slate-950 font-mono font-black text-xs shadow-2xs">
                            Aula {c.aula}
                          </span>
                          {c.nrc && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono font-black text-[11px] border border-indigo-200/60 dark:border-indigo-800/60">
                              NRC: {c.nrc}
                            </span>
                          )}
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300">
                            {c.dia}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-500 stroke-[2.4]" />
                            {c.horaInicioProg} - {c.horaFinalProg}
                          </span>
                          <button
                            type="button"
                            onClick={() => copySingleClass(c, doc.name)}
                            title="Copiar esta clase individual en tabla Excel con colores"
                            className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-slate-500 hover:text-amber-800 dark:text-zinc-400 dark:hover:text-amber-300 border border-slate-200 dark:border-zinc-700 flex items-center justify-center transition active:scale-90 cursor-pointer shadow-2xs"
                          >
                            <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm font-extrabold text-slate-950 dark:text-white leading-snug">
                        {c.curso || 'CURSO PROGRAMADO'}
                      </p>

                      <div className="text-[10.5px] text-slate-500 dark:text-zinc-400 font-medium truncate">
                        {c.carrera || c.seccion ? `${c.carrera || ''} ${c.seccion ? `• Sec: ${c.seccion}` : ''}` : 'Horario Académico UPN'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pie del Modal (Adaptado a móviles) */}
                <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-safe">
                  <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 text-center sm:text-left">
                    Total: <span className="font-black text-slate-900 dark:text-white font-mono">{doc.totalClasses}</span> clases asignadas
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyTeacherSchedule(doc)}
                      className="flex-1 sm:flex-none h-10 sm:h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Copy className="w-3.5 h-3.5 stroke-[2.4]" />
                      <span>Copiar todo en bloque</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => teacherModalFade.requestClose()}
                      className="h-10 sm:h-9 px-4 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-black transition cursor-pointer flex items-center justify-center active:scale-95"
                    >
                      Cerrar
                    </button>
                  </div>
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
