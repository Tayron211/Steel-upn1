/**
 * Sistema de Autenticación de Asistentes UPN - Campus Comas
 * Creado en base a los asistentes y administradores oficiales del sistema.
 * 
 * Regla de Usuario: Inicial del primer nombre + Primer apellido (en minúsculas)
 * Ejemplos:
 *  - Anthony Palomino  -> apalomino
 *  - Tayron Salinas    -> tsalinas  (Admin)
 *  - Alessandro Pascual-> apascual  (Admin)
 *  - Francisco Villafan-> fvillafan
 *  - Jose Miranda      -> jmiranda
 *  - Jael Gallardo     -> jgallardo
 *  - Admin             -> admin     (Admin)
 * 
 * Contraseñas fáciles de recordar:
 *  - PIN universal: 1234
 *  - Apellido del usuario en minúsculas (ej: palomino, salinas, pascual, etc.)
 *  - Clave institucional: upn2026
 *  - Clave master admin: 210391
 */

export const USERS_REGISTRY = [
  {
    username: 'tsalinas',
    name: 'TAYRON SALINAS',
    role: 'admin',
    passwords: ['1234', '210391', 'salinas', 'salinas2026', 'admin', 'upn2026']
  },
  {
    username: 'apascual',
    name: 'ALESSANDRO PASCUAL ROMERO',
    role: 'admin',
    passwords: ['1234', '210391', 'pascual', 'pascual2026', 'admin', 'upn2026']
  },
  {
    username: 'jmiranda',
    name: 'JOSÉ CARLOS MIRANDA ROSALES',
    role: 'asistente',
    passwords: ['1234', 'miranda', 'miranda2026', 'upn2026']
  },
  {
    username: 'fvillafan',
    name: 'FRANCISCO ALONSO VILLAFAN COLONIA',
    role: 'asistente',
    passwords: ['1234', 'villafan', 'villafan2026', 'upn2026']
  },
  {
    username: 'jbenites',
    name: 'JAVIER ALEXANDER BENITES ALBAN',
    role: 'asistente',
    passwords: ['1234', 'benites', 'benites2026', 'upn2026']
  },
  {
    username: 'jgallardo',
    name: 'JAEL ZULEMA GALLARDO CARRANZA',
    role: 'asistente',
    passwords: ['1234', 'gallardo', 'gallardo2026', 'upn2026']
  },
  {
    username: 'evelasquez',
    name: 'EDUARDO ANTONIO VELASQUEZ CARRION',
    role: 'asistente',
    passwords: ['1234', 'velasquez', 'velasquez2026', 'upn2026']
  },
  {
    username: 'jflores',
    name: 'JUNIOR MARINO FLORES PUMACAYO',
    role: 'asistente',
    passwords: ['1234', 'flores', 'flores2026', 'upn2026']
  },
  {
    username: 'dhusarez',
    name: 'DAVID SAMUEL HUSAREZ CABRERA',
    role: 'asistente',
    passwords: ['1234', 'husarez', 'husarez2026', 'upn2026']
  },
  {
    username: 'jvivar',
    name: 'JANETH VIVAR PEREZ',
    role: 'asistente',
    passwords: ['1234', 'vivar', 'vivar2026', 'upn2026']
  },
  {
    username: 'apalomino',
    name: 'ANTHONY PALOMINO',
    role: 'asistente',
    passwords: ['1234', 'palomino', 'palomino2026', 'upn2026']
  },
  {
    username: 'admin',
    name: 'TAYRON SALINAS',
    role: 'admin',
    passwords: ['210391', '1234', 'admin', 'salinas', 'upn2026']
  }
];

const AUTH_STORAGE_KEY = 'steel_auth_user';
const CUSTOM_USERS_KEY = 'steel_custom_users';
const ASSIGNMENTS_STORAGE_KEY = 'steel_user_assignments';
const DELETED_USERS_KEY = 'steel_deleted_users';

// Configuración de expiración de sesión por inactividad (8 horas para asistentes)
export const ASSISTANT_MAX_INACTIVITY_MS = 8 * 60 * 60 * 1000; // 8 horas en milisegundos (28,800,000 ms)
export const LAST_ACTIVITY_KEY = 'steel_last_activity_at';
export const SESSION_EXPIRED_KEY = 'steel_session_expired_notice';
export const LAST_USER_KEY = 'steel_last_user';

let lastActivityWriteTime = 0;

/**
 * Registra la última interacción del usuario (touch, click, scroll, teclado o fetch)
 * Con throttle para evitar escrituras masivas en localStorage (máx 1 cada 15s).
 */
export function recordUserActivity() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastActivityWriteTime < 15000) return;
  lastActivityWriteTime = now;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  } catch (_) {}
}

/**
 * Comprueba si la sesión de un asistente ha superado las 8 horas desde su última interacción
 */
export function isSessionExpired(user) {
  if (!user || user.role === 'admin') return false;
  if (typeof window === 'undefined') return false;
  try {
    const rawLast = localStorage.getItem(LAST_ACTIVITY_KEY);
    const lastActivity = Number(rawLast) || (user.loginAt ? new Date(user.loginAt).getTime() : 0);
    if (!lastActivity) return false;
    return (Date.now() - lastActivity) > ASSISTANT_MAX_INACTIVITY_MS;
  } catch (_) {
    return false;
  }
}

/**
 * Recupera el aviso de expiración si la sesión fue cerrada automáticamente por inactividad
 */
export function getSessionExpiredNotice() {
  if (typeof window === 'undefined') return null;
  try {
    const notice = localStorage.getItem(SESSION_EXPIRED_KEY);
    if (notice) {
      localStorage.removeItem(SESSION_EXPIRED_KEY);
      return notice;
    }
  } catch (_) {}
  return null;
}

export function getDeletedUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DELETED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export function markUserDeleted(username) {
  const clean = String(username || '').trim().toLowerCase();
  const list = getDeletedUsers();
  if (!list.includes(clean)) {
    list.push(clean);
    localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(list));
  }
}

export function unmarkUserDeleted(username) {
  const clean = String(username || '').trim().toLowerCase();
  const list = getDeletedUsers().filter(u => u !== clean);
  localStorage.setItem(DELETED_USERS_KEY, JSON.stringify(list));
}

// Obtener usuario autenticado actual (verifica expiración por inactividad para asistentes)
export function getAuthUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user) return null;

    // Control de expiración de sesión para asistentes tras 8 horas de inactividad
    if (user.role !== 'admin' && isSessionExpired(user)) {
      logout(true); // true = cierre de sesión por inactividad
      return null;
    }

    return user;
  } catch (_) {
    return null;
  }
}

export function getLoggedAssistantName() {
  const user = getAuthUser();
  if (user && user.name) return user.name;
  if (user && user.displayName) return user.displayName;
  return 'TAYRON SALINAS';
}

export function isAdmin() {
  const user = getAuthUser();
  return user?.role === 'admin';
}

// Obtener asignaciones locales (pabellón y pisos)
export function getUserAssignments() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

// Obtener usuarios adicionales creados dinámicamente
export function getCustomUsers() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

// Obtener lista completa unificada de usuarios con sus asignaciones
export function getAllUsers() {
  const custom = getCustomUsers();
  const assignments = getUserAssignments();
  const deleted = getDeletedUsers();

  // Mapear base
  const baseMap = new Map();
  USERS_REGISTRY.forEach(u => {
    const key = u.username.toLowerCase();
    if (deleted.includes(key)) return;
    baseMap.set(key, {
      ...u,
      isRoot: true,
      pabellon: assignments[key]?.pabellon || '',
      pisos: assignments[key]?.pisos || []
    });
  });

  // Agregar / sobreescribir con custom
  custom.forEach(cu => {
    const key = cu.username.toLowerCase();
    if (deleted.includes(key)) return;
    const existing = baseMap.get(key);
    baseMap.set(key, {
      ...existing,
      ...cu,
      isRoot: existing?.isRoot || false,
      pabellon: assignments[key]?.pabellon || cu.pabellon || '',
      pisos: assignments[key]?.pisos || cu.pisos || []
    });
  });

  return Array.from(baseMap.values());
}

// Sincronizar usuarios y asignaciones desde el servidor (Cloudflare D1)
export async function syncUsersWithServer() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) return getAllUsers();
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data)) {
      const serverUsers = json.data;
      const customList = [];
      const assignments = getUserAssignments();
      const deleted = getDeletedUsers();

      serverUsers.forEach(su => {
        const key = su.username.toLowerCase();
        // Si el usuario fue eliminado por el administrador, ignorarlo completamente
        if (deleted.includes(key)) return;

        // Guardar asignación
        if (su.pabellon !== undefined || su.pisos !== undefined) {
          assignments[key] = {
            pabellon: su.pabellon || '',
            pisos: Array.isArray(su.pisos) ? su.pisos : []
          };
        }

        customList.push({
          username: su.username,
          name: su.name,
          role: su.role || 'asistente',
          passwords: su.passwords || (su.password ? [su.password, '1234', 'upn2026'] : ['1234', 'upn2026']),
          pabellon: su.pabellon || '',
          pisos: Array.isArray(su.pisos) ? su.pisos : []
        });
      });

      localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(customList));
      localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));

      // Actualizar sesión si el usuario activo cambió de asignación o rol
      const active = getAuthUser();
      if (active && assignments[active.username.toLowerCase()]) {
        const myAssign = assignments[active.username.toLowerCase()];
        active.assignedPabellon = myAssign.pabellon;
        active.assignedPisos = myAssign.pisos;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(active));
      }

      window.dispatchEvent(new Event('steel:users-updated'));
      return getAllUsers();
    }
  } catch (err) {
    console.warn('No se pudo sincronizar usuarios desde backend:', err);
  }
  return getAllUsers();
}

// Guardar asignación de pabellón y pisos para un usuario
export async function saveUserAssignment(username, pabellon, pisos) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const assignments = getUserAssignments();
  assignments[cleanUser] = {
    pabellon: pabellon || '',
    pisos: Array.isArray(pisos) ? pisos : []
  };
  localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));

  // Si es el usuario activo, actualizar su sesión
  const active = getAuthUser();
  if (active && active.username.toLowerCase() === cleanUser) {
    active.assignedPabellon = pabellon || '';
    active.assignedPisos = Array.isArray(pisos) ? pisos : [];
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(active));
    window.dispatchEvent(new Event('steel:auth-changed'));
  }

  window.dispatchEvent(new Event('steel:assignments-updated'));

  // Enviar a la API
  try {
    await fetch(`/api/users/${encodeURIComponent(cleanUser)}/assignment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pabellon, pisos })
    });
  } catch (_) {}

  return true;
}

// Crear o actualizar un usuario
export async function saveUser({ username, name, role = 'asistente', password = '1234', pabellon = '', pisos = [] }) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanName = String(name || '').trim().toUpperCase();
  const cleanPass = String(password || '1234').trim();

  if (!cleanUser || !cleanName) {
    throw new Error('El nombre y el nombre de usuario son obligatorios');
  }

  // Desmarcar de eliminados si previamente fue borrado
  unmarkUserDeleted(cleanUser);

  const custom = getCustomUsers();
  const existingIdx = custom.findIndex(u => u.username.toLowerCase() === cleanUser);

  const userObj = {
    username: cleanUser,
    name: cleanName,
    role: role === 'admin' ? 'admin' : 'asistente',
    passwords: [cleanPass, '1234', 'upn2026', cleanUser],
    pabellon: pabellon || '',
    pisos: Array.isArray(pisos) ? pisos : []
  };

  if (existingIdx >= 0) {
    custom[existingIdx] = { ...custom[existingIdx], ...userObj };
  } else {
    custom.push(userObj);
  }

  localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(custom));

  // Guardar asignación
  if (pabellon !== undefined || pisos !== undefined) {
    const assignments = getUserAssignments();
    assignments[cleanUser] = { pabellon: pabellon || '', pisos: Array.isArray(pisos) ? pisos : [] };
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
  }

  window.dispatchEvent(new Event('steel:users-updated'));

  // Enviar a la API
  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userObj)
    });
  } catch (_) {}

  return userObj;
}

// Eliminar un usuario
export async function deleteUser(username) {
  const cleanUser = String(username || '').trim().toLowerCase();
  if (['tsalinas', 'apascual', 'admin'].includes(cleanUser)) {
    throw new Error('No es posible eliminar administradores del sistema.');
  }

  // 1. Marcar como eliminado en lista negra local
  markUserDeleted(cleanUser);

  // 2. Limpiar de custom users
  const custom = getCustomUsers();
  const filtered = custom.filter(u => u.username.toLowerCase() !== cleanUser);
  localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(filtered));

  // 3. Limpiar asignaciones
  const assignments = getUserAssignments();
  delete assignments[cleanUser];
  localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));

  // 4. Enviar a la API para eliminar de Cloudflare D1
  try {
    await fetch(`/api/users/${encodeURIComponent(cleanUser)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('DELETE /api/users cloud warning:', err);
  }

  window.dispatchEvent(new Event('steel:users-updated'));
  return true;
}

// Autenticar usuario con soporte para usuarios oficiales y personalizados
export function authenticate(username, password) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim().toLowerCase();

  const allUsers = getAllUsers();
  const found = allUsers.find(u => 
    u.username.toLowerCase() === cleanUser || 
    u.name.toLowerCase() === cleanUser
  );

  if (!found) {
    // Si intenta ingresar como admin con clave maestra
    if (cleanPass === '210391' || cleanPass === 'admin') {
      const fallbackAdmin = {
        username: cleanUser || 'admin',
        name: cleanUser ? cleanUser.toUpperCase() : 'TAYRON SALINAS',
        role: 'admin',
        displayName: cleanUser ? cleanUser.toUpperCase() : 'TAYRON SALINAS',
        assignedPabellon: '',
        assignedPisos: [],
        loginAt: new Date().toISOString()
      };
      saveSession(fallbackAdmin);
      return { success: true, user: fallbackAdmin };
    }
    return { success: false, message: 'Usuario no registrado. Usa tu inicial + apellido (ej: tsalinas, apascual, apalomino).' };
  }

  // Verificar contraseña
  const userPasswords = Array.isArray(found.passwords) ? found.passwords : [found.password || '1234'];
  const isValidPass = userPasswords.some(p => String(p || '').toLowerCase() === cleanPass) || cleanPass === '210391';

  if (!isValidPass) {
    return { 
      success: false, 
      message: 'Contraseña incorrecta. Recuerda que puedes usar tu PIN simple (1234) o tu apellido.' 
    };
  }

  const assignments = getUserAssignments();
  const myAssign = assignments[found.username.toLowerCase()] || {};

  const sessionUser = {
    username: found.username,
    name: found.name,
    role: found.role,
    displayName: found.name,
    assignedPabellon: myAssign.pabellon !== undefined ? myAssign.pabellon : (found.pabellon || ''),
    assignedPisos: (Array.isArray(myAssign.pisos) && myAssign.pisos.length > 0) ? myAssign.pisos : (found.pisos || []),
    loginAt: new Date().toISOString()
  };

  saveSession(sessionUser);
  return { success: true, user: sessionUser };
}

export function saveSession(user) {
  try {
    const now = Date.now();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem('asistente_activo', user.name);
    if (user.username) {
      localStorage.setItem(LAST_USER_KEY, user.username);
    }
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    localStorage.removeItem(SESSION_EXPIRED_KEY);
    lastActivityWriteTime = now;
    window.dispatchEvent(new Event('steel:auth-changed'));
  } catch (_) {}
}

export function logout(dueToInactivity = false) {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    if (dueToInactivity) {
      localStorage.setItem(
        SESSION_EXPIRED_KEY,
        'Tu sesión ha expirado tras 8 horas de inactividad. Por favor, ingresa tus credenciales nuevamente.'
      );
    } else {
      localStorage.removeItem(SESSION_EXPIRED_KEY);
    }
    window.dispatchEvent(new Event('steel:auth-changed'));
  } catch (_) {}
}
