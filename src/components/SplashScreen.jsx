import React, { useState, useEffect } from 'react';

/**
 * SplashScreen - Pantalla de inicio sobria, institucional y seria
 * Diseñada bajo el branding oficial de Universidad Privada del Norte (UPN)
 * Tipografía: Space Grotesk + Plus Jakarta Sans + JetBrains Mono
 * Paleta: Negro AMOLED (#000000), Oro UPN (#FDBA30), Gris zinc sobrio
 */
export default function SplashScreen({ minDuration = 1200, onFinished }) {
  const [mounted, setMounted] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Temporizador para inicio de transición de salida suave
    const timer = setTimeout(() => {
      setFadingOut(true);
    }, minDuration);

    // Desmontar completamente del DOM tras la animación de salida
    const unmountTimer = setTimeout(() => {
      setMounted(false);
      if (onFinished) onFinished();
    }, minDuration + 600);

    return () => {
      clearTimeout(timer);
      clearTimeout(unmountTimer);
    };
  }, [minDuration, onFinished]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[99999] bg-[#000000] flex flex-col justify-between items-center select-none overflow-hidden safe-top safe-bottom transition-all duration-700 ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none scale-[1.01]' : 'opacity-100 pointer-events-auto scale-100'
      }`}
      style={{
        backgroundColor: '#000000',
        colorScheme: 'dark'
      }}
    >
      {/* Luz ambiental sutil en el fondo */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(253, 186, 48, 0.25) 0%, rgba(0, 0, 0, 0) 70%)'
        }}
      />

      {/* Espaciador superior para balance áureo */}
      <div className="w-full pt-10 sm:pt-14 flex justify-center">
        <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-zinc-600 font-medium">
          Universidad Privada del Norte
        </span>
      </div>

      {/* Bloque Central de Identidad */}
      <div className="relative flex flex-col items-center text-center px-6 max-w-sm w-full -mt-6">
        {/* Emblema UPN con halo sutil */}
        <div className="relative mb-6">
          <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-[#FDBA30] shadow-[0_0_40px_rgba(253,186,48,0.22)] ring-1 ring-white/10 flex items-center justify-center p-3 transform transition-transform duration-700 hover:scale-105">
            <img
              src="/icon.svg"
              alt="UPN"
              className="w-full h-full object-contain filter drop-shadow-xs"
            />
          </div>
        </div>

        {/* Título Principal Institucional */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-[0.22em] text-white uppercase font-['Space_Grotesk',sans-serif] leading-tight">
          Control Docente
        </h1>

        {/* Subtítulo sobrio y sede */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px] font-mono tracking-widest text-zinc-400 uppercase font-semibold">
            Sede Comas
          </span>
          <span className="w-1 h-1 rounded-full bg-zinc-600" />
          <span className="text-[11px] font-mono tracking-widest text-amber-400/90 uppercase font-semibold">
            Operaciones
          </span>
        </div>

        {/* Línea de Carga Minimalista (Hairline loader) */}
        <div className="w-36 h-[2px] bg-zinc-800/90 rounded-full mt-8 overflow-hidden relative">
          <div 
            className="absolute top-0 bottom-0 left-0 bg-[#FDBA30] rounded-full animate-splash-progress"
            style={{
              boxShadow: '0 0 10px rgba(253, 186, 48, 0.6)'
            }}
          />
        </div>
      </div>

      {/* Pie institucional sobrio */}
      <div className="w-full pb-8 sm:pb-10 flex flex-col items-center gap-1.5 text-center">
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
          <span>Sistema Integrado 2026</span>
          <span className="text-zinc-700">•</span>
          <span>v2.6</span>
        </div>
      </div>
    </div>
  );
}
