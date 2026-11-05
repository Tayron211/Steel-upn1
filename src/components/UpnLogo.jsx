import React from 'react';

/**
 * Official UPN Identity Brand Component
 * Uses the authentic official vector logo from Universidad Privada del Norte (upn.edu.pe)
 */
export default function UpnLogo({ variant = 'horizontal', className = '', size = 'md' }) {
  if (variant === 'badge') {
    return (
      <div className={`relative inline-flex items-center justify-center rounded-xl overflow-hidden shadow-xs shrink-0 select-none ${
        size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : 'h-9.5'
      } ${className}`}>
        <img 
          src="/logo-upn-oficial.svg" 
          alt="UPN Logo Oficial" 
          className="h-full w-auto object-contain rounded-xl"
        />
      </div>
    );
  }

  if (variant === 'logo-only') {
    return (
      <img 
        src="/logo-upn-oficial.svg" 
        alt="Universidad Privada del Norte" 
        className={`h-9 sm:h-10 w-auto object-contain rounded-xl shadow-xs select-none ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Official UPN Vector Logo directly from upn.edu.pe */}
      <img 
        src="/logo-upn-oficial.svg" 
        alt="Universidad Privada del Norte" 
        className="h-9 sm:h-10 w-auto object-contain rounded-xl shadow-xs ring-1 ring-black/5 shrink-0 select-none hover:opacity-95 transition-opacity"
      />

      {/* Institutional Typography Descriptor */}
      <div className="flex flex-col text-left justify-center">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="text-[13px] sm:text-[14px] font-black tracking-tight text-slate-900 dark:text-white font-['Space_Grotesk',sans-serif]">
            Control Docente
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-800/80 px-1.5 py-0.5 rounded tracking-wide font-mono">
            SEDE COMAS
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 hidden sm:inline">
            Operaciones
          </span>
        </div>
      </div>
    </div>
  );
}
