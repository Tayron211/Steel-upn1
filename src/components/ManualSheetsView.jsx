import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  Plus,
  Search,
  Printer,
  CheckCircle,
  FileCheck2,
  User,
  UserCheck,
  BookOpen,
  X,
  Share2,
  Copy,
  Check,
  Eye,
  AlertTriangle
} from 'lucide-react';
import UpnLogo from './UpnLogo';
import ToastBanner from './ToastBanner';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';

// Detecta si la hoja es de reemplazo y extrae el nombre del docente reemplazante
const isReemplazoSheet = (item) => (item?.motivo || '').toUpperCase().includes('REEMPLAZO');
const getSuplente = (item) => {
  if (!item) return '';
  if (item.docenteReemplazo) return item.docenteReemplazo;
  if (item.docente_reemplazo) return item.docente_reemplazo;
  const m = (item.motivo || '').match(/REEMPLAZO\s*\(([^)]+)\)/i);
  if (m) return m[1].trim();
  const d = (item.detalle || '').match(/Reemplaza:\s*(.+)$/i);
  if (d) return d[1].trim();
  return '';
};
const getMotivoBase = (item) => (item?.motivo || '').replace(/\s*\([^)]*\)\s*$/, '').trim();

// Extrae el número del código (ej: LN1-097 -> 097)
const extractNumber = (code) => {
  if (!code) return '';
  const m = String(code).match(/LN\d*-?(\d+)/i);
  return m ? m[1] : code.replace(/[^0-9]/g, '');
};

// Genera el siguiente código LN1-XXX disponible entre hojas REALES
const getNextCode = (currentSheets) => {
  const realSheets = (currentSheets || []).filter(r => {
    const doc = String(r.docente || '').trim();
    const nrc = String(r.nrc || '').trim();
    const fec = String(r.fecha || '').trim();
    return (nrc !== '') || (fec !== '') || (doc !== '' && !doc.includes('#N/D') && !doc.includes('#N/A'));
  });
  const maxNum = realSheets.reduce((max, r) => {
    const m = String(r.codigo || '').match(/LN\d*-(\d+)/i);
    const n = m ? parseInt(m[1], 10) : 0;
    return n > max ? n : max;
  }, 0);
  return `LN1-${String(maxNum + 1).padStart(3, '0')}`;
};

// Verifica duplicidad estricta entre hojas REALES emitidas
const isCodeDuplicate = (code, currentSheets) => {
  if (!code || !code.trim()) return false;
  let target = code.trim().toUpperCase().replace(/^LNI-/i, 'LN1-');
  const m = target.match(/^(?:LN\d*-)?(\d+)$/i);
  if (m) {
    target = `LN1-${m[1].padStart(3, '0')}`;
  }
  return (currentSheets || []).some(s => {
    const doc = String(s.docente || '').trim();
    const nrc = String(s.nrc || '').trim();
    const fec = String(s.fecha || '').trim();
    const isReal = (nrc !== '') || (fec !== '') || (doc !== '' && !doc.includes('#N/D') && !doc.includes('#N/A'));
    if (!isReal) return false;
    let existing = String(s.codigo || '').trim().toUpperCase().replace(/^LNI-/i, 'LN1-');
    const em = existing.match(/^(?:LN\d*-)?(\d+)$/i);
    if (em) existing = `LN1-${em[1].padStart(3, '0')}`;
    return existing === target;
  });
};

export default function ManualSheetsView({ initialClassData, onClearInitialClass }) {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMotivo, setFilterMotivo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [nrcLookupLoading, setNrcLookupLoading] = useState(false);
  const [nrcMatchFound, setNrcMatchFound] = useState(null);

  const [formData, setFormData] = useState({
    codigo: '',
    fecha: new Date().toISOString().split('T')[0],
    nrc: '',
    docente: '',
    curso: '',
    carrera: '',
    motivo: 'PROBLEMA CON AUTENTICADOR',
    docenteReemplazo: '',
    asistente: 'José Carlos Miranda Rosales'
  });

  // Validación en tiempo real: El código es ÚNICO e IRREPETIBLE
  const isDuplicate = useMemo(() => isCodeDuplicate(formData.codigo, sheets), [formData.codigo, sheets]);

  const loadSheets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manual-sheets');
      const json = await res.json();
      if (json.success) {
        setSheets(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSheets();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (selectedForPrint) setSelectedForPrint(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, selectedForPrint]);

  useEffect(() => {
    if (initialClassData) {
      const nextCode = getNextCode(sheets);
      setFormData(prev => ({
        ...prev,
        codigo: prev.codigo || nextCode,
        nrc: initialClassData.nrc || '',
        docente: initialClassData.docente || '',
        curso: initialClassData.curso || '',
        carrera: initialClassData.carrera || ''
      }));
      setIsModalOpen(true);
      if (onClearInitialClass) onClearInitialClass();
    }
  }, [initialClassData, sheets]);

  const handleOpenNewModal = () => {
    const nextCode = getNextCode(sheets);
    setFormData({
      codigo: nextCode,
      fecha: new Date().toISOString().split('T')[0],
      nrc: '',
      docente: '',
      curso: '',
      carrera: '',
      motivo: 'PROBLEMA CON AUTENTICADOR',
      docenteReemplazo: '',
      asistente: 'José Carlos Miranda Rosales'
    });
    setNrcMatchFound(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let cleanCode = (formData.codigo || '').trim().toUpperCase().replace(/^LNI-/i, 'LN1-');
    const numMatch = cleanCode.match(/^(?:LN\d*-)?(\d+)$/i);
    if (numMatch) {
      cleanCode = `LN1-${numMatch[1].padStart(3, '0')}`;
    }
    if (!cleanCode || cleanCode === 'LN1-') {
      alert('Debe ingresar el número del código de la hoja (ej. 095).');
      return;
    }
    if (isDuplicate) {
      alert(`⚠️ El código "${cleanCode}" ya fue utilizado. Este código es ÚNICO e IRREPETIBLE, no puede haber duplicidad.`);
      return;
    }

    try {
      const isReemplazo = formData.motivo === 'DOCENTE DE REEMPLAZO';
      const suplente = (formData.docenteReemplazo || '').trim().toUpperCase();

      const payload = {
        ...formData,
        codigo: cleanCode,
        docenteReemplazo: suplente,
        motivo: formData.motivo,
        detalle: isReemplazo && suplente
          ? `Docente Titular: ${formData.docente} | Reemplaza: ${suplente}`
          : (formData.detalle || '')
      };

      const res = await fetch('/api/manual-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) {
        alert('No se pudo registrar la hoja: ' + (json.error || json.message || 'intente nuevamente'));
        return;
      }
      setSheets(prev => [json.data, ...prev]);
      setIsModalOpen(false);
      resetForm();
      setToastMessage(`✅ Hoja ${json.data?.codigo || cleanCode} registrada correctamente`);
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Error de conexión al registrar la hoja. Intente nuevamente.');
    }
  };

  const resetForm = () => {
    setFormData({
      codigo: '',
      fecha: new Date().toISOString().split('T')[0],
      nrc: '',
      docente: '',
      curso: '',
      carrera: '',
      motivo: 'PROBLEMA CON AUTENTICADOR',
      docenteReemplazo: '',
      asistente: 'José Carlos Miranda Rosales'
    });
    setNrcMatchFound(null);
  };

  const handleNrcLookup = async (inputVal) => {
    const rawVal = String(inputVal || '');
    setFormData(prev => ({ ...prev, nrc: rawVal }));
    const nrcVal = rawVal.trim();

    if (!nrcVal) {
      setNrcMatchFound(null);
      return;
    }

    // El NRC en UPN es único: buscamos en la base de datos de control docente
    if (nrcVal.length >= 3) {
      setNrcLookupLoading(true);
      try {
        const res = await fetch(`/api/attendance?nrc=${encodeURIComponent(nrcVal)}&search=${encodeURIComponent(nrcVal)}`);
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          // Priorizar coincidencia exacta de NRC
          const exact = json.data.find(c => String(c.nrc).trim() === nrcVal) || json.data[0];
          setFormData(prev => ({
            ...prev,
            docente: exact.docente || prev.docente,
            curso: exact.curso || prev.curso,
            carrera: exact.carrera || prev.carrera
          }));
          setNrcMatchFound({
            nrc: exact.nrc,
            docente: exact.docente,
            curso: exact.curso,
            carrera: exact.carrera,
            aula: exact.aula
          });
        } else {
          setNrcMatchFound(null);
        }
      } catch (err) {
        console.error('Error buscando clase por NRC:', err);
      } finally {
        setNrcLookupLoading(false);
      }
    } else {
      setNrcMatchFound(null);
    }
  };

  const handleCopyVoucherText = (item) => {
    const isReemplazo = isReemplazoSheet(item);
    const suplenteName = getSuplente(item);

    let text = `📋 *HOJA DE ASISTENCIA MANUAL - UPN COMAS*\nN° Boleta: ${item.codigo}\nFecha: ${item.fecha}\nNRC: ${item.nrc}\nDocente Titular: ${item.docente}\nCurso: ${item.curso}`;
    if (isReemplazo && suplenteName) {
      text += `\n*Docente que Reemplaza:* ${suplenteName}`;
    }
    text += `\nMotivo: ${item.motivo}\nAsistente Emisor: ${item.asistente || 'Operaciones Sede'}`;

    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const motivos = [
    "PROBLEMA CON AUTENTICADOR",
    "DOCENTE SIN ACCESOS",
    "PROBLEMA CON EL SISTEMA",
    "CLASE NO FIGURA EN EL PORTAL",
    "DOCENTE DE REEMPLAZO",
    "RECUPERACIÓN DE CLASE",
    "ADELANTO DE CLASE",
    "ASISTENCIA DE ESTUDIANTES"
  ];

  const asistentes = [
    "José Carlos Miranda Rosales",
    "Francisco Alonso Villafan Colonia",
    "Javier Alexander Benites Alban",
    "Jhonayker Maguiña",
    "Alessandro Pascual Romero",
    "Jael Zulema Gallardo Carranza",
    "Janeth Vivar Perez"
  ];

  // Exclude empty unissued placeholder sheets from Excel, sort by date descending
  const validSheets = useMemo(() => {
    return sheets
      .filter(s => (s.docente && s.docente.trim()) || (s.nrc && s.nrc.trim()) || (s.curso && s.curso.trim()))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.codigo || '').localeCompare(a.codigo || ''));
  }, [sheets]);

  const filtered = useMemo(() => {
    return validSheets.filter(s => {
      if (filterMotivo && getMotivoBase(s) !== filterMotivo) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (s.codigo && s.codigo.toLowerCase().includes(q)) ||
        (s.docente && s.docente.toLowerCase().includes(q)) ||
        (s.curso && s.curso.toLowerCase().includes(q)) ||
        (s.nrc && s.nrc.toLowerCase().includes(q)) ||
        (s.asistente && s.asistente.toLowerCase().includes(q))
      );
    });
  }, [validSheets, search, filterMotivo]);

  return (
    <div className="space-y-4 pb-36 md:pb-12 w-full mx-auto">
      {/* Toast Alert - Portaled to viewport body so it's 100% visible regardless of scroll position */}
      {(copiedSuccess || toastMessage) && (
        <ToastBanner
          message={toastMessage || '¡Texto de boleta copiado al portapapeles!'}
          type="info"
          onClose={() => {
            setCopiedSuccess(false);
            setToastMessage('');
          }}
        />
      )}

      {/* Top Controller Panel - Clean & Orderly */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 truncate">
                Contingencia Académica · Operaciones Sede
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tracking-tight leading-tight">
              Hojas de Asistencia Manual
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded-xl text-xs font-bold font-mono whitespace-nowrap shrink-0">
              {validSheets.length} Emitidas
            </span>

            <button
              onClick={handleOpenNewModal}
              className="h-10 px-4 rounded-xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.8] shrink-0" />
              <span>Emitir Nueva Hoja</span>
            </button>
          </div>
        </div>

        {/* Search & Fast Reason Filter Chips */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[2.2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código (LN1-...), docente, NRC o curso..."
              className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-[#16161b] focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}
          </div>

          {/* Reason Filter Chips - Wrap cleanly without horizontal cutting */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilterMotivo('')}
              className={`h-7 px-3 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${!filterMotivo
                  ? 'bg-slate-900 dark:bg-zinc-800 text-white font-black'
                  : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-800'
                }`}
            >
              Todos ({validSheets.length})
            </button>

            {motivos.slice(0, 5).map(m => (
              <button
                key={m}
                onClick={() => setFilterMotivo(filterMotivo === m ? '' : m)}
                className={`h-7 px-2.5 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${filterMotivo === m
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/70 dark:border-zinc-800'
                  }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sheets Content: Clean, High-Legibility Table & Mobile Cards */}
      {loading ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Cargando hojas de contingencia...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-xs px-4">
          <FileText className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2 stroke-[1.8]" />
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No se encontraron hojas emitidas con este filtro</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Prueba limpiando los filtros o emite una nueva hoja.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (visible on screens < 768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filtered.map(item => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#0c0c0f] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 px-2.5 py-1 rounded-lg shadow-2xs whitespace-nowrap">
                      {item.codigo}
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                      {item.fecha}
                    </span>
                  </div>
                  <span className="font-mono text-xs sm:text-sm font-black text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-900 px-3 py-1 rounded-lg border border-slate-200/90 dark:border-zinc-700 whitespace-nowrap shadow-2xs">
                    NRC {item.nrc}
                  </span>
                </div>

                <div>
                  {isReemplazoSheet(item) && (
                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">Titular</div>
                  )}
                  <h3 className={`text-sm font-extrabold mb-1 break-words ${isReemplazoSheet(item) ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-950 dark:text-white'}`}>
                    {item.docente}
                  </h3>
                  {isReemplazoSheet(item) && (
                    <div className="mb-2 p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/70">
                      <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                        <UserCheck className="w-3 h-3 stroke-[2.4] shrink-0" />
                        <span>Docente Reemplazante</span>
                      </div>
                      <div className={`text-sm font-extrabold break-words mt-0.5 ${getSuplente(item) ? 'text-purple-950 dark:text-purple-100' : 'text-slate-400 dark:text-zinc-500 italic font-semibold text-xs'}`}>
                        {getSuplente(item) || 'No registrado'}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-800 dark:text-zinc-200 font-bold leading-snug break-words">
                    {item.curso}
                  </p>
                  {item.carrera && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5 break-words">
                      {item.carrera}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500">Motivo:</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 break-words">
                      {getMotivoBase(item)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-[#121216] px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 shrink-0">Asistente:</span>
                    <span className="font-bold text-slate-900 dark:text-white break-words leading-tight">
                      {item.asistente || 'Operaciones Sede'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleCopyVoucherText(item)}
                    className="h-8 px-3 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition inline-flex items-center justify-center gap-1.5 active:scale-95"
                    title="Copiar texto para WhatsApp"
                  >
                    <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Copiar</span>
                  </button>

                  <button
                    onClick={() => setSelectedForPrint(item)}
                    className="h-8 px-3.5 text-xs font-black text-slate-950 bg-[#FDBA30] hover:bg-[#ffc642] rounded-lg transition inline-flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5 stroke-[2.4]" />
                    <span>Detalles</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (Optimized Layout - Zero Truncation, Full Assistants and Courses) */}
          <div className="hidden md:block bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto relative">
              <table className="w-full text-left text-xs min-w-[960px] border-collapse">
                <thead className="bg-slate-50 dark:bg-[#121216] text-slate-600 dark:text-zinc-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/90 dark:border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-3 whitespace-nowrap w-[92px] min-w-[92px]">CÓDIGO</th>
                    <th className="py-3.5 px-3 whitespace-nowrap w-[88px] min-w-[88px]">FECHA</th>
                    <th className="py-3.5 px-3 whitespace-nowrap w-[76px] min-w-[76px]">NRC</th>
                    <th className="py-3.5 px-3 whitespace-nowrap min-w-[160px]">DOCENTE</th>
                    <th className="py-3.5 px-3 whitespace-nowrap min-w-[180px]">CURSO / CARRERA</th>
                    <th className="py-3.5 px-3 whitespace-nowrap min-w-[125px]">MOTIVO</th>
                    <th className="py-3.5 px-3 whitespace-nowrap min-w-[130px]">ASISTENTE</th>
                    <th className="py-3.5 px-3 whitespace-nowrap min-w-[150px]">DOCENTE REEMPLAZANTE</th>
                    <th className="py-3.5 px-3 whitespace-nowrap text-center w-[165px] min-w-[165px] sticky right-0 bg-slate-50 dark:bg-[#121216] z-20 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.12)] dark:shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] border-l border-slate-200/90 dark:border-zinc-800">
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filtered.map(item => (
                    <tr key={item.id} className="group hover:bg-slate-50/80 dark:hover:bg-zinc-900/60 transition-colors">
                      {/* CÓDIGO (Único e Irrepetible) */}
                      <td className="py-3.5 px-3 whitespace-nowrap align-top">
                        <span className="font-mono font-black text-xs bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 px-2.5 py-1 rounded-lg shadow-2xs inline-block tracking-tight">
                          {item.codigo}
                        </span>
                      </td>

                      {/* FECHA */}
                      <td className="py-3.5 px-3 whitespace-nowrap align-top font-mono text-[11px] text-slate-700 dark:text-zinc-300 font-bold">
                        {item.fecha}
                      </td>

                      {/* NRC */}
                      <td className="py-3.5 px-3 whitespace-nowrap align-top">
                        <span className="font-mono font-black text-xs text-slate-900 dark:text-zinc-100 bg-slate-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-slate-200/90 dark:border-zinc-700 inline-block shadow-2xs">
                          {item.nrc}
                        </span>
                      </td>

                      {/* DOCENTE */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="font-extrabold text-xs text-slate-950 dark:text-white leading-snug break-words">
                          {item.docente}
                        </div>
                      </td>

                      {/* CURSO / CARRERA */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug break-words">
                          {item.curso}
                        </div>
                        {item.carrera && (
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-tight mt-0.5 break-words">
                            {item.carrera}
                          </div>
                        )}
                      </td>

                      {/* MOTIVO */}
                      <td className="py-3.5 px-3 align-top">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 break-words leading-tight">
                          {getMotivoBase(item)}
                        </span>
                      </td>

                      {/* ASISTENTE */}
                      <td className="py-3.5 px-3 align-top">
                        <div className="flex items-start gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 flex items-center justify-center shrink-0 font-black text-[10px] mt-0.5">
                            {(item.asistente || 'A').charAt(0)}
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug break-words">
                            {item.asistente || 'Operaciones Sede'}
                          </div>
                        </div>
                      </td>

                      {/* DOCENTE REEMPLAZANTE (Columna I) */}
                      <td className="py-3.5 px-3 align-top">
                        {getSuplente(item) ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/80 text-purple-950 dark:text-purple-200 font-extrabold text-xs">
                            <UserCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0 stroke-[2.4]" />
                            <span className="break-words">{getSuplente(item)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-600 text-xs font-semibold">-</span>
                        )}
                      </td>

                      {/* Acciones (Sticky a la derecha: nunca se corta) */}
                      <td className="py-3 px-3 whitespace-nowrap text-center align-middle w-[165px] min-w-[165px] sticky right-0 bg-white dark:bg-[#0c0c0f] group-hover:bg-slate-50 dark:group-hover:bg-[#15151a] z-10 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.12)] dark:shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.5)] border-l border-slate-200/80 dark:border-zinc-800 transition-colors">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleCopyVoucherText(item)}
                            className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition inline-flex items-center justify-center gap-1 active:scale-95 shrink-0"
                            title="Copiar texto para WhatsApp"
                          >
                            <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                            <span>Copiar</span>
                          </button>
                          <button
                            onClick={() => setSelectedForPrint(item)}
                            className="h-8 px-2.5 text-xs font-black text-slate-950 bg-[#FDBA30] hover:bg-[#ffc642] rounded-lg transition inline-flex items-center justify-center gap-1 active:scale-95 shadow-2xs shrink-0"
                            title="Ver Detalles de la Hoja"
                          >
                            <Eye className="w-3.5 h-3.5 stroke-[2.4]" />
                            <span>Detalles</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal: New Manual Sheet - 100% Symmetrical */}
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
                  <FileCheck2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                    Emitir Hoja de Asistencia
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Búsqueda predictiva por NRC o docente
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
              {/* Fila 1: Código (ÚNICO e IRREPETIBLE) y Fecha */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                      Código de Hoja * <span className="font-black text-amber-600 dark:text-amber-400 text-[10px]">(Único)</span>
                    </label>
                  </div>
                  <div className="relative flex items-center">
                    <div className="h-9 px-3 bg-amber-100/90 dark:bg-amber-950/70 border border-r-0 border-amber-300 dark:border-amber-800/80 rounded-l-xl flex items-center justify-center font-mono font-black text-xs text-amber-950 dark:text-amber-300 select-none shrink-0 shadow-2xs">
                      LN1-
                    </div>
                    <input
                      type="text"
                      required
                      value={extractNumber(formData.codigo)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                        setFormData({
                          ...formData,
                          codigo: raw ? `LN1-${raw}` : ''
                        });
                      }}
                      onBlur={() => {
                        const num = extractNumber(formData.codigo);
                        if (num) {
                          setFormData(prev => ({
                            ...prev,
                            codigo: `LN1-${num.padStart(3, '0')}`
                          }));
                        }
                      }}
                      placeholder="095"
                      maxLength={4}
                      className={`w-full h-9 text-xs px-3 bg-slate-50 dark:bg-zinc-900 border rounded-r-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 font-mono font-black transition ${
                        isDuplicate
                          ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                          : formData.codigo.trim()
                          ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                          : 'border-slate-200 dark:border-zinc-700 focus:border-amber-500 focus:ring-amber-500/20'
                      }`}
                    />
                    {isDuplicate ? (
                      <div className="absolute right-2.5 text-rose-600 dark:text-rose-400 pointer-events-none">
                        <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    ) : formData.codigo.trim() ? (
                      <div className="absolute right-2.5 text-emerald-600 dark:text-emerald-400 pointer-events-none">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : null}
                  </div>
                  {isDuplicate ? (
                    <div className="mt-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/60 leading-tight">
                      ⚠️ Código ya utilizado. Es único e irrepetible.
                    </div>
                  ) : formData.codigo.trim() ? (
                    <div className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60 leading-tight">
                      ✓ Código LN1-{extractNumber(formData.codigo).padStart(3, '0')} disponible (Único)
                    </div>
                  ) : null}
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

              {/* Fila 2: NRC y Carrera */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                      NRC * <span className="font-normal text-slate-400 dark:text-zinc-500">(autocompleta)</span>
                    </label>
                    {nrcLookupLoading && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                        Buscando...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={formData.nrc}
                      onChange={(e) => handleNrcLookup(e.target.value)}
                      onBlur={() => handleNrcLookup(formData.nrc)}
                      placeholder="Ej: 20476"
                      className={`w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 font-mono font-bold transition ${
                        nrcMatchFound
                          ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                          : 'border-slate-200 dark:border-zinc-700 focus:border-amber-500 focus:ring-amber-500/20'
                      }`}
                    />
                    {nrcMatchFound && (
                      <div className="absolute right-2.5 top-2.5 text-emerald-600 dark:text-emerald-400">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  {nrcMatchFound && (
                    <div className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60 truncate">
                      ✓ Autocompletado: {nrcMatchFound.curso}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Carrera</label>
                  <input
                    type="text"
                    value={formData.carrera}
                    onChange={(e) => setFormData({ ...formData, carrera: e.target.value })}
                    placeholder="Ej: Arq. y Diseño de Interiores"
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                  />
                </div>
              </div>

              {/* Fila 3: Docente (Titular) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Docente (Titular) *</label>
                <input
                  type="text"
                  required
                  value={formData.docente}
                  onChange={(e) => setFormData({ ...formData, docente: e.target.value })}
                  placeholder="Apellidos y Nombres"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              {/* Fila 4: Curso */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Curso *</label>
                <input
                  type="text"
                  required
                  value={formData.curso}
                  onChange={(e) => setFormData({ ...formData, curso: e.target.value })}
                  placeholder="Nombre de la asignatura"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              {/* Fila 5: Motivo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Motivo *</label>
                <CustomSelect
                  value={formData.motivo}
                  onChange={(val) => setFormData({ ...formData, motivo: val })}
                  options={motivos}
                  placeholder="Seleccionar motivo"
                />
              </div>

              {/* Fila 6: Si es DOCENTE DE REEMPLAZO, campo obligatorio para el docente que dictará */}
              {formData.motivo === 'DOCENTE DE REEMPLAZO' && (
                <div className="p-3 bg-purple-50/90 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800/80 rounded-2xl space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-300">
                    <UserCheck className="w-4 h-4 stroke-[2.4]" />
                    <label className="text-xs font-black uppercase tracking-tight">Docente Reemplazante (Suplente) *</label>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.docenteReemplazo}
                    onChange={(e) => setFormData({ ...formData, docenteReemplazo: e.target.value.toUpperCase() })}
                    placeholder="Apellidos y Nombres del docente que dictará la clase"
                    className="w-full text-xs px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <p className="text-[10px] text-purple-800 dark:text-purple-400 font-medium">
                    Se registrará en la Columna I "DOCENTE REEMPLAZANTE" del Excel de OneDrive.
                  </p>
                </div>
              )}

              {/* Fila 7: Asistente Emisor */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Asistente Emisor *</label>
                <CustomSelect
                  value={formData.asistente}
                  onChange={(val) => setFormData({ ...formData, asistente: val })}
                  options={asistentes}
                  placeholder="Seleccionar asistente"
                />
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
                  disabled={isDuplicate || !formData.codigo.trim()}
                  className={`h-11 sm:h-12 rounded-2xl text-xs font-black transition flex items-center justify-center text-center shadow-xs ${
                    isDuplicate || !formData.codigo.trim()
                      ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                      : 'bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 active:scale-95'
                  }`}
                >
                  Generar y Registrar
                </button>
              </div></form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Detalles Completos de la Hoja de Asistencia Manual */}
      {selectedForPrint && typeof document !== 'undefined' && (() => {
        const isReemplazo = isReemplazoSheet(selectedForPrint);
        const suplenteName = getSuplente(selectedForPrint);

        return createPortal(
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
            onClick={() => setSelectedForPrint(null)}
          >
            <div
              className="bg-white dark:bg-[#0c0c10] border border-slate-200/90 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-slate-900 dark:text-zinc-100 animate-scale-up space-y-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del Modal - Simétrico y Adaptable en todos los formatos */}
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-3 min-w-0 pr-1">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70 flex items-center justify-center shadow-xs shrink-0">
                    <FileCheck2 className="w-5 h-5 stroke-[2.3]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                        Detalles de la Hoja
                      </h3>
                      <span className="font-mono font-black text-xs bg-[#FDBA30] text-slate-950 px-2.5 py-0.5 rounded-lg shadow-2xs whitespace-nowrap shrink-0">
                        {selectedForPrint.codigo}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                      Hoja de Asistencia Manual · UPN Sede Comas
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedForPrint(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0 print:hidden"
                  title="Cerrar ventana"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Motivo de Emisión destacado */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    Motivo de Contingencia
                  </span>
                  <span className="text-[10px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 px-2 py-0.5 rounded-md">
                    Operaciones Sede
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-100 leading-snug">
                  {getMotivoBase(selectedForPrint)}
                </div>
              </div>

              {/* Grilla de Datos Académicos */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-0.5">NRC</span>
                  <span className="font-mono font-black text-sm text-slate-950 dark:text-white">{selectedForPrint.nrc}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-0.5">Fecha</span>
                  <span className="font-mono font-bold text-xs text-slate-800 dark:text-zinc-200">{selectedForPrint.fecha}</span>
                </div>

                <div className="col-span-2 p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-2xl border border-slate-100 dark:border-zinc-800/80 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Docente Titular</span>
                  <div className="font-black text-xs sm:text-sm text-slate-950 dark:text-white break-words">
                    {selectedForPrint.docente}
                  </div>
                </div>

                {isReemplazo && (
                  <div className="col-span-2 p-3 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/70 space-y-0.5">
                    <span className="text-[10px] uppercase font-black text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 stroke-[2.4]" />
                      Docente Reemplazante (dicta la clase)
                    </span>
                    <div className={`text-xs sm:text-sm break-words ${suplenteName ? 'font-black text-purple-950 dark:text-purple-100' : 'font-semibold italic text-slate-400 dark:text-zinc-500'}`}>
                      {suplenteName || 'No registrado en esta hoja'}
                    </div>
                  </div>
                )}

                <div className="col-span-2 p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-2xl border border-slate-100 dark:border-zinc-800/80 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Curso</span>
                  <div className="font-bold text-xs text-slate-900 dark:text-white break-words">
                    {selectedForPrint.curso}
                  </div>
                  {selectedForPrint.carrera && (
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                      Carrera: {selectedForPrint.carrera}
                    </div>
                  )}
                </div>

                {selectedForPrint.aula && (
                  <div className="p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-0.5">Aula</span>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{selectedForPrint.aula}</span>
                  </div>
                )}

                <div className={`${selectedForPrint.aula ? '' : 'col-span-2'} p-3 bg-slate-50 dark:bg-zinc-900/70 rounded-2xl border border-slate-100 dark:border-zinc-800/80`}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-0.5">Asistente Emisor</span>
                  <span className="font-bold text-xs text-slate-900 dark:text-white break-words leading-tight block">
                    {selectedForPrint.asistente || 'Operaciones Sede'}
                  </span>
                </div>
              </div>

              {/* Footer con Acciones */}
              <div className="pt-3.5 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedForPrint(null)}
                  className="w-full sm:w-auto h-10 px-4 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition flex items-center justify-center active:scale-95 order-2 sm:order-1"
                >
                  Cerrar
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
                  <button
                    type="button"
                    onClick={() => handleCopyVoucherText(selectedForPrint)}
                    className="flex-1 sm:flex-none h-10 px-3.5 text-xs font-bold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-xl transition inline-flex items-center justify-center gap-1.5 active:scale-95 border border-slate-200/80 dark:border-zinc-700"
                    title="Copiar texto resumen"
                  >
                    {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.2]" />}
                    <span>{copiedSuccess ? '¡Copiado!' : 'Copiar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-none h-10 px-4 text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95"
                    title="Imprimir boleta física"
                  >
                    <Printer className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
