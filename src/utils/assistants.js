import { useState, useEffect } from 'react';
import { getAllUsers } from './auth';

// LISTA OFICIAL BASE DE ASISTENTES / RESPONSABLES
export const OFFICIAL_ASSISTANTS = [
  'ANTHONY PALOMINO',
  'TAYRON SALINAS',
  'ALESSANDRO PASCUAL',
  'FRANCISCO VILLAFAN',
  'JOSE MIRANDA',
  'JAEL GALLARDO'
];

export const DEFAULT_ASSISTANTS = [...OFFICIAL_ASSISTANTS];

let cachedAssistants = [...OFFICIAL_ASSISTANTS];

export function getCachedAssistants() {
  // Combinar base con usuarios registrados localmente
  try {
    const all = getAllUsers();
    const names = all.map(u => String(u.name || '').trim().toUpperCase()).filter(Boolean);
    const combined = Array.from(new Set([...OFFICIAL_ASSISTANTS, ...names]));
    cachedAssistants = combined;
    return combined;
  } catch (_) {
    return cachedAssistants;
  }
}

export function useAssistants() {
  const [assistants, setAssistants] = useState(() => getCachedAssistants());

  const fetchAssistants = async () => {
    try {
      const localUsers = getAllUsers().map(u => String(u.name || '').trim().toUpperCase());
      const res = await fetch('/api/assistants');
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        const serverList = json.data.map(a => String(a || '').trim().toUpperCase()).filter(Boolean);
        const unified = Array.from(new Set([...OFFICIAL_ASSISTANTS, ...localUsers, ...serverList]));
        cachedAssistants = unified;
        setAssistants(unified);
      } else {
        const unified = Array.from(new Set([...OFFICIAL_ASSISTANTS, ...localUsers]));
        cachedAssistants = unified;
        setAssistants(unified);
      }
    } catch (_) {
      const localUsers = getAllUsers().map(u => String(u.name || '').trim().toUpperCase());
      const unified = Array.from(new Set([...OFFICIAL_ASSISTANTS, ...localUsers]));
      setAssistants(unified);
    }
  };

  useEffect(() => {
    fetchAssistants();
    const handlePulled = () => fetchAssistants();
    const handleUsersUpdated = () => fetchAssistants();
    window.addEventListener('upn:excel-pulled', handlePulled);
    window.addEventListener('steel:users-updated', handleUsersUpdated);
    return () => {
      window.removeEventListener('upn:excel-pulled', handlePulled);
      window.removeEventListener('steel:users-updated', handleUsersUpdated);
    };
  }, []);

  return assistants;
}
