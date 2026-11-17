import { useState, useEffect } from 'react';
import { getCustomUsers } from './auth';

// LISTA OFICIAL Y ÚNICA AUTORIZADA DE ASISTENTES / RESPONSABLES (UPN COMAS)
export const OFFICIAL_ASSISTANTS = [
  'ANTHONY PALOMINO',
  'TAYRON SALINAS',
  'ALESSANDRO PASCUAL',
  'FRANCISCO VILLAFAN',
  'JOSE MIRANDA',
  'JAEL GALLARDO',
  'JANETH VIVAR PEREZ'
];

export const DEFAULT_ASSISTANTS = [...OFFICIAL_ASSISTANTS];

let cachedAssistants = [...OFFICIAL_ASSISTANTS];

export function getCachedAssistants() {
  try {
    const custom = getCustomUsers();
    const customNames = custom.map(u => String(u.name || '').trim().toUpperCase()).filter(Boolean);
    const combined = Array.from(new Set([...OFFICIAL_ASSISTANTS, ...customNames]));
    cachedAssistants = combined;
    return combined;
  } catch (_) {
    return OFFICIAL_ASSISTANTS;
  }
}

export function useAssistants() {
  const [assistants, setAssistants] = useState(() => getCachedAssistants());

  const fetchAssistants = async () => {
    try {
      const res = await fetch('/api/assistants');
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        const serverList = json.data.map(a => String(a || '').trim().toUpperCase()).filter(Boolean);
        const custom = getCustomUsers();
        const customNames = custom.map(u => String(u.name || '').trim().toUpperCase()).filter(Boolean);
        const unified = Array.from(new Set([...OFFICIAL_ASSISTANTS, ...serverList, ...customNames]));
        cachedAssistants = unified;
        setAssistants(unified);
      } else {
        const custom = getCustomUsers();
        const customNames = custom.map(u => String(u.name || '').trim().toUpperCase()).filter(Boolean);
        const unified = Array.from(new Set([...OFFICIAL_ASSISTANTS, ...customNames]));
        cachedAssistants = unified;
        setAssistants(unified);
      }
    } catch (_) {
      setAssistants(getCachedAssistants());
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
