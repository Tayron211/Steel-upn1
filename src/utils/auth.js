/**
 * Sistema de Autenticación de Asistentes UPN - Campus Comas
 * Creado en base a los 6 asistentes oficiales del sistema.
 * 
 * Regla de Usuario: Inicial del primer nombre + Primer apellido (en minúsculas)
 * Ejemplos:
 *  - Anthony Palomino  -> apalomino
 *  - Tayron Salinas    -> tsalinas  (Admin)
 *  - Alessandro Pascual-> apascual
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
    username: 'apalomino',
    name: 'ANTHONY PALOMINO',
    role: 'asistente',
    passwords: ['1234', 'palomino', 'palomino2026', 'upn2026']
  },
  {
    username: 'tsalinas',
    name: 'TAYRON SALINAS',
    role: 'admin',
    passwords: ['1234', '210391', 'salinas', 'salinas2026', 'admin', 'upn2026']
  },
  {
    username: 'apascual',
    name: 'ALESSANDRO PASCUAL',
    role: 'asistente',
    passwords: ['1234', 'pascual', 'pascual2026', 'upn2026']
  },
  {
    username: 'fvillafan',
    name: 'FRANCISCO VILLAFAN',
    role: 'asistente',
    passwords: ['1234', 'villafan', 'villafan2026', 'upn2026']
  },
  {
    username: 'jmiranda',
    name: 'JOSE MIRANDA',
    role: 'asistente',
    passwords: ['1234', 'miranda', 'miranda2026', 'upn2026']
  },
  {
    username: 'jgallardo',
    name: 'JAEL GALLARDO',
    role: 'asistente',
    passwords: ['1234', 'gallardo', 'gallardo2026', 'upn2026']
  },
  {
    username: 'admin',
    name: 'TAYRON SALINAS',
    role: 'admin',
    passwords: ['210391', '1234', 'admin', 'salinas', 'upn2026']
  }
];

const AUTH_STORAGE_KEY = 'steel_auth_user';

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

export function authenticate(username, password) {
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanPass = String(password || '').trim().toLowerCase();

  const found = USERS_REGISTRY.find(u => 
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
        loginAt: new Date().toISOString()
      };
      saveSession(fallbackAdmin);
      return { success: true, user: fallbackAdmin };
    }
    return { success: false, message: 'Usuario no registrado. Usa tu inicial + apellido (ej: tsalinas, apalomino).' };
  }

  // Verificar contraseña
  const isValidPass = found.passwords.some(p => p.toLowerCase() === cleanPass) || cleanPass === '210391';

  if (!isValidPass) {
    return { 
      success: false, 
      message: 'Contraseña incorrecta. Recuerda que puedes usar tu PIN simple (1234) o tu apellido.' 
    };
  }

  const sessionUser = {
    username: found.username,
    name: found.name,
    role: found.role,
    displayName: found.name,
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

