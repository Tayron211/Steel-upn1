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

// Obtener usuario autenticado actual
export function getAuthUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
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

  // Mapear base
  const baseMap = new Map();
  USERS_REGISTRY.forEach(u => {
    baseMap.set(u.username.toLowerCase(), {
      ...u,
      isRoot: true,
      pabellon: assignments[u.username.toLowerCase()]?.pabellon || '',
      pisos: assignments[u.username.toLowerCase()]?.pisos || []
    });
  });

  // Agregar / sobreescribir con custom
  custom.forEach(cu => {
    const key = cu.username.toLowerCase();
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

      serverUsers.forEach(su => {
        const key = su.username.toLowerCase();
        // Guardar asignación
        if (su.pabellon !== undefined || su.pisos !== undefined) {
          assignments[key] = {
            pabellon: su.pabellon || '',
            pisos: Array.isArray(su.pisos) ? su.pisos : []
          };
        }

        // Si no está en base o tiene cambios de rol/contraseña
        const inBase = USERS_REGISTRY.some(b => b.username.toLowerCase() === key);
        if (!inBase || su.role) {
          customList.push({
            username: su.username,
            name: su.name,
            role: su.role || 'asistente',
            passwords: su.passwords || (su.password ? [su.password, '1234', 'upn2026'] : ['1234', 'upn2026']),
            pabellon: su.pabellon || '',
            pisos: Array.isArray(su.pisos) ? su.pisos : []
          });
        }
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
      window.dispatchEvent(new Event('steel:assignments-updated'));
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

  const custom = getCustomUsers();
  const filtered = custom.filter(u => u.username.toLowerCase() !== cleanUser);
  localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(filtered));

  const assignments = getUserAssignments();
  delete assignments[cleanUser];
  localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));

  window.dispatchEvent(new Event('steel:users-updated'));

  // Enviar a la API
  try {
    await fetch(`/api/users/${encodeURIComponent(cleanUser)}`, {
      method: 'DELETE'
    });
  } catch (_) {}

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
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem('asistente_activo', user.name);
    window.dispatchEvent(new Event('steel:auth-changed'));
  } catch (_) {}
}

export function logout() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event('steel:auth-changed'));
  } catch (_) {}
}
