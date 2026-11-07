import { useState, useEffect } from 'react';

export const DEFAULT_ASSISTANTS = [
  'TAYRON SALINAS',
  'JOSÉ CARLOS MIRANDA ROSALES',
  'FRANCISCO ALONSO VILLAFAN COLONIA',
  'JAVIER ALEXANDER BENITES ALBAN',
  'ALESSANDRO PASCUAL ROMERO',
  'JAEL ZULEMA GALLARDO CARRANZA',
  'JANETH VIVAR PEREZ',
  'JHONAYKER MAGUIÑA',
  'EDUARDO ANTONIO VELASQUEZ CARRION',
  'JUNIOR MARINO FLORES PUMACAYO',
  'DAVID SAMUEL HUSAREZ CABRERA'
];

let cachedAssistants = [...DEFAULT_ASSISTANTS];

export function getCachedAssistants() {
  return cachedAssistants;
}

export function useAssistants() {
  const [assistants, setAssistants] = useState(cachedAssistants);

  const fetchAssistants = async () => {
    try {
      const res = await fetch('/api/assistants');
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        // Combinar con los valores por defecto asegurando TAYRON SALINAS al inicio y sin duplicados
        const set = new Set();
        const merged = [];
        
        // Priorizar TAYRON SALINAS al tope
        const rawList = ['TAYRON SALINAS', ...json.data, ...DEFAULT_ASSISTANTS];
        for (const item of rawList) {
          const clean = String(item || '').trim().toUpperCase();
          if (clean && !set.has(clean)) {
            set.add(clean);
            merged.push(clean);
          }
        }
        cachedAssistants = merged;
        setAssistants(merged);
      }
    } catch (_) {
      // Usar lista por defecto si falla la red
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

