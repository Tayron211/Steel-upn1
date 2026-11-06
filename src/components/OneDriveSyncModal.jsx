import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, Check, Copy, ExternalLink, X, RefreshCw, FolderSync, Sparkles } from 'lucide-react';
import {
  linkOneDriveExcelFile,
  reauthorizeSavedExcel,
  syncAllDataToLinkedExcel,
  getLiveExcelState
} from '../utils/liveExcelSync';

export default function OneDriveSyncModal({ isOpen, onClose, liveExcel, onStatusMessage }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPs, setCopiedPs] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const liveExportUrl = `${window.location.origin}/api/export-excel`;
  const psOneLiner = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Selecciona tu CONTROL DOCENTE.xlsx en OneDrive'; $d.Filter='Excel (*.xlsx)|*.xlsx'; if($d.ShowDialog() -eq 'OK'){ $t=$d.FileName; Write-Host 'Sincronizando en vivo con:' $t -ForegroundColor Green; $h=''; while($true){ try{ $tmp=$t+'.tmp'; Invoke-WebRequest '${liveExportUrl}' -OutFile $tmp -UseBasicParsing; $nh=(Get-FileHash $tmp).Hash; if($nh -ne $h){ Copy-Item $tmp $t -Force; $h=$nh; Write-Host ('['+(Get-Date -Format 'HH:mm:ss')+'] Actualizado en OneDrive!') -ForegroundColor Cyan }; Remove-Item $tmp -Force -EA 0 }catch{}; Start-Sleep 4 } }"`;

  const state = liveExcel || getLiveExcelState();
  const canUseDirectPicker = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(liveExportUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyPs = () => {
    navigator.clipboard.writeText(psOneLiner);
    setCopiedPs(true);
    setTimeout(() => setCopiedPs(false), 2500);
  };

  const handleDirectPicker = async () => {
    setBusy(true);
    try {
      if (state.needsReauth) {
        await reauthorizeSavedExcel();
        onStatusMessage?.('✅ Excel de OneDrive reactivado en tiempo real.');
        onClose();
      } else if (state.linked) {
        await syncAllDataToLinkedExcel();
        onStatusMessage?.(`✅ Archivo "${state.fileName}" actualizado en OneDrive.`);
        onClose();
      } else {
        const handle = await linkOneDriveExcelFile();
        if (handle) {
          onStatusMessage?.(`✅ Vinculado en tiempo real a "${handle.name}" (OneDrive).`);
          onClose();
        }
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        // Si el navegador bloquea showOpenFilePicker (ej. Brave, Firefox o políticas), mostramos las opciones universales abajo
      }
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-[999999] p-3 sm:p-5 animate-backdrop-fade"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 animate-spring-up max-h-[92vh] overflow-y-auto space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight">
                Sincronizar con Excel de OneDrive en Tiempo Real
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Mantén tu archivo <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">CONTROL DOCENTE.xlsx</span> actualizado automáticamente con cada cambio
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Opción 1: Sincronizador Automático de Carpeta OneDrive (Funciona en TODOS los navegadores y actualiza desde celulares también) */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/90 dark:border-emerald-800/70 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-950 dark:text-emerald-300">
              <FolderSync className="w-4 h-4 stroke-[2.3] text-emerald-600 dark:text-emerald-400" />
              OPCIÓN 1 (Recomendada): Sincronizador Automático en tu Carpeta OneDrive
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
              24/7 EN VIVO
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
            En la carpeta de tu proyecto tienes el archivo <strong className="font-mono text-slate-900 dark:text-white">sincronizar-onedrive.bat</strong>. Al abrirlo con doble clic, eliges tu archivo <strong className="font-mono">CONTROL DOCENTE.xlsx</strong> dentro de tu carpeta de <strong>OneDrive</strong> y cada cambio hecho en la web o desde los celulares en ronda se guardará automáticamente cada 4 segundos con tus mismos colores y fórmulas.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPs}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95 shadow-xs"
            >
              {copiedPs ? <Check className="w-3.5 h-3.5 stroke-[2.6]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.3]" />}
              <span>{copiedPs ? '¡Comando copiado! Pégalo en PowerShell' : 'Copiar comando rápido para PowerShell'}</span>
            </button>
          </div>
        </div>

        {/* Opción 2: Enlace Directo en Vivo para Excel 365 / OneDrive / Power Automate */}
        <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/90 dark:border-sky-800/70 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-sky-950 dark:text-sky-300">
              <Sparkles className="w-4 h-4 stroke-[2.3] text-sky-600 dark:text-sky-400" />
              OPCIÓN 2: Enlace Directo en Tiempo Real (URL del Excel Maestro)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/70 text-sky-800 dark:text-sky-300">
              Sin instalar nada
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-300 leading-relaxed">
            Este enlace genera en tiempo real el archivo <strong className="font-mono">CONTROL DOCENTE.xlsx</strong> con toda la base de datos al segundo. Puedes usarlo en <strong>Excel (Datos → Desde la Web)</strong> o en <strong>Power Automate de OneDrive</strong> para actualizar tu archivo en la nube automáticamente:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={liveExportUrl}
              className="flex-1 h-9 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono text-slate-800 dark:text-zinc-200 select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="h-9 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95 shrink-0"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 stroke-[2.6]" /> : <Copy className="w-3.5 h-3.5 stroke-[2.3]" />}
              <span>{copiedUrl ? 'Copiado' : 'Copiar URL'}</span>
            </button>
          </div>
        </div>

        {/* Opción 3: Vinculación Directa desde el Navegador (si el navegador soporta File System Access API) */}
        {canUseDirectPicker && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                OPCIÓN 3: Vinculación directa desde este navegador
              </span>
              {state.linked && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  VINCULADO: {state.fileName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Selecciona directamente el archivo <span className="font-mono">CONTROL DOCENTE.xlsx</span> de tu carpeta local de OneDrive desde esta pestaña:
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handleDirectPicker}
              className="h-9 px-3.5 rounded-xl bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>
                {state.linked
                  ? `Guardar ahora en ${state.fileName}`
                  : 'Seleccionar archivo Excel en carpeta OneDrive'}
              </span>
            </button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

