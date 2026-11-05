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
  BookOpen,
  X,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import UpnLogo from './UpnLogo';
import ToastBanner from './ToastBanner';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';

export default function ManualSheetsView({ initialClassData, onClearInitialClass }) {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMotivo, setFilterMotivo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
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
    asistente: 'José Carlos Miranda Rosales'
  });

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
      setFormData(prev => ({
        ...prev,
        nrc: initialClassData.nrc || '',
        docente: initialClassData.docente || '',
        curso: initialClassData.curso || '',
        carrera: initialClassData.carrera || ''
      }));
      setIsModalOpen(true);
      if (onClearInitialClass) onClearInitialClass();
    }
  }, [initialClassData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/manual-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (json.success) {
        setSheets(prev => [json.data, ...prev]);
        setSelectedForPrint(json.data);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
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
    const text = `📋 *HOJA DE ASISTENCIA MANUAL - UPN COMAS*\nN° Boleta: ${item.codigo}\nFecha: ${item.fecha}\nNRC: ${item.nrc}\nDocente: ${item.docente}\nCurso: ${item.curso}\nMotivo: ${item.motivo}\nAsistente Emisor: ${item.asistente}`;
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
      if (filterMotivo && s.motivo !== filterMotivo) return false;
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
      {copiedSuccess && (
        <ToastBanner
          message="¡Texto de boleta copiado al portapapeles!"
          type="info"
          onClose={() => setCopiedSuccess(false)}
        />
      )}

      {/* Top Controller Panel - Clean & Orderly */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/90 dark:border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Contingencia Académica · Operaciones Sede
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white tracking-tight">
              Hojas de Asistencia Manual
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded-xl text-xs font-bold font-mono">
              {validSheets.length} Emitidas
            </span>

            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="h-10 px-4 rounded-xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>+ Emitir Nueva Hoja</span>
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
              className={`h-7 px-3 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${
                !filterMotivo 
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
                className={`h-7 px-2.5 rounded-lg font-bold transition whitespace-nowrap active:scale-95 ${
                  filterMotivo === m
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
                  <span className="font-mono text-xs font-black text-slate-900 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-slate-200/80 dark:border-zinc-800 whitespace-nowrap">
                    NRC {item.nrc}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-slate-950 dark:text-white mb-1 break-words">
                    {item.docente}
                  </h3>
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
                      {item.motivo}
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
                    <Printer className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Boleta Digital</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (Optimized Layout - Zero Truncation, Full Assistants and Courses) */}
          <div className="hidden md:block bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[860px]">
                <thead className="bg-slate-50 dark:bg-[#121216] text-slate-600 dark:text-zinc-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-200/90 dark:border-zinc-800">
                  <tr>
                    <th className="py-3.5 px-4 whitespace-nowrap min-w-[120px]">Hoja / Fecha</th>
                    <th className="py-3.5 px-4 min-w-[240px]">NRC · Curso / Carrera</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Docente</th>
                    <th className="py-3.5 px-4 min-w-[160px]">Motivo</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Asistente Emisor</th>
                    <th className="py-3.5 px-4 whitespace-nowrap text-right min-w-[150px]">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filtered.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-900/60 transition-colors">
                      {/* Hoja y Fecha */}
                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        <span className="font-mono font-black text-xs bg-amber-100/90 dark:bg-amber-950/70 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 px-2.5 py-1 rounded-lg shadow-2xs inline-block tracking-tight">
                          {item.codigo}
                        </span>
                        <div className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 font-semibold mt-1.5">
                          {item.fecha}
                        </div>
                      </td>

                      {/* NRC, Curso y Carrera: 100% visible, no truncations! */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono font-black text-[10px] text-slate-900 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-zinc-800 inline-block">
                            NRC {item.nrc}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug break-words">
                          {item.curso}
                        </div>
                        {item.carrera && (
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium leading-tight mt-0.5 break-words">
                            {item.carrera}
                          </div>
                        )}
                      </td>

                      {/* Docente: 100% visible */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-extrabold text-slate-950 dark:text-white text-xs leading-snug break-words">
                          {item.docente}
                        </div>
                      </td>

                      {/* Motivo: 100% visible */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 break-words leading-tight">
                          {item.motivo}
                        </span>
                      </td>

                      {/* Asistente Emisor: 100% visible, NEVER cut off! */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-start gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 flex items-center justify-center shrink-0 font-black text-[10px] mt-0.5">
                            {(item.asistente || 'A').charAt(0)}
                          </div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs leading-snug break-words">
                            {item.asistente || 'Operaciones Sede'}
                          </div>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right align-top space-x-1.5">
                        <button
                          onClick={() => handleCopyVoucherText(item)}
                          className="h-8 px-2.5 text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition inline-flex items-center justify-center gap-1 active:scale-95"
                          title="Copiar texto para WhatsApp"
                        >
                          <Copy className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Copiar</span>
                        </button>
                        <button
                          onClick={() => setSelectedForPrint(item)}
                          className="h-8 px-3 text-xs font-black text-slate-950 bg-[#FDBA30] hover:bg-[#ffc642] rounded-lg transition inline-flex items-center justify-center gap-1 active:scale-95 shadow-2xs"
                          title="Ver Boleta Digital"
                        >
                          <Printer className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Boleta</span>
                        </button>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                      NRC * <span className="font-normal text-slate-400 dark:text-zinc-500">(autocompleta)</span>
                    </label>
                    {nrcLookupLoading && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                        Buscando clase...
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
                      placeholder="Ej: 23017"
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
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Fecha *</label>
                  <CustomDatePicker
                    value={formData.fecha}
                    onChange={(val) => setFormData({ ...formData, fecha: val })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Docente *</label>
                <input
                  type="text"
                  required
                  value={formData.docente}
                  onChange={(e) => setFormData({ ...formData, docente: e.target.value })}
                  placeholder="Apellidos y Nombres"
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Curso *</label>
                  <input
                    type="text"
                    required
                    value={formData.curso}
                    onChange={(e) => setFormData({ ...formData, curso: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Carrera</label>
                  <input
                    type="text"
                    value={formData.carrera}
                    onChange={(e) => setFormData({ ...formData, carrera: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">Motivo *</label>
                <CustomSelect
                  value={formData.motivo}
                  onChange={(val) => setFormData({ ...formData, motivo: val })}
                  options={motivos}
                  placeholder="Seleccionar motivo"
                />
              </div>

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
                  className="h-11 sm:h-12 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition flex items-center justify-center text-center active:scale-95"
                >
                  Generar y Registrar
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Printable Digital Card Modal (Apple Liquid Modal with React Portal) */}
      {selectedForPrint && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
          onClick={() => setSelectedForPrint(null)}
        >
          <div 
            className="apple-liquid-modal dark:bg-[#0c0c10] dark:border-zinc-800 rounded-[28px] max-w-sm w-full p-6 shadow-2xl text-slate-900 dark:text-zinc-100 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center pb-3.5 border-b border-dashed border-slate-200 dark:border-zinc-800">
              <UpnLogo variant="horizontal" className="justify-center mb-1" />
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mt-1">OPERACIONES ACADÉMICAS</div>
              <div className="mt-2 inline-block bg-[#FDBA30]/15 border border-[#FDBA30]/40 text-slate-950 dark:text-amber-300 font-mono font-black text-sm px-3.5 py-1 rounded-xl shadow-2xs">
                N° {selectedForPrint.codigo}
              </div>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-zinc-400">Fecha:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200">{selectedForPrint.fecha}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-zinc-400">NRC:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded-md">{selectedForPrint.nrc}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-bold">Docente:</span>
                <span className="font-bold text-slate-900 dark:text-white block break-words">{selectedForPrint.docente}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-bold">Curso:</span>
                <span className="font-medium text-slate-700 dark:text-zinc-300 block break-words">{selectedForPrint.curso}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-bold">Motivo:</span>
                <span className="font-semibold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/80 px-2.5 py-1 rounded-lg inline-block mt-1 text-[11px] break-words">
                  {selectedForPrint.motivo}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-start text-xs text-slate-400 gap-2">
                <span className="shrink-0 text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500">Asistente:</span>
                <span className="font-bold text-slate-900 dark:text-white text-right break-words">{selectedForPrint.asistente || 'Operaciones Sede'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-dashed border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedForPrint(null)}
                className="text-xs font-semibold px-3.5 py-2 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition inline-flex items-center justify-center"
              >
                Cerrar
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopyVoucherText(selectedForPrint)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-xl transition active:scale-95"
                  title="Copiar texto para WhatsApp"
                >
                  {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.2]" />}
                  <span>{copiedSuccess ? '¡Copiado!' : 'Copiar'}</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs transition active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
