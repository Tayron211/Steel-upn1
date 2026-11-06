import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, Check, Copy, ExternalLink, X, FolderSync, Sparkles, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import {
  linkOneDriveExcelFile,
  reauthorizeSavedExcel,
  syncAllDataToLinkedExcel,
  getLiveExcelState
} from '../utils/liveExcelSync';

export const USER_ONEDRIVE_EXCEL_URL =
  'https://educorpperu-my.sharepoint.com/:x:/r/personal/tayron_salinas_upn_edu_pe/_layouts/15/Doc.aspx?sourcedoc=%7B43927736-578C-4F3E-91C2-C9FD6E2CE448%7D&file=CONTROL%20DOCENTE%20-%20Copia.xlsx&action=default&mobileredirect=true&share=cQo2d5JDjFc-T5HCyf1uLORIEgUB1-7s8tpfsE3FwtzKMreVQA';

export default function OneDriveSyncModal({ isOpen, onClose, liveExcel, onStatusMessage }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPs, setCopiedPs] = useState(false);
  const [copiedScriptSave, setCopiedScriptSave] = useState(false);
  const [copiedScriptPull, setCopiedScriptPull] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const origin = window.location.origin.includes('localhost')
    ? 'https://steel-upn1.pages.dev'
    : window.location.origin;
  const liveExportUrl = `${origin}/api/export-excel`;

  // Script 1: Guardar cambios de la App Web directamente dentro de CONTROL DOCENTE - Copia.xlsx en Excel Online (Automatizar -> Nuevo script)
  const officeScriptWebToExcel = `async function main(workbook: ExcelScript.Workbook) {
  const res = await fetch("${origin}/api/all-data");
  const json = await res.json();
  if (!json.success) return;
  const { asistencia = [], tickets = [], manualSheets = [], reservas = [] } = json.data;

  // 1. Actualizar CONTROL ASISTENCIA (Horarios, Asistencia, Puntualidad, Observación)
  const shAsist = workbook.getWorksheet("CONTROL ASISTENCIA");
  if (shAsist && asistencia.length > 0) {
    const used = shAsist.getUsedRange();
    const vals = used ? used.getValues() : [];
    const byKey = new Map<string, any>();
    for (const a of asistencia) {
      const k = \`\${String(a.nrc || "").trim()}_\${String(a.dia || "").trim().toUpperCase()}_\${String(a.aula || "").trim().toUpperCase()}\`;
      byKey.set(k, a);
    }
    for (let r = 1; r < vals.length; r++) {
      const nrc = String(vals[r][7] || "").trim();
      const dia = String(vals[r][3] || "").trim().toUpperCase();
      const aula = String(vals[r][6] || "").trim().toUpperCase();
      const match = byKey.get(\`\${nrc}_\${dia}_\${aula}\`);
      if (match) {
        if (match.horaInicioReal) shAsist.getCell(r, 13).setValue(match.horaInicioReal);
        if (match.horaFinalReal) shAsist.getCell(r, 14).setValue(match.horaFinalReal);
        shAsist.getCell(r, 15).setValue(match.asistencia === "PENDIENTE" ? "" : (match.asistencia || ""));
        shAsist.getCell(r, 16).setValue(match.puntualidad === "-" ? "" : (match.puntualidad || ""));
        shAsist.getCell(r, 17).setValue(match.observacion || "");
      }
    }
  }

  // 2. Actualizar ATENCIONES 2026-2 (incluye columna J = USUARIO DOCENTE/ALUMNO)
  const shAten = workbook.getWorksheet("ATENCIONES 2026-2");
  const t20262 = tickets.filter((t: any) => String(t.periodo || "2026-2") !== "2026-1");
  if (shAten && t20262.length > 0) {
    const rows = t20262.map((t: any) => [
      t.periodo || "2026-2",
      t.fecha || "",
      t.dia || "",
      t.horaReporte || "",
      t.ambiente || "",
      t.piso || "",
      t.pabellon || "",
      t.tipoSolicitud || "ASISTENCIA TÉCNICA",
      t.estado || "ATENDIDO",
      t.usuario || "DOCENTE",
      t.descripcionSolucion || "",
      t.responsable || ""
    ]);
    shAten.getRangeByIndexes(1, 0, rows.length, 12).setValues(rows);
  }

  // 3. Actualizar HOJA DE ASISTENCIA 2026-2 (incluye columna I = DOCENTE REEMPLAZANTE)
  const shMan = workbook.getWorksheet("HOJA DE ASISTENCIA 2026-2");
  const m20262 = manualSheets.filter((m: any) => !String(m.id || "").startsWith("manual_1_"));
  if (shMan && m20262.length > 0) {
    const rows = m20262.map((m: any, i: number) => [
      m.n_hoja || \`LN1-\${String(i + 1).padStart(3, "0")}\`,
      m.fecha || "",
      m.aula || "",
      m.nrc || "",
      m.codigo_docente || "",
      m.docente || "",
      m.curso || "",
      m.observacion || "",
      m.docente_reemplazo || ""
    ]);
    shMan.getRangeByIndexes(1, 0, rows.length, 9).setValues(rows);
  }

  // 4. Actualizar RESERVAS
  const shRes = workbook.getWorksheet("RESERVAS");
  if (shRes && reservas.length > 0) {
    const rows = reservas.map((r: any) => [
      r.responsable || "",
      r.fecha || "",
      r.dia || "",
      r.inicio || "",
      r.final || "",
      r.ambiente || "",
      r.piso_pabellon || "",
      r.motivo || "",
      r.soporte || ""
    ]);
    shRes.getRangeByIndexes(1, 0, rows.length, 9).setValues(rows);
  }
  console.log("✅ CONTROL DOCENTE - Copia.xlsx actualizado en vivo desde la App Web!");
}`;

  // Script 2: Jalar toda la data desde CONTROL DOCENTE - Copia.xlsx en Excel Online hacia la App Web
  const officeScriptExcelToWeb = `async function main(workbook: ExcelScript.Workbook) {
  const shAsist = workbook.getWorksheet("CONTROL ASISTENCIA");
  const asistVals = shAsist ? shAsist.getUsedRange()?.getValues() || [] : [];
  const asistencia = [];
  for (let r = 1; r < asistVals.length; r++) {
    const row = asistVals[r];
    if (!row[6] && !row[10] && !row[7]) continue;
    asistencia.push({
      id: \`asist_imp_\${r}\`,
      pisoPabellon: String(row[0] || ""),
      sede: String(row[1] || "Comas"),
      periodo: String(row[2] || "2026-2"),
      dia: String(row[3] || "").toUpperCase(),
      horaInicioProg: String(row[4] || ""),
      horaFinalProg: String(row[5] || ""),
      aula: String(row[6] || "").toUpperCase(),
      nrc: String(row[7] || ""),
      listaCruzada: String(row[8] || ""),
      codigoDocente: String(row[9] || ""),
      docente: String(row[10] || "").toUpperCase(),
      curso: String(row[11] || "").toUpperCase(),
      carrera: String(row[12] || ""),
      horaInicioReal: String(row[13] || ""),
      horaFinalReal: String(row[14] || ""),
      asistencia: String(row[15] || "PENDIENTE").toUpperCase() || "PENDIENTE",
      puntualidad: String(row[16] || "-") || "-",
      observacion: String(row[17] || "")
    });
  }

  const shMan = workbook.getWorksheet("HOJA DE ASISTENCIA 2026-2");
  const manVals = shMan ? shMan.getUsedRange()?.getValues() || [] : [];
  const manualSheets = [];
  for (let r = 1; r < manVals.length; r++) {
    const row = manVals[r];
    if (!row[5] && !row[3] && !row[8]) continue;
    manualSheets.push({
      id: \`manual_2_\${r}\`,
      n_hoja: String(row[0] || "").toUpperCase(),
      fecha: String(row[1] || ""),
      aula: String(row[2] || "").toUpperCase(),
      nrc: String(row[3] || ""),
      codigo_docente: String(row[4] || ""),
      docente: String(row[5] || "").toUpperCase(),
      curso: String(row[6] || "").toUpperCase(),
      observacion: String(row[7] || ""),
      docente_reemplazo: String(row[8] || "").toUpperCase()
    });
  }

  await fetch("${origin}/api/import-excel-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asistencia, manualSheets, clearExisting: true })
  });
  console.log("✅ Data jalada desde CONTROL DOCENTE - Copia.xlsx hacia la App Web!");
}`;

  const psOneLiner = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Title='Selecciona tu CONTROL DOCENTE - Copia.xlsx en OneDrive'; $d.Filter='Excel (*.xlsx)|*.xlsx'; if($d.ShowDialog() -eq 'OK'){ $t=$d.FileName; Write-Host 'Sincronizando en vivo con:' $t -ForegroundColor Green; $h=''; while($true){ try{ $tmp=$t+'.tmp'; Invoke-WebRequest '${liveExportUrl}' -OutFile $tmp -UseBasicParsing; $nh=(Get-FileHash $tmp).Hash; if($nh -ne $h){ Copy-Item $tmp $t -Force; $h=$nh; Write-Host ('['+(Get-Date -Format 'HH:mm:ss')+'] Actualizado en OneDrive!') -ForegroundColor Cyan }; Remove-Item $tmp -Force -EA 0 }catch{}; Start-Sleep 4 } }"`;

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

  const handleCopyScriptSave = () => {
    navigator.clipboard.writeText(officeScriptWebToExcel);
    setCopiedScriptSave(true);
    setTimeout(() => setCopiedScriptSave(false), 2500);
  };

  const handleCopyScriptPull = () => {
    navigator.clipboard.writeText(officeScriptExcelToWeb);
    setCopiedScriptPull(true);
    setTimeout(() => setCopiedScriptPull(false), 2500);
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
      // Fallback silencioso a las opciones en la ventana
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
        className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 animate-spring-up max-h-[92vh] overflow-y-auto space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/80 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white tracking-tight leading-snug">
                OneDrive Conectado: CONTROL DOCENTE - Copia.xlsx
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug truncate">
                Cuenta vinculada: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">tayron.salinas@upn.edu.pe</span>
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

        {/* Tarjeta del Archivo OneDrive del Usuario */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/90 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                CONTROL DOCENTE - Copia.xlsx
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              educorpperu-my.sharepoint.com (OneDrive UPN)
            </p>
          </div>
          <a
            href={USER_ONEDRIVE_EXCEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5 stroke-[2.4] shrink-0" />
            <span>Abrir mi Excel en OneDrive</span>
          </a>
        </div>

        {/* OPCIÓN 1: Directo en tu pestaña de Excel Online (Automatizar -> Nuevo script) */}
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/70 space-y-2.5">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 stroke-[2.4] text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-black text-amber-950 dark:text-amber-300 leading-snug">
                MODO 1 (100% Nube en tu enlace SharePoint): Pestaña "Automatizar"
              </span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 whitespace-nowrap shrink-0 text-center leading-none">
              BIDIRECCIONAL
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            Dentro de tu archivo <strong className="font-mono text-slate-900 dark:text-white">CONTROL DOCENTE - Copia.xlsx</strong> abierto en OneDrive, haz clic arriba en la pestaña <strong>Automatizar → Nuevo script</strong>, pega cualquiera de estos dos scripts y dale a <strong>Ejecutar</strong>:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyScriptSave}
              className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap"
            >
              {copiedScriptSave ? <Check className="w-3.5 h-3.5 stroke-[2.6] shrink-0" /> : <ArrowDownToLine className="w-3.5 h-3.5 stroke-[2.4] shrink-0" />}
              <span>{copiedScriptSave ? '¡Script copiado!' : '1. Guardar App → Excel OneDrive'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyScriptPull}
              className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 transition active:scale-95 whitespace-nowrap"
            >
              {copiedScriptPull ? <Check className="w-3.5 h-3.5 stroke-[2.6] shrink-0" /> : <ArrowUpFromLine className="w-3.5 h-3.5 stroke-[2.4] shrink-0" />}
              <span>{copiedScriptPull ? '¡Script copiado!' : '2. Jalar Excel OneDrive → App'}</span>
            </button>
          </div>
        </div>

        {/* OPCIÓN 2: Sincronizador Automático de Carpeta OneDrive en PC */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/90 dark:border-emerald-800/70 space-y-2.5">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FolderSync className="w-4 h-4 stroke-[2.4] text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-black text-emerald-950 dark:text-emerald-300 leading-snug">
                MODO 2 (Automático cada 4s): Sincronizador OneDrive en PC
              </span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white whitespace-nowrap shrink-0 text-center leading-none">
              24/7 EN VIVO
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            Si tienes tu carpeta <strong>OneDrive - Universidad Privada del Norte</strong> sincronizada en tu PC, abre con doble clic <strong className="font-mono text-slate-900 dark:text-white">sincronizar-onedrive.bat</strong> en la carpeta del proyecto y selecciona tu archivo <strong className="font-mono text-slate-900 dark:text-white">CONTROL DOCENTE - Copia.xlsx</strong>. Se actualizará solo cada 4 segundos con tus mismos colores y fórmulas.
          </p>
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleCopyPs}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center justify-center gap-2 transition active:scale-95 shadow-xs"
            >
              {copiedPs ? <Check className="w-3.5 h-3.5 stroke-[2.6] shrink-0" /> : <Copy className="w-3.5 h-3.5 stroke-[2.3] shrink-0" />}
              <span>{copiedPs ? '¡Comando copiado! Pégalo en PowerShell' : 'Copiar comando rápido para PowerShell'}</span>
            </button>
          </div>
        </div>

        {/* OPCIÓN 3: URL en Tiempo Real del Excel Maestro */}
        <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200/90 dark:border-sky-800/70 space-y-2">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <span className="text-xs font-black text-sky-950 dark:text-sky-300 leading-snug">
              URL en Vivo del Excel Maestro (Para Power Automate / Datos desde la Web)
            </span>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/80 text-sky-800 dark:text-sky-200 border border-sky-200/60 dark:border-sky-700/60 whitespace-nowrap shrink-0 text-center leading-none">
              En tiempo real
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={liveExportUrl}
              className="flex-1 h-9 px-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs font-mono text-slate-800 dark:text-zinc-200 select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="h-9 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 whitespace-nowrap"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 stroke-[2.6] shrink-0" /> : <Copy className="w-3.5 h-3.5 stroke-[2.3] shrink-0" />}
              <span>{copiedUrl ? 'Copiado' : 'Copiar URL'}</span>
            </button>
          </div>
        </div>

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
