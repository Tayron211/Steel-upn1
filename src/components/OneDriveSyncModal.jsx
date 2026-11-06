import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, Check, Copy, ExternalLink, X, FolderSync, Sparkles, RefreshCw } from 'lucide-react';
import {
  linkOneDriveExcelFile,
  reauthorizeSavedExcel,
  syncAllDataToLinkedExcel,
  getLiveExcelState
} from '../utils/liveExcelSync';

export const USER_ONEDRIVE_EXCEL_URL =
  'https://educorpperu-my.sharepoint.com/:x:/r/personal/tayron_salinas_upn_edu_pe/_layouts/15/Doc.aspx?sourcedoc=%7B43927736-578C-4F3E-91C2-C9FD6E2CE448%7D&file=CONTROL%20DOCENTE%20-%20Copia.xlsx&action=default&mobileredirect=true&share=cQo2d5JDjFc-T5HCyf1uLORIEgUB1-7s8tpfsE3FwtzKMreVQA';

export default function OneDriveSyncModal({ isOpen, onClose, liveExcel, onStatusMessage }) {
  const [copiedAutoScript, setCopiedAutoScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPs, setCopiedPs] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const origin = window.location.origin.includes('localhost')
    ? 'https://steel-upn1.pages.dev'
    : window.location.origin;
  const liveExportUrl = `${origin}/api/export-excel`;

  // Script Único Automático Bidireccional en Tiempo Real para Excel Online (Automatizar -> Nuevo script)
  const autoRealtimeOfficeScript = `async function main(workbook: ExcelScript.Workbook) {
  const API = "${origin}";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function readExcelSnapshot() {
    const shAsist = workbook.getWorksheet("CONTROL ASISTENCIA");
    const asistVals = shAsist ? shAsist.getUsedRange()?.getValues() || [] : [];
    const asistencia = [];
    for (let r = 1; r < asistVals.length; r++) {
      const row = asistVals[r];
      if (!row[6] && !row[10] && !row[7]) continue;
      if (String(row[6] || "").toUpperCase() === "AULA") continue;
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
      if (String(row[0] || "").toUpperCase().includes("HOJA")) continue;
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
    return { asistencia, manualSheets, hash: JSON.stringify({ asistencia, manualSheets }) };
  }

  function writeWebToExcel(data: any) {
    const { asistencia = [], tickets = [], manualSheets = [], reservas = [] } = data;
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

    const shAten = workbook.getWorksheet("ATENCIONES 2026-2");
    const t20262 = tickets.filter((t: any) => String(t.periodo || "2026-2") !== "2026-1");
    if (shAten && t20262.length > 0) {
      const rows = t20262.map((t: any) => [
        t.periodo || "2026-2", t.fecha || "", t.dia || "", t.horaReporte || "",
        t.ambiente || "", t.piso || "", t.pabellon || "",
        t.tipoSolicitud || "ASISTENCIA TÉCNICA", t.estado || "ATENDIDO",
        t.usuario || "DOCENTE", t.descripcionSolucion || "", t.responsable || ""
      ]);
      shAten.getRangeByIndexes(1, 0, rows.length, 12).setValues(rows);
    }

    const shMan = workbook.getWorksheet("HOJA DE ASISTENCIA 2026-2");
    const m20262 = manualSheets.filter((m: any) => !String(m.id || "").startsWith("manual_1_"));
    if (shMan && m20262.length > 0) {
      const rows = m20262.map((m: any, i: number) => [
        m.n_hoja || \`LN1-\${String(i + 1).padStart(3, "0")}\`, m.fecha || "", m.aula || "",
        m.nrc || "", m.codigo_docente || "", m.docente || "", m.curso || "",
        m.observacion || "", m.docente_reemplazo || ""
      ]);
      shMan.getRangeByIndexes(1, 0, rows.length, 9).setValues(rows);
    }

    const shRes = workbook.getWorksheet("RESERVAS");
    if (shRes && reservas.length > 0) {
      const rows = reservas.map((r: any) => [
        r.responsable || "", r.fecha || "", r.dia || "", r.inicio || "", r.final || "",
        r.ambiente || "", r.piso_pabellon || "", r.motivo || "", r.soporte || ""
      ]);
      shRes.getRangeByIndexes(1, 0, rows.length, 9).setValues(rows);
    }
  }

  let lastExcelHash = readExcelSnapshot().hash;
  let lastWebHash = "";

  console.log("🟢 Sincronización bidireccional en tiempo real activa...");
  for (let cycle = 0; cycle < 1200; cycle++) {
    const snap = readExcelSnapshot();
    if (snap.hash !== lastExcelHash && snap.asistencia.length > 0) {
      await fetch(\`\${API}/api/import-excel-data\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asistencia: snap.asistencia, manualSheets: snap.manualSheets, clearExisting: true })
      });
      lastExcelHash = snap.hash;
      console.log("⬆️ Cambio en Excel enviado a la Web App!");
    }

    const res = await fetch(\`\${API}/api/all-data\`);
    const json = await res.json();
    if (json.success && json.data) {
      const webHash = JSON.stringify(json.data);
      if (webHash !== lastWebHash) {
        writeWebToExcel(json.data);
        lastWebHash = webHash;
        lastExcelHash = readExcelSnapshot().hash;
        console.log("⬇️ Cambio en la Web App guardado en Excel OneDrive!");
      }
    }
    await sleep(3000);
  }
}`;

  const psOneLiner = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location '${
    typeof window !== 'undefined' ? 'd:\\Users\\Arianny\\Downloads\\PROYECTOS\\steel-pro1' : '.'
  }'; .\\sincronizar-onedrive.bat"`;

  const state = liveExcel || getLiveExcelState();

  const handleCopyAutoScript = () => {
    navigator.clipboard.writeText(autoRealtimeOfficeScript);
    setCopiedAutoScript(true);
    setTimeout(() => setCopiedAutoScript(false), 2500);
  };

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
                Sincronización Bidireccional en Tiempo Real
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug truncate">
                Archivo: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">CONTROL DOCENTE - Copia.xlsx</span>
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
                CONTROL DOCENTE - Copia.xlsx (tayron.salinas@upn.edu.pe)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              Guarda y jala automáticamente cada cambio cada 3 segundos
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

        {/* MODO 1: En tu pestaña de OneDrive (1 solo Script que guarda y jala en bucle continuo) */}
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/70 space-y-2.5">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 stroke-[2.4] text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-black text-amber-950 dark:text-amber-300 leading-snug">
                MODO 1 (En Excel Online): Bucle Automático en Tiempo Real
              </span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 whitespace-nowrap shrink-0 text-center leading-none">
              JALA Y GUARDA SOLO
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            En tu pestaña abierta de <strong className="font-mono text-slate-900 dark:text-white">CONTROL DOCENTE - Copia.xlsx</strong>, ve a <strong>Automatizar → Nuevo script</strong>, pega este único script y dale a <strong>Ejecutar</strong> una sola vez: quedará escuchando cada 3 segundos; <strong>si cambias algo en el Excel lo sube solo a la Web, y si cambias algo en la Web lo guarda solo en el Excel</strong>:
          </p>
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleCopyAutoScript}
              className="w-full sm:w-auto h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap shadow-xs"
            >
              {copiedAutoScript ? <Check className="w-3.5 h-3.5 stroke-[2.6] shrink-0" /> : <RefreshCw className="w-3.5 h-3.5 stroke-[2.4] shrink-0" />}
              <span>{copiedAutoScript ? '¡Script Automático 24/7 Copiado!' : 'Copiar Script Automático en Tiempo Real (Guarda y Jala)'}</span>
            </button>
          </div>
        </div>

        {/* MODO 2: Sincronizador Bidireccional Automático en PC */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/90 dark:border-emerald-800/70 space-y-2.5">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FolderSync className="w-4 h-4 stroke-[2.4] text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-black text-emerald-950 dark:text-emerald-300 leading-snug">
                MODO 2 (En Segundo Plano en tu PC): sincronizar-onedrive.bat
              </span>
            </div>
            <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white whitespace-nowrap shrink-0 text-center leading-none">
              ACTIVO CADA 3S
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            El motor <strong className="font-mono text-slate-900 dark:text-white">sincronizar-onedrive.bat</strong> vigila tu archivo Excel cada 3 segundos: si modificas y guardas el Excel en tu PC/OneDrive, <strong>jala los datos automáticamente a la Web</strong>; y si registras algo en la Web o celulares, <strong>actualiza el Excel automáticamente</strong>.
          </p>
          <div className="pt-0.5">
            <button
              type="button"
              onClick={handleCopyPs}
              className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center justify-center gap-2 transition active:scale-95 shadow-xs"
            >
              {copiedPs ? <Check className="w-3.5 h-3.5 stroke-[2.6] shrink-0" /> : <Copy className="w-3.5 h-3.5 stroke-[2.3] shrink-0" />}
              <span>{copiedPs ? '¡Comando copiado!' : 'Copiar comando para iniciar sincronizador en PC'}</span>
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
