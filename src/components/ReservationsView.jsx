import React, { useState, useEffect } from 'react';
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
  Flame,
  X
} from 'lucide-react';

export default function ReservationsView() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDia, setSelectedDia] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    mes: 'NOVIEMBRE',
    dia: 'LUNES',
    inicio: '14:30',
    final: '16:00',
    aula: 'A201',
    ubicacion: '2DO PISO - A',
    docente: '',
    detalle: '',
    usuario: 'Operaciones',
    prioridad: 'NORMAL'
  });

  const loadReservas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reservations');
      const json = await res.json();
      if (json.success) {
        setReservas(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservas();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (json.success) {
        setReservas(prev => [json.data, ...prev]);
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      mes: 'NOVIEMBRE',
      dia: 'LUNES',
      inicio: '14:30',
      final: '16:00',
      aula: 'A201',
      ubicacion: '2DO PISO - A',
      docente: '',
      detalle: '',
      usuario: 'Operaciones',
      prioridad: 'NORMAL'
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;
    setReservas(prev => prev.filter(r => r.id !== id));
    await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
  };

  const filtered = reservas.filter(r => {
    if (selectedDia && r.dia !== selectedDia) return false;
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

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Top Banner - Light Minimalist */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Espacios & Talleres</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Reservas de Ambientes</h1>
          </div>

          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="h-9 px-3.5 rounded-xl text-xs font-bold bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nueva Reserva</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[2.2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por aula (A201), docente solicitante o detalle..."
            className="w-full pl-10 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Reservation Cards */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
          <p className="text-xs font-semibold text-slate-500">Cargando reservas programadas...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.8]" />
          <p className="text-sm font-bold text-slate-700">No se encontraron reservas</p>
          <p className="text-xs text-slate-400 mt-0.5">No hay reservas registradas para los filtros aplicados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(r => {
            const isImportante = r.prioridad === 'IMPORTANTE';
            return (
              <div
                key={r.id}
                className={`rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between ${
                  isImportante 
                    ? 'bg-amber-50/40 border-amber-200' 
                    : 'bg-white border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-xl font-mono tracking-tight">
                        {r.aula}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {r.ubicacion || 'UPN Comas'}
                      </span>
                    </div>

                    <span className={`inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isImportante 
                        ? 'bg-amber-100 text-amber-900 border-amber-300' 
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {isImportante && <Flame className="w-3 h-3 text-amber-600 stroke-[2.2]" />}
                      <span>{r.prioridad || 'NORMAL'}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/70 mb-3">
                    <span className="text-slate-600 font-semibold">
                      {r.dia} · {r.fecha}
                    </span>
                    <span className="text-slate-900 font-bold inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600 stroke-[2.2]" />
                      <span>{r.inicio} - {r.final}</span>
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="text-xs font-bold text-slate-900 inline-flex items-center gap-1.5 w-full">
                      <User className="w-3.5 h-3.5 text-slate-400 stroke-[2.2] shrink-0" />
                      <span className="truncate">{r.docente || 'Solicitante no especificado'}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 pl-5 font-medium leading-relaxed" title={r.detalle}>
                      {r.detalle || 'Sin detalle de actividad.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Por: <strong className="text-slate-700 font-semibold">{r.usuario}</strong></span>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition inline-flex items-center justify-center"
                    title="Cancelar Reserva"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Reservation - 100% Symmetrical */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 max-h-[90vh] overflow-y-auto animate-spring-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shadow-xs shrink-0">
                  <Calendar className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-950 tracking-tight leading-tight truncate">
                    Nueva Reserva de Ambiente
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    Préstamo de aula o laboratorio con horario definido
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

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Aula *</label>
                  <input
                    type="text"
                    required
                    value={formData.aula}
                    onChange={(e) => setFormData({ ...formData, aula: e.target.value.toUpperCase() })}
                    placeholder="Ej: A201"
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition uppercase font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Hora Inicio *</label>
                  <input
                    type="time"
                    required
                    value={formData.inicio}
                    onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Hora Final *</label>
                  <input
                    type="time"
                    required
                    value={formData.final}
                    onChange={(e) => setFormData({ ...formData, final: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Docente / Solicitante *</label>
                <input
                  type="text"
                  required
                  value={formData.docente}
                  onChange={(e) => setFormData({ ...formData, docente: e.target.value })}
                  placeholder="Apellidos y Nombres"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Detalle / Motivo *</label>
                <textarea
                  rows="2.5"
                  required
                  value={formData.detalle}
                  onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                  placeholder="Ej: Uso de laboratorio para taller práctico de arquitectura..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Prioridad</label>
                  <select
                    value={formData.prioridad}
                    onChange={(e) => setFormData({ ...formData, prioridad: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="IMPORTANTE">Importante / Evento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Registrado por</label>
                  <input
                    type="text"
                    value={formData.usuario}
                    onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 sm:h-12 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/90 transition flex items-center justify-center text-center active:scale-95"
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
    </div>
  );
}
