import React from 'react';

/**
 * Official UPN Identity Brand Component
 * Uses the authentic official vector logo from Universidad Privada del Norte (upn.edu.pe)
 */
export default function UpnLogo({ variant = 'horizontal', className = '', size = 'md' }) {
  if (variant === 'badge') {
    return (
      <div className={`relative inline-flex items-center justify-center rounded-xl overflow-hidden shadow-xs shrink-0 select-none ${
        size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9 sm:h-10 sm:w-10'
      } ${className}`}>
        <img 
          src="/logo-upn-oficial.svg" 
          alt="UPN Logo Oficial" 
          className="h-full w-full object-contain rounded-xl"
        />
      </div>
    );
  }

  if (variant === 'logo-only') {
    return (
      <img 
        src="/logo-upn-oficial.svg" 
        alt="Universidad Privada del Norte" 
        className={`h-9 w-9 sm:h-10 sm:w-10 aspect-square object-contain rounded-xl shadow-xs shrink-0 select-none ${className}`}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 min-w-0 select-none ${className}`}>
      {/* Official UPN Vector Chevron Arrow ("La Flecha") directly from upn.edu.pe */}
      <img 
        src="/logo-upn-oficial.svg" 
        alt="UPN" 
        className="h-9 sm:h-10 w-9 sm:w-10 aspect-square object-contain rounded-xl shadow-xs ring-1 ring-black/5 shrink-0 select-none hover:opacity-95 transition-opacity"
      />

      {/* Institutional Typography Descriptor */}
      <div className="flex flex-col text-left justify-center min-w-0">
        <div className="flex items-center gap-1.5 leading-tight">
          <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white font-['Space_Grotesk',sans-serif] whitespace-nowrap truncate">
            Control Docente
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] sm:text-xs font-extrabold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-800/80 px-2 py-0.5 rounded-md tracking-wide font-mono whitespace-nowrap shrink-0">
            SEDE COMAS
          </span>
          <span className="text-xs sm:text-[13px] font-bold text-slate-600 dark:text-zinc-300 hidden sm:inline whitespace-nowrap">
            Operaciones
          </span>
        </div>
      </div>
    </div>
  );
}
