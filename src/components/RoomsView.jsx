import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Users, 
  Monitor, 
  Layers,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';

export default function RoomsView({ onSelectRoomForSchedule }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPabellon, setFilterPabellon] = useState('');

  const loadRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms');
      const json = await res.json();
      if (json.success) {
        setRooms(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  const filtered = rooms.filter(r => {
    if (filterPabellon && r.pabellon !== filterPabellon) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.abrv && r.abrv.toLowerCase().includes(q)) ||
        (r.nombre && r.nombre.toLowerCase().includes(q)) ||
        (r.tipo && r.tipo.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Top Banner - Light Minimalist */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Infraestructura de Sede</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">Directorio de Ambientes & Aforos</h1>
          </div>

          <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setFilterPabellon('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center justify-center ${
                !filterPabellon ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({rooms.length})
            </button>
            <button
              onClick={() => setFilterPabellon('A')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center justify-center ${
                filterPabellon === 'A' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pabellón A
            </button>
            <button
              onClick={() => setFilterPabellon('B')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center justify-center ${
                filterPabellon === 'B' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pabellón B
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 stroke-[2.2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código (AS01, A201, B102) o denominación..."
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

      {/* Grid of Room Cards */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
          <p className="text-xs font-semibold text-slate-500">Cargando directorio de espacios...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.8]" />
          <p className="text-sm font-bold text-slate-700">No se encontraron aulas</p>
          <p className="text-xs text-slate-400 mt-0.5">Prueba con otro código o filtro de pabellón.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(room => (
            <div
              key={room.abrv}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <span className="text-base font-black text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-xl font-mono tracking-tight">
                    {room.abrv}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                    Pab. {room.pabellon} · {room.piso || 'Sede'}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 mb-1 break-words leading-snug" title={room.nombre}>
                  {room.nombre}
                </h3>

                <span className="inline-block text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mb-3">
                  {room.tipo}
                </span>

                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Users className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
                    <span>Aforo: <strong className="text-slate-900 font-bold">{room.aforo} personas</strong></span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    Pab. {room.pabellon}
                  </span>
                </div>
              </div>

              {onSelectRoomForSchedule && (
                <button
                  onClick={() => onSelectRoomForSchedule(room.abrv)}
                  className="mt-3 w-full text-center text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 py-2 rounded-xl border border-amber-200 transition inline-flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>Ver Sesiones Hoy</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
