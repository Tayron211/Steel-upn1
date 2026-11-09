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
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Infraestructura de Sede</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Directorio de Ambientes & Aforos</h1>
          </div>

          <div className="flex items-center gap-1 self-end sm:self-auto ml-auto sm:ml-0 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 shrink-0">
            <button
              onClick={() => setFilterPabellon('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center justify-center active:scale-95 ${
                !filterPabellon ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos ({rooms.length})
            </button>
            <button
              onClick={() => setFilterPabellon('A')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center justify-center active:scale-95 ${
                filterPabellon === 'A' ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Pabellón A
            </button>
            <button
              onClick={() => setFilterPabellon('B')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition inline-flex items-center justify-center active:scale-95 ${
                filterPabellon === 'B' ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
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
            className="w-full pl-10 pr-8 py-2 text-xs bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-[#16161b] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5"
            >
              <X className="w-3.5 h-3.5 stroke-[2.2]" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Room Cards */}
      {loading ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Cargando directorio de espacios...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs px-4">
          <Building2 className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2 stroke-[1.8]" />
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No se encontraron aulas</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Prueba con otro código o filtro de pabellón.</p>
        </div>
      ) : (
        <div key={`rooms-${filterPabellon}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4 animate-fade-in">
          {filtered.map(room => (
            <div
              key={room.abrv}
              className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <span className="text-base font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-0.5 rounded-xl font-mono tracking-tight">
                    {room.abrv}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 uppercase bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded-lg">
                    Pab. {room.pabellon} · {room.piso || 'Sede'}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1 break-words leading-snug" title={room.nombre}>
                  {room.nombre}
                </h3>

                <span className="inline-block text-[10px] font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/80 px-2 py-0.5 rounded-md mb-3">
                  {room.tipo}
                </span>

                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-[#121216] p-2.5 rounded-xl border border-slate-200/70 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-300">
                    <Users className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 stroke-[2.2]" />
                    <span>Aforo: <strong className="text-slate-900 dark:text-white font-bold">{room.aforo} personas</strong></span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 font-mono">
                    Pab. {room.pabellon}
                  </span>
                </div>
              </div>

              {onSelectRoomForSchedule && (
                <button
                  onClick={() => onSelectRoomForSchedule(room.abrv)}
                  className="mt-3 w-full text-center text-xs font-bold text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 py-2 rounded-xl border border-amber-200 dark:border-amber-800/60 transition inline-flex items-center justify-center gap-1.5 active:scale-95"
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
