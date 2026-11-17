import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import {
  getAllUsers,
  saveUser,
  deleteUser,
  saveUserAssignment,
  syncUsersWithServer
} from '../utils/auth';
import { useFadeModal } from '../utils/useFadeModal';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';

// Solo los pabellones y pisos reales registrados en CONTROL_DOCENTE.xlsx (Sede Comas)
const AVAILABLE_PABELLONES = ['A', 'B'];

const AVAILABLE_PISOS = [
  { val: 'SOT', label: 'Sótano', short: 'Sót' },
  { val: '1ER PISO', label: '1er Piso', short: 'P1' },
  { val: '2DO PISO', label: '2do Piso', short: 'P2' },
  { val: '3ER PISO', label: '3er Piso', short: 'P3' },
  { val: '4TO PISO', label: '4to Piso', short: 'P4' },
  { val: '5TO PISO', label: '5to Piso', short: 'P5' }
];

export default function AdminControlModal({ isOpen, onClose, authUser }) {
  const fadeModal = useFadeModal(isOpen, onClose, 200, { isModal: true });

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
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Usuario a eliminar
  const [userToDelete, setUserToDelete] = useState(null);

  // Indicador deslizante suave para pestañas (Sliding Pill)
  const tabSlide = useSlidingIndicator(activeTab, [users.length, isOpen, fadeModal.shouldRender]);

  // Cerrar dropdown de rol al hacer click fuera
  useEffect(() => {
    const handleOutside = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setRoleDropdownOpen(false);
      }
    };
    if (roleDropdownOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [roleDropdownOpen]);

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
      setRoleDropdownOpen(false);
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
        pabellon: '',
        pisos: []
      });

      setCreateSuccess(`Usuario ${newName.toUpperCase()} creado y sincronizado con éxito. Puedes asignarle pisos en la pestaña "Asignación".`);
      setNewName('');
      setNewUsername('');
      setNewPassword('1234');
      setNewRole('asistente');
      setRoleDropdownOpen(false);
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

  if (!fadeModal.shouldRender || typeof document === 'undefined') return null;

  const filteredUsers = users.filter(u => {
    if (!searchFilter.trim()) return true;
    const s = searchFilter.toLowerCase();
    return (
      u.name.toLowerCase().includes(s) ||
      u.username.toLowerCase().includes(s) ||
      (u.role && u.role.toLowerCase().includes(s))
    );
  });

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md ${fadeModal.backdropClass}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) fadeModal.requestClose();
      }}
    >
      <div
        style={{
          backdropFilter: 'blur(36px) saturate(200%)',
          WebkitBackdropFilter: 'blur(36px) saturate(200%)',
        }}
        className={`apple-liquid-modal w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-200/90 dark:border-[#FDBA30]/30 shadow-2xl text-slate-900 dark:text-white overflow-hidden font-sans ${fadeModal.modalClass}`}
      >

        {/* Cabecera del Panel con Branding UPN */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/90 dark:bg-zinc-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FDBA30]/15 border border-[#FDBA30]/40 flex items-center justify-center text-[#d99000] dark:text-[#FDBA30] shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-upn font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  Panel Administrativo
                </h2>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FDBA30] text-black shadow-2xs">
                  {authUser?.name || 'Administrador'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Asignación de pabellones, pisos prioritarios y usuarios
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fadeModal.requestClose()}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/60 transition active:scale-95 cursor-pointer"
            aria-label="Cerrar panel"
          >
            <X className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Barra de Pestañas con Indicador Deslizante (Sliding Pill) */}
        <div className="px-3.5 sm:px-4 py-2 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-100/90 dark:bg-[#111115] flex items-center justify-between gap-2 shrink-0">
          <div
            ref={tabSlide.containerRef}
            className="relative flex items-center gap-1 p-1 rounded-2xl bg-slate-200/70 dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800"
          >
            {/* Sliding Pill Indicator */}
            <span
              aria-hidden="true"
              style={tabSlide.pillStyle}
              className="pointer-events-none absolute top-0 left-0 z-0 rounded-xl bg-[#FDBA30] shadow-md shadow-[#FDBA30]/25"
            />

            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              data-slide-active={activeTab === 'assignments' ? 'true' : undefined}
              className={`relative z-10 px-3 py-1.5 rounded-xl text-xs transition-colors duration-200 flex items-center gap-1.5 cursor-pointer ${activeTab === 'assignments'
                ? 'text-black font-black'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
            >
              <MapPin className="w-3.5 h-3.5 stroke-[2.4]" />
              <span className="font-upn">Asignación</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono transition-colors ${activeTab === 'assignments'
                ? 'bg-black/20 text-black font-black'
                : 'bg-slate-300/80 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold'
                }`}>
                {users.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              data-slide-active={activeTab === 'users' ? 'true' : undefined}
              className={`relative z-10 px-3 py-1.5 rounded-xl text-xs transition-colors duration-200 flex items-center gap-1.5 cursor-pointer ${activeTab === 'users'
                ? 'text-black font-black'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-bold'
                }`}
            >
              <Users className="w-3.5 h-3.5 stroke-[2.4]" />
              <span className="font-upn">Crear & Eliminar</span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="p-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-200/80 text-slate-600 border border-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white dark:border-zinc-800 transition disabled:opacity-50 text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
            title="Refrescar usuarios desde la nube"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#d99000] dark:text-[#FDBA30]' : ''}`} />
            <span className="hidden sm:inline text-[11px] font-semibold">Sincronizar</span>
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5">

          {/* ======================================================== */}
          {/* TAB 1: ASIGNACIÓN DE PISOS Y PABELLONES                 */}
          {/* ======================================================== */}
          {activeTab === 'assignments' && (
            <div className="space-y-3">
              {/* Mensaje Informativo */}
              <div className="p-2.5 sm:p-3 rounded-2xl bg-[#FDBA30]/10 border border-[#FDBA30]/30 flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-200">
                <MapPin className="w-4 h-4 text-[#d99000] dark:text-[#FDBA30] shrink-0 mt-0.5 stroke-[2.2]" />
                <div className="text-[11.5px] leading-relaxed">
                  <span className="font-black text-[#9e6700] dark:text-[#FDBA30]">Prioridad de Rondas: </span>
                  Los pisos y pabellón seleccionados para cada asistente se abrirán automáticamente por defecto al ingresar a la app.
                </div>
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar asistente por nombre o usuario..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full h-9 pl-8.5 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FDBA30] dark:bg-zinc-900/90 dark:border-zinc-800 dark:text-white dark:placeholder-zinc-500 transition"
                />
              </div>

              {/* Lista de Usuarios y Asignaciones */}
              <div className="grid grid-cols-1 gap-2.5">
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
            <div className="space-y-4">

              {/* Formulario Crear Usuario */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800/80 space-y-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#FDBA30]/15 border border-[#FDBA30]/40 flex items-center justify-center text-[#d99000] dark:text-[#FDBA30]">
                    <UserPlus className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-upn font-black text-slate-900 dark:text-white uppercase">Crear Nuevo Usuario</h3>
                    <p className="text-[10.5px] text-slate-500 dark:text-zinc-400">Se registrará y sincronizará en tiempo real con la nube</p>
                  </div>
                </div>

                {createError && (
                  <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                    <span>{createError}</span>
                  </div>
                )}

                {createSuccess && (
                  <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                    <span>{createSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Nombre Completo */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: CARLOS MEDINA"
                        value={newName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 uppercase placeholder-slate-400 focus:outline-none focus:border-[#FDBA30] dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:placeholder-zinc-600"
                        required
                      />
                    </div>

                    {/* Nombre de Usuario */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Usuario (Login)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: cmedina"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                        className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs text-[#b37700] dark:text-[#FDBA30] font-mono placeholder-slate-400 focus:outline-none focus:border-[#FDBA30] dark:bg-zinc-950 dark:border-zinc-800 dark:placeholder-zinc-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Rol Personalizado - Sustituye el menú nativo azul de Windows */}
                    <div className="relative" ref={roleDropdownRef}>
                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Rol en el Sistema
                      </label>
                      <button
                        type="button"
                        onClick={() => setRoleDropdownOpen(prev => !prev)}
                        className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-white flex items-center justify-between gap-2 hover:border-[#FDBA30] dark:hover:border-[#FDBA30] transition cursor-pointer focus:outline-none"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {newRole === 'admin' ? (
                            <span className="w-5 h-5 rounded-lg bg-[#FDBA30]/20 text-[#b37700] dark:text-[#FDBA30] flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2]" />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 stroke-[2.2]" />
                            </span>
                          )}
                          <span className="font-semibold truncate">
                            {newRole === 'admin' ? 'Administrador' : 'Asistente'}
                          </span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200 shrink-0 ${roleDropdownOpen ? 'rotate-180 text-[#FDBA30]' : ''}`} />
                      </button>

                      {/* Dropdown flotante con estilo UPN */}
                      {roleDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-30 p-1.5 rounded-2xl bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-700/80 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNewRole('asistente');
                              setRoleDropdownOpen(false);
                            }}
                            className={`w-full p-2 rounded-xl text-left transition flex items-center justify-between gap-2 cursor-pointer ${newRole === 'asistente'
                              ? 'bg-sky-500/10 dark:bg-sky-950/40 border border-sky-300/60 dark:border-sky-800/60'
                              : 'hover:bg-slate-100 dark:hover:bg-zinc-800/60 border border-transparent'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6.5 h-6.5 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 stroke-[2.2]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  Asistente (Operaciones Campus)
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                                  Rondas de asistencia y registro de aulas
                                </div>
                              </div>
                            </div>
                            {newRole === 'asistente' && (
                              <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0 stroke-[2.5]" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setNewRole('admin');
                              setRoleDropdownOpen(false);
                            }}
                            className={`w-full p-2 rounded-xl text-left transition flex items-center justify-between gap-2 cursor-pointer ${newRole === 'admin'
                              ? 'bg-[#FDBA30]/15 border border-[#FDBA30]/40'
                              : 'hover:bg-slate-100 dark:hover:bg-zinc-800/60 border border-transparent'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6.5 h-6.5 rounded-lg bg-[#FDBA30]/25 text-[#9e6700] dark:text-[#FDBA30] flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.2]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  Administrador (Control Total)
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                                  Gestión de usuarios, pisos y reportes
                                </div>
                              </div>
                            </div>
                            {newRole === 'admin' && (
                              <Check className="w-3.5 h-3.5 text-[#d99000] dark:text-[#FDBA30] shrink-0 stroke-[2.5]" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Contraseña inicial */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Contraseña / PIN Inicial
                      </label>
                      <input
                        type="text"
                        placeholder="1234"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-[#FDBA30] dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:placeholder-zinc-600"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="h-9 px-4 rounded-xl bg-[#FDBA30] hover:bg-[#e29b12] text-black font-black text-xs transition active:scale-95 flex items-center gap-2 cursor-pointer shadow-md shadow-[#FDBA30]/20 font-upn uppercase"
                    >
                      <UserPlus className="w-4 h-4 stroke-[2.2]" />
                      <span>Crear y Sincronizar Usuario</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista de Usuarios Registrados con Opción de Eliminar */}
              <div className="space-y-2.5">
                <h3 className="text-[11px] font-black text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Usuarios Activos ({users.length})</span>
                  <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 font-normal">Admins raíz protegidos</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {users.map(u => {
                    const isProtected = ['tsalinas', 'apascual', 'admin'].includes(u.username.toLowerCase());
                    const isCurrent = authUser?.username?.toLowerCase() === u.username.toLowerCase();

                    return (
                      <div
                        key={u.username}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${u.role === 'admin'
                            ? 'bg-[#FDBA30]/20 text-[#b37700] dark:text-[#FDBA30] border border-[#FDBA30]/40'
                            : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                            }`}>
                            {u.role === 'admin' ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                              <span className="uppercase">{u.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9px] font-black uppercase">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                              <span>@{u.username}</span>
                              <span>•</span>
                              <span className={u.role === 'admin' ? 'text-[#b37700] dark:text-[#FDBA30] font-bold' : 'text-slate-500 dark:text-zinc-400'}>
                                {u.role === 'admin' ? 'ADMIN' : 'ASISTENTE'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Botón Eliminar o Badge Protegido */}
                        {isProtected ? (
                          <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-zinc-800/80 text-[9.5px] font-bold text-slate-600 dark:text-zinc-500 border border-slate-300 dark:border-zinc-700/50 shrink-0">
                            Protegido
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:text-zinc-500 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 transition active:scale-95 shrink-0 cursor-pointer"
                            title={`Eliminar usuario ${u.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
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

        {/* Modal de Confirmación para Eliminar con Fade */}
        {userToDelete && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-sm p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-500/40 shadow-2xl text-slate-900 dark:text-white space-y-3.5">
              <div className="flex items-center gap-2.5 text-rose-500 dark:text-rose-400">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4.5 h-4.5 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-upn font-black uppercase text-slate-900 dark:text-white">¿Eliminar Usuario?</h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1">
                <div><span className="text-slate-500 dark:text-zinc-500">Nombre: </span><span className="font-bold text-slate-900 dark:text-white uppercase">{userToDelete.name}</span></div>
                <div><span className="text-slate-500 dark:text-zinc-500">Usuario: </span><span className="font-mono text-[#b37700] dark:text-[#FDBA30]">@{userToDelete.username}</span></div>
                <div><span className="text-slate-500 dark:text-zinc-500">Rol: </span><span className="uppercase font-bold">{userToDelete.role}</span></div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-600/30 uppercase font-upn"
                >
                  <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Sí, Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>,
    document.body
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
    <div className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${isDirty
      ? 'bg-amber-50/60 dark:bg-zinc-900/90 border-[#FDBA30] shadow-md shadow-[#FDBA30]/5'
      : 'bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
      }`}>
      {/* Cabecera del Usuario */}
      <div className="flex items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${user.role === 'admin'
            ? 'bg-[#FDBA30]/20 text-[#b37700] dark:text-[#FDBA30] border border-[#FDBA30]/40'
            : 'bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
            }`}>
            {user.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-upn font-black text-slate-900 dark:text-white truncate uppercase">
                {user.name}
              </span>
              {isCurrentLogged && (
                <span className="px-1.5 py-0.2 rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[9px] font-black uppercase">
                  Tú
                </span>
              )}
              <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${user.role === 'admin'
                ? 'bg-[#FDBA30] text-black shadow-2xs'
                : 'bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                {user.role === 'admin' ? 'ADMIN' : 'ASISTENTE'}
              </span>
            </div>
            <div className="text-[10.5px] font-mono text-slate-500 dark:text-zinc-500">
              @{user.username}
            </div>
          </div>
        </div>

        {/* Botón Guardar Asignación */}
        <div className="shrink-0 flex items-center gap-1.5">
          {savedMsg && (
            <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              {savedMsg}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
            className={`h-7 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${isDirty
              ? 'bg-[#FDBA30] hover:bg-[#e29b12] text-black font-black shadow-md shadow-[#FDBA30]/20'
              : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600 opacity-60 cursor-not-allowed'
              }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {/* Selectores de Pabellón y Pisos con botones amplios y disposición ordenada */}
      <div className="space-y-3 pt-2.5 border-t border-slate-200 dark:border-zinc-800/80">

        {/* Pabellón Prioritario */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#d99000] dark:text-[#FDBA30]" />
              <span>Pabellón</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
              {selectedPab ? `Pabellón ${selectedPab}` : 'Todos los pabellones'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectPab('')}
              className={`h-8 sm:h-8.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 ${selectedPab === ''
                ? 'bg-[#FDBA30] text-black font-black shadow-xs ring-1 ring-[#FDBA30]/50'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border border-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:hover:text-white dark:border-zinc-700/60'
                }`}
            >
              Todos
            </button>
            {AVAILABLE_PABELLONES.map(pab => (
              <button
                key={pab}
                type="button"
                onClick={() => handleSelectPab(pab)}
                className={`h-8 sm:h-8.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer active:scale-95 ${selectedPab === pab
                  ? 'bg-[#FDBA30] text-black font-black shadow-xs ring-1 ring-[#FDBA30]/50'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border border-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:hover:text-white dark:border-zinc-700/60'
                  }`}
              >
                Pabellón {pab}
              </button>
            ))}
          </div>
        </div>

        {/* Pisos Prioritarios */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#d99000] dark:text-[#FDBA30]" />
              <span>Pisos Asignados</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
              {selectedPisos.length === 0 ? 'Todos los pisos' : `${selectedPisos.length} selec.`}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 items-center">
            <button
              type="button"
              onClick={() => {
                setIsDirty(true);
                setSelectedPisos([]);
              }}
              className={`h-8 sm:h-8.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center text-center cursor-pointer active:scale-95 ${selectedPisos.length === 0
                ? 'bg-[#FDBA30] text-black font-black shadow-xs ring-1 ring-[#FDBA30]/50'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border border-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:hover:text-white dark:border-zinc-700/60'
                }`}
            >
              <span className="w-full text-center">Todos</span>
            </button>
            {AVAILABLE_PISOS.map(p => {
              const isSelected = selectedPisos.includes(p.val);
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => handleTogglePiso(p.val)}
                  className={`h-8 sm:h-8.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center text-center cursor-pointer active:scale-95 ${isSelected
                    ? 'bg-[#FDBA30] text-black font-black shadow-xs ring-1 ring-[#FDBA30]/50'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border border-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:hover:text-white dark:border-zinc-700/60'
                    }`}
                  title={p.label}
                >
                  <span className="w-full text-center">{p.short}</span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
