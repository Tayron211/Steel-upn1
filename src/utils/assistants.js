import { useState, useEffect } from 'react';

// LISTA OFICIAL Y ÚNICA DE ASISTENTES / RESPONSABLES
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
  return cachedAssistants;
}

export function useAssistants() {
  const [assistants, setAssistants] = useState(OFFICIAL_ASSISTANTS);

  const fetchAssistants = async () => {
    try {
      const res = await fetch('/api/assistants');
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        // Filtrar estrictamente para permitir ÚNICAMENTE a los 6 autorizados
        const allowedSet = new Set(OFFICIAL_ASSISTANTS.map(a => a.toUpperCase()));
        const cleanList = json.data
          .map(a => String(a || '').trim().toUpperCase())
          .filter(a => allowedSet.has(a));

        // Mantener orden oficial garantizado
        const finalList = OFFICIAL_ASSISTANTS.filter(a => cleanList.includes(a) || true);
        cachedAssistants = finalList;
        setAssistants(finalList);
      }
    } catch (_) {
      setAssistants(OFFICIAL_ASSISTANTS);
    }
  };

  useEffect(() => {
    fetchAssistants();
    const handlePulled = () => fetchAssistants();
    window.addEventListener('upn:excel-pulled', handlePulled);
    return () => window.removeEventListener('upn:excel-pulled', handlePulled);
  }, []);

  return assistants;
}


