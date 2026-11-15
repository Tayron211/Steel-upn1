import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  MapPin, 
  UserPlus, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Lock, 
  User, 
  Building2, 
  Layers, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { 
  getAllUsers, 
  saveUser, 
  deleteUser, 
  saveUserAssignment, 
  syncUsersWithServer 
} from '../utils/auth';

const AVAILABLE_PABELLONES = ['A', 'B', 'C', 'D'];

const AVAILABLE_PISOS = [
  { val: 'SOTANO', label: 'Sótano', short: 'Sót' },
  { val: '1ER PISO', label: '1er Piso', short: '1°' },
  { val: '2DO PISO', label: '2do Piso', short: '2°' },
  { val: '3ER PISO', label: '3er Piso', short: '3°' },
  { val: '4TO PISO', label: '4to Piso', short: '4°' },
  { val: '5TO PISO', label: '5to Piso', short: '5°' },
  { val: '6TO PISO', label: '6to Piso', short: '6°' },
  { val: '7MO PISO', label: '7mo Piso', short: '7°' },
  { val: '8VO PISO', label: '8vo Piso', short: '8°' }
];

export default function AdminControlModal({ isOpen, onClose, authUser }) {
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'users'
  const [users, setUsers] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedUserMsg, setSavedUserMsg] = useState({}); // { [username]: 'Guardado' }

  // Form para crear usuario
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('1234');
  const [newRole, setNewRole] = useState('asistente');
  const [newPabellon, setNewPabellon] = useState('');
  const [newPisos, setNewPisos] = useState([]);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Usuario a eliminar
  const [userToDelete, setUserToDelete] = useState(null);

  // Cargar usuarios
  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await syncUsersWithServer();
      setUsers(list || getAllUsers());
    } catch (_) {
      setUsers(getAllUsers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setCreateError('');
      setCreateSuccess('');
      setUserToDelete(null);
    }
  }, [isOpen]);

  // Autogenerar username al escribir nombre
  const handleNameChange = (val) => {
    setNewName(val);
    const parts = val.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const initial = parts[0][0].toLowerCase();
      const lastName = parts[parts.length - 1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      setNewUsername(`${initial}${lastName}`);
    } else if (parts.length === 1) {
      setNewUsername(parts[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    }
  };

  // Guardar asignación individual
  const handleSaveAssignment = async (u, pabellon, pisos) => {
    try {
      await saveUserAssignment(u.username, pabellon, pisos);
      setSavedUserMsg(prev => ({ ...prev, [u.username]: '¡Guardado!' }));
      setTimeout(() => {
        setSavedUserMsg(prev => {
          const c = { ...prev };
          delete c[u.username];
          return c;
        });
      }, 2500);

      // Actualizar estado local
      setUsers(prev => prev.map(item => {
        if (item.username.toLowerCase() === u.username.toLowerCase()) {
          return { ...item, pabellon, pisos };
        }
        return item;
      }));
    } catch (err) {
      alert('Error al guardar asignación: ' + err.message);
    }
  };

  // Crear usuario
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    if (!newName.trim() || !newUsername.trim()) {
      setCreateError('El nombre completo y nombre de usuario son obligatorios');
      return;
    }

    try {
      await saveUser({
        username: newUsername.trim().toLowerCase(),
        name: newName.trim().toUpperCase(),
        role: newRole,
        password: newPassword.trim() || '1234',
        pabellon: newPabellon,
        pisos: newPisos
      });

      setCreateSuccess(`Usuario ${newName.toUpperCase()} creado y sincronizado con éxito`);
      setNewName('');
      setNewUsername('');
      setNewPassword('1234');
      setNewRole('asistente');
      setNewPabellon('');
      setNewPisos([]);
      await loadUsers();
    } catch (err) {
      setCreateError(err.message || 'Error al crear usuario');
    }
  };

  // Eliminar usuario
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.username);
      setUserToDelete(null);
      await loadUsers();
    } catch (err) {
      alert(err.message || 'Error al eliminar usuario');
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => {
    if (!searchFilter.trim()) return true;
    const s = searchFilter.toLowerCase();
    return (
      u.name.toLowerCase().includes(s) ||
      u.username.toLowerCase().includes(s) ||
      (u.role && u.role.toLowerCase().includes(s))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0e0e12] border border-amber-500/30 shadow-2xl shadow-amber-500/10 text-white overflow-hidden">
        
        {/* Cabecera del Panel */}
        <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
                  Panel de Control Administrativo
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {authUser?.name || 'Administrador'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Asignación de pabellones y pisos prioritarios • Gestión de usuarios y credenciales
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Barra de Pestañas */}
        <div className="px-5 pt-3 pb-2 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'assignments'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>Asignación de Pisos y Pabellones</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'assignments' ? 'bg-black/20 text-slate-950 font-black' : 'bg-zinc-700 text-zinc-300'}`}>
                {users.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Users className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>Crear & Eliminar Usuarios</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-800/70 hover:bg-zinc-800 text-zinc-400 hover:text-white transition disabled:opacity-50 text-xs flex items-center gap-1 cursor-pointer"
            title="Refrescar usuarios desde la nube"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline text-[11px] font-semibold">Sincronizar</span>
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* ======================================================== */}
          {/* TAB 1: ASIGNACIÓN DE PISOS Y PABELLONES                 */}
          {/* ======================================================== */}
          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {/* Mensaje Informativo */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[2.2]" />
                <div>
                  <span className="font-bold text-amber-300">Prioridad por Asignación: </span>
                  Los pisos y pabellón seleccionados para cada asistente se cargarán automáticamente por defecto cuando abran su aplicación en su celular o PC. Cada asistente podrá navegar libremente por cualquier otro piso si lo necesita.
                </div>
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar asistente por nombre o usuario..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              {/* Lista de Usuarios y Asignaciones */}
              <div className="grid grid-cols-1 gap-3.5">
                {filteredUsers.map((u) => {
                  const isCurrentLogged = authUser?.username?.toLowerCase() === u.username.toLowerCase();
                  const saved = savedUserMsg[u.username];

                  return (
                    <UserAssignmentCard
                      key={u.username}
                      user={u}
                      isCurrentLogged={isCurrentLogged}
                      savedMsg={saved}
                      onSave={(pab, pisos) => handleSaveAssignment(u, pab, pisos)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: GESTIÓN DE USUARIOS (CREAR & ELIMINAR)            */}
          {/* ======================================================== */}
          {activeTab === 'users' && (
            <div className="space-y-6">

              {/* Formulario Crear Usuario */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <UserPlus className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase">Crear Nuevo Usuario</h3>
                    <p className="text-[11px] text-zinc-400">El nuevo usuario se guardará en la base de datos y se sincronizará con Excel</p>
                  </div>
                </div>

                {createError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{createError}</span>
                  </div>
                )}

                {createSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400 stroke-[2.5]" />
                    <span>{createSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Nombre Completo */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: CARLOS MEDINA"
                        value={newName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white uppercase placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    {/* Nombre de Usuario */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Usuario (Login)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: cmedina"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                        className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-400 font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Rol */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Rol en el Sistema
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="asistente">Asistente (Operaciones Campus)</option>
                        <option value="admin">Administrador (Control Total)</option>
                      </select>
                    </div>

                    {/* Contraseña inicial */}
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Contraseña / PIN Inicial
                      </label>
                      <input
                        type="text"
                        placeholder="1234"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Asignación Inicial */}
                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Asignación Inicial de Pabellón y Pisos
                    </div>
                    
                    {/* Pabellón */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase w-16">Pabellón:</span>
                      <button
                        type="button"
                        onClick={() => setNewPabellon('')}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition ${
                          newPabellon === '' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Todos
                      </button>
                      {AVAILABLE_PABELLONES.map(pab => (
                        <button
                          key={pab}
                          type="button"
                          onClick={() => setNewPabellon(pab)}
                          className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition ${
                            newPabellon === pab ? 'bg-amber-500 text-slate-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          Pab. {pab}
                        </button>
                      ))}
                    </div>

                    {/* Pisos */}
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase w-16">Pisos:</span>
                      {AVAILABLE_PISOS.map(p => {
                        const isSelected = newPisos.includes(p.val);
                        return (
                          <button
                            key={p.val}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setNewPisos(prev => prev.filter(x => x !== p.val));
                              } else {
                                setNewPisos(prev => [...prev, p.val]);
                              }
                            }}
                            className={`h-6.5 px-2 rounded-lg text-[10px] font-bold transition ${
                              isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {p.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                    >
                      <UserPlus className="w-4 h-4 stroke-[2.2]" />
                      <span>Crear y Sincronizar Usuario</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista de Usuarios Registrados con Opción de Eliminar */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Usuarios Activos en el Sistema ({users.length})</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Los administradores raíz están protegidos</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {users.map(u => {
                    const isProtected = ['tsalinas', 'apascual', 'admin'].includes(u.username.toLowerCase());
                    const isCurrent = authUser?.username?.toLowerCase() === u.username.toLowerCase();

                    return (
                      <div
                        key={u.username}
                        className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {u.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-300 text-[9px] font-black uppercase">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
                              <span>@{u.username}</span>
                              <span>•</span>
                              <span className={u.role === 'admin' ? 'text-amber-400 font-bold' : 'text-zinc-400'}>
                                {u.role === 'admin' ? 'ADMIN' : 'ASISTENTE'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botón Eliminar o Badge Protegido */}
                        {isProtected ? (
                          <span className="px-2 py-0.5 rounded-lg bg-zinc-800/80 text-[10px] font-bold text-zinc-500 border border-zinc-700/50 shrink-0">
                            Protegido
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="p-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition active:scale-95 shrink-0 cursor-pointer"
                            title={`Eliminar usuario ${u.name}`}
                          >
                            <Trash2 className="w-4 h-4 stroke-[2.2]" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal de Confirmación para Eliminar */}
        {userToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md p-5 rounded-2xl bg-zinc-900 border border-rose-500/40 shadow-2xl text-white space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase">¿Eliminar Usuario?</h4>
                  <p className="text-xs text-zinc-400">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                <div><span className="text-zinc-500">Nombre: </span><span className="font-bold text-white">{userToDelete.name}</span></div>
                <div><span className="text-zinc-500">Usuario: </span><span className="font-mono text-amber-400">@{userToDelete.username}</span></div>
                <div><span className="text-zinc-500">Rol: </span><span className="uppercase font-bold">{userToDelete.role}</span></div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/30"
                >
                  <Trash2 className="w-4 h-4 stroke-[2.2]" />
                  <span>Sí, Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Subcomponente individual para asignación de cada usuario
function UserAssignmentCard({ user, isCurrentLogged, savedMsg, onSave }) {
  const [selectedPab, setSelectedPab] = useState(user.pabellon || '');
  const [selectedPisos, setSelectedPisos] = useState(Array.isArray(user.pisos) ? user.pisos : []);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setSelectedPab(user.pabellon || '');
    setSelectedPisos(Array.isArray(user.pisos) ? user.pisos : []);
    setIsDirty(false);
  }, [user.pabellon, user.pisos]);

  const handleTogglePiso = (pisoVal) => {
    setIsDirty(true);
    setSelectedPisos(prev => {
      if (prev.includes(pisoVal)) {
        return prev.filter(p => p !== pisoVal);
      }
      return [...prev, pisoVal];
    });
  };

  const handleSelectPab = (pab) => {
    setIsDirty(true);
    setSelectedPab(pab);
  };

  const handleSave = () => {
    onSave(selectedPab, selectedPisos);
    setIsDirty(false);
  };

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isDirty 
        ? 'bg-zinc-900/90 border-amber-500/60 shadow-md shadow-amber-500/5' 
        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
    }`}>
      {/* Cabecera del Usuario */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
            user.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800 text-zinc-300'
          }`}>
            {user.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-white truncate uppercase">
                {user.name}
              </span>
              {isCurrentLogged && (
                <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-300 text-[9px] font-black uppercase">
                  Tú
                </span>
              )}
              <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${
                user.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {user.role === 'admin' ? 'ADMIN' : 'ASISTENTE'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-500">
              @{user.username}
            </div>
          </div>
        </div>

        {/* Botón Guardar Asignación */}
        <div className="shrink-0 flex items-center gap-2">
          {savedMsg && (
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              {savedMsg}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
            className={`h-8 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              isDirty
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'bg-zinc-800 text-zinc-500 opacity-60 cursor-not-allowed'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {/* Selectores de Pabellón y Pisos */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-zinc-800/60">
        
        {/* Pabellón Prioritario */}
        <div className="md:col-span-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Pabellón Prioritario</span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectPab('')}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedPab === '' 
                  ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' 
                  : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              Todos
            </button>
            {AVAILABLE_PABELLONES.map(pab => (
              <button
                key={pab}
                type="button"
                onClick={() => handleSelectPab(pab)}
                className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedPab === pab 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' 
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Pab. {pab}
              </button>
            ))}
          </div>
        </div>

        {/* Pisos Prioritarios (Multi-select) */}
        <div className="md:col-span-8 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Pisos Asignados</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-normal">
              {selectedPisos.length === 0 ? 'Sin restricción (todos)' : `${selectedPisos.length} seleccionado(s)`}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setIsDirty(true);
                setSelectedPisos([]);
              }}
              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                selectedPisos.length === 0 
                  ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' 
                  : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              Todos los pisos
            </button>
            {AVAILABLE_PISOS.map(p => {
              const isSelected = selectedPisos.includes(p.val);
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => handleTogglePiso(p.val)}
                  className={`h-7 px-2 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    isSelected 
                      ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' 
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                  title={p.label}
                >
                  {p.short}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
