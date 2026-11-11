import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, Check, Copy, ExternalLink, X, FolderSync, Sparkles, RefreshCw, ShieldCheck } from 'lucide-react';
import { getLiveExcelState } from '../utils/liveExcelSync';
import { useFadeModal } from '../utils/useFadeModal';

export const USER_ONEDRIVE_EXCEL_URL =
  'https://educorpperu-my.sharepoint.com/:x:/r/personal/tayron_salinas_upn_edu_pe/_layouts/15/Doc.aspx?sourcedoc=%7BE0144669-9D3C-4D3D-9586-73791364FE6B%7D&file=CONTROL%20DOCENTE%20-%20TEST.xlsx&action=default&mobileredirect=true&share=cQppRhTgPJ09TZWGc3kTZP5rEgUBQSp4dZ3Plu5UzXwYu-yFNw&wdslf=myfiles-c';

export default function OneDriveSyncModal({ isOpen, onClose, liveExcel, onStatusMessage }) {
  const fadeModal = useFadeModal(isOpen, onClose, 200);
  const [cloudStatus, setCloudStatus] = useState({ loading: true, connected: false, fileName: 'CONTROL DOCENTE - TEST.xlsx', updatedAt: null });
  const [deviceAuth, setDeviceAuth] = useState(null);
  const [authPolling, setAuthPolling] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAutoScript, setCopiedAutoScript] = useState(false);
  const [copiedPs, setCopiedPs] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    fetch('/api/onedrive/status')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setCloudStatus({
            loading: false,
            connected: j.connected,
            fileName: j.fileName || 'CONTROL DOCENTE - TEST.xlsx',
            updatedAt: j.updatedAt
          });
        } else {
          setCloudStatus((prev) => ({ ...prev, loading: false }));
        }
      })
      .catch(() => setCloudStatus((prev) => ({ ...prev, loading: false })));

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const origin = window.location.origin.includes('localhost')
    ? 'https://control-doc.pages.dev'
    : window.location.origin;

  const handleStartCloudAuth = async () => {
    try {
      setAuthPolling(true);
      const res = await fetch('/api/onedrive/device-code', { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data?.user_code) {
        setDeviceAuth(json.data);
        navigator.clipboard.writeText(json.data.user_code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 4000);
        window.open(json.data.verification_uri || 'https://login.microsoft.com/device', '_blank');

        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const pRes = await fetch('/api/onedrive/poll-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device_code: json.data.device_code })
            });
            const pJson = await pRes.json();
            if (pJson.success && pJson.connected) {
              clearInterval(pollRef.current);
              setAuthPolling(false);
              setDeviceAuth(null);
              setCloudStatus({
                loading: false,
                connected: true,
                fileName: pJson.fileName || 'CONTROL DOCENTE - Copia.xlsx',
                updatedAt: new Date().toLocaleTimeString('es-PE')
              });
              await fetch('/api/onedrive/sync', { method: 'POST' });
              onStatusMessage?.('✅ OneDrive UPN conectado automáticamente en tiempo real.');
            }
          } catch (_) {}
        }, 3500);
      }
    } catch (_) {
      setAuthPolling(false);
    }
  };

  const handleSyncCloudNow = async () => {
    setSyncingNow(true);
    try {
      const res = await fetch('/api/onedrive/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setCloudStatus((prev) => ({ ...prev, updatedAt: new Date().toLocaleTimeString('es-PE') }));
        onStatusMessage?.('✅ CONTROL DOCENTE - Copia.xlsx sincronizado en OneDrive.');
      }
    } catch (_) {}
    setSyncingNow(false);
  };

  // Script 100% compatible con TypeScript estricto de Excel Online (Sin 'any', sin 'setTimeout', sin funciones internas)
  const autoRealtimeOfficeScript = `async function main(workbook: ExcelScript.Workbook) {
  const API = "${origin}";
  let lastExcelHash = "";
  let lastWebHash = "";
  let lastWebSign = -1;

  for (let cycle = 0; cycle < 600; cycle++) {
    const shAsistRead = workbook.getWorksheet("CONTROL ASISTENCIA");
    const usedAsist = shAsistRead ? shAsistRead.getUsedRange() : undefined;
    const asistVals: (string | number | boolean)[][] = usedAsist ? usedAsist.getValues() : [];
    const asistenciaExcel: AsistenciaItem[] = [];

    for (let r = 1; r < asistVals.length; r++) {
      const row = asistVals[r];
      const aulaCell = String(row[6] || "").trim().toUpperCase();
      const docCell = String(row[10] || "").trim().toUpperCase();
      const nrcCell = String(row[7] || "").trim();
      if (!aulaCell && !docCell && !nrcCell) continue;
      if (aulaCell === "AULA") continue;
      asistenciaExcel.push({
        id: "asist_imp_" + String(r),
        pisoPabellon: String(row[0] || ""),
        sede: String(row[1] || "Comas"),
        periodo: String(row[2] || "2026-2"),
        dia: String(row[3] || "").toUpperCase(),
        horaInicioProg: String(row[4] || ""),
        horaFinalProg: String(row[5] || ""),
        aula: aulaCell,
        nrc: nrcCell,
        listaCruzada: String(row[8] || ""),
        codigoDocente: String(row[9] || ""),
        docente: docCell,
        curso: String(row[11] || "").toUpperCase(),
        carrera: String(row[12] || ""),
        horaInicioReal: String(row[13] || ""),
        horaFinalReal: String(row[14] || ""),
        asistencia: String(row[15] || "PENDIENTE").toUpperCase() || "PENDIENTE",
        puntualidad: String(row[16] || "-") || "-",
        observacion: String(row[17] || "")
      });
    }

    const shManRead = workbook.getWorksheet("HOJA DE ASISTENCIA 2026-2");
    const usedMan = shManRead ? shManRead.getUsedRange() : undefined;
    const manVals: (string | number | boolean)[][] = usedMan ? usedMan.getValues() : [];
    const manualExcel: ManualItem[] = [];

    for (let r = 1; r < manVals.length; r++) {
      const row = manVals[r];
      const nHojaVal = String(row[0] || "").trim().toUpperCase();
      if (nHojaVal.indexOf("HOJA") >= 0) continue;
      const docVal = String(row[5] || "").trim().toUpperCase();
      const nrcVal = String(row[3] || "").trim();
      const reempVal = String(row[8] || "").trim().toUpperCase();
      if (!docVal && !nrcVal && !reempVal) continue;
      manualExcel.push({
        id: "manual_2_" + String(r),
        n_hoja: nHojaVal,
        fecha: String(row[1] || ""),
        aula: String(row[2] || "").toUpperCase(),
        nrc: nrcVal,
        codigo_docente: String(row[4] || ""),
        docente: docVal,
        curso: String(row[6] || "").toUpperCase(),
        observacion: String(row[7] || ""),
        docente_reemplazo: reempVal
      });
    }

    const currentExcelHash = JSON.stringify({ a: asistenciaExcel, m: manualExcel });
    if (!lastExcelHash) {
      lastExcelHash = currentExcelHash;
    } else if (currentExcelHash !== lastExcelHash && asistenciaExcel.length > 0) {
      await fetch(API + "/api/import-excel-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asistencia: asistenciaExcel,
          manualSheets: manualExcel,
          clearExisting: true
        })
      });
      lastExcelHash = currentExcelHash;
    }

    // Puerta barata: solo traemos toda la data si la BD cambió.
    // Antes cada ciclo leía ~1.800 filas cada 2,5 s y agotaba el límite de D1.
    const signRes = await fetch(API + "/api/web-sign?wait=2000");
    const signJson = await signRes.json();
    const webSign = signJson && signJson.success ? Number(signJson.ts) : 0;
    if (webSign !== lastWebSign) {
      lastWebSign = webSign;
      const res = await fetch(API + "/api/all-data");
      const json: AllDataResponse = await res.json();

      if (json && json.success && json.data) {
      const webData = json.data;
      const currentWebHash = JSON.stringify(webData);

      if (currentWebHash !== lastWebHash) {
        const asistenciaWeb: AsistenciaItem[] = webData.asistencia || [];
        const ticketsWeb: TicketItem[] = webData.tickets || [];
        const manualWeb: ManualItem[] = webData.manualSheets || [];
        const reservasWeb: ReservaItem[] = webData.reservas || [];

        if (shAsistRead && asistenciaWeb.length > 0 && asistVals.length > 1) {
          const byKey: AsistenciaMap = {};
          for (let i = 0; i < asistenciaWeb.length; i++) {
            const item = asistenciaWeb[i];
            const k =
              String(item.nrc || "").trim() +
              "_" +
              String(item.dia || "").trim().toUpperCase() +
              "_" +
              String(item.aula || "").trim().toUpperCase();
            byKey[k] = item;
          }
          for (let r = 1; r < asistVals.length; r++) {
            const nrcRow = String(asistVals[r][7] || "").trim();
            const diaRow = String(asistVals[r][3] || "").trim().toUpperCase();
            const aulaRow = String(asistVals[r][6] || "").trim().toUpperCase();
            const match = byKey[nrcRow + "_" + diaRow + "_" + aulaRow];
            if (match) {
              const iniReal = String(match.horaInicioReal || "");
              const finReal = String(match.horaFinalReal || "");
              const asistStr = match.asistencia === "PENDIENTE" ? "" : String(match.asistencia || "");
              const puntStr = match.puntualidad === "-" ? "" : String(match.puntualidad || "");
              const obsStr = String(match.observacion || "");
              shAsistRead.getRangeByIndexes(r, 13, 1, 5).setValues([[iniReal, finReal, asistStr, puntStr, obsStr]]);
            }
          }
        }

        const shAten = workbook.getWorksheet("ATENCIONES 2026-2");
        const rowsAten: (string | number | boolean)[][] = [];
        for (let i = 0; i < ticketsWeb.length; i++) {
          const t = ticketsWeb[i];
          if (String(t.periodo || "2026-2") === "2026-1") continue;
          rowsAten.push([
            String(t.periodo || "2026-2"),
            String(t.fecha || ""),
            String(t.dia || ""),
            String(t.horaReporte || ""),
            String(t.ambiente || ""),
            String(t.piso || ""),
            String(t.pabellon || ""),
            String(t.tipoSolicitud || "ASISTENCIA TECNICA"),
            String(t.estado || "ATENDIDO"),
            String(t.usuario || "DOCENTE"),
            String(t.descripcionSolucion || ""),
            String(t.responsable || "")
          ]);
        }
        if (shAten && rowsAten.length > 0) {
          shAten.getRangeByIndexes(1, 0, rowsAten.length, 12).setValues(rowsAten);
        }

        const rowsMan: (string | number | boolean)[][] = [];
        for (let i = 0; i < manualWeb.length; i++) {
          const m = manualWeb[i];
          const mid = String(m.id || "");
          if (mid.indexOf("manual_1_") === 0) continue;
          rowsMan.push([
            String(m.n_hoja || "LN1-" + String(rowsMan.length + 1)),
            String(m.fecha || ""),
            String(m.aula || ""),
            String(m.nrc || ""),
            String(m.codigo_docente || ""),
            String(m.docente || ""),
            String(m.curso || ""),
            String(m.observacion || ""),
            String(m.docente_reemplazo || "")
          ]);
        }
        if (shManRead && rowsMan.length > 0) {
          shManRead.getRangeByIndexes(1, 0, rowsMan.length, 9).setValues(rowsMan);
        }

        const shRes = workbook.getWorksheet("RESERVAS");
        const rowsRes: (string | number | boolean)[][] = [];
        for (let i = 0; i < reservasWeb.length; i++) {
          const rv = reservasWeb[i];
          rowsRes.push([
            String(rv.responsable || ""),
            String(rv.fecha || ""),
            String(rv.dia || ""),
            String(rv.inicio || ""),
            String(rv.final || ""),
            String(rv.ambiente || ""),
            String(rv.piso_pabellon || ""),
            String(rv.motivo || ""),
            String(rv.soporte || "")
          ]);
        }
        if (shRes && rowsRes.length > 0) {
          shRes.getRangeByIndexes(1, 0, rowsRes.length, 9).setValues(rowsRes);
        }

        lastWebHash = currentWebHash;
      }
      }
    }
  }
}

interface AsistenciaItem {
  id?: string;
  pisoPabellon?: string;
  sede?: string;
  periodo?: string;
  dia?: string;
  horaInicioProg?: string;
  horaFinalProg?: string;
  aula?: string;
  nrc?: string;
  listaCruzada?: string;
  codigoDocente?: string;
  docente?: string;
  curso?: string;
  carrera?: string;
  horaInicioReal?: string;
  horaFinalReal?: string;
  asistencia?: string;
  puntualidad?: string;
  observacion?: string;
}

interface AsistenciaMap {
  [key: string]: AsistenciaItem;
}

interface TicketItem {
  periodo?: string;
  fecha?: string;
  dia?: string;
  horaReporte?: string;
  ambiente?: string;
  piso?: string;
  pabellon?: string;
  tipoSolicitud?: string;
  estado?: string;
  usuario?: string;
  descripcionSolucion?: string;
  responsable?: string;
}

interface ManualItem {
  id?: string;
  n_hoja?: string;
  fecha?: string;
  aula?: string;
  nrc?: string;
  codigo_docente?: string;
  docente?: string;
  curso?: string;
  observacion?: string;
  docente_reemplazo?: string;
}

interface ReservaItem {
  responsable?: string;
  fecha?: string;
  dia?: string;
  inicio?: string;
  final?: string;
  ambiente?: string;
  piso_pabellon?: string;
  motivo?: string;
  soporte?: string;
}

interface AllDataPayload {
  asistencia?: AsistenciaItem[];
  tickets?: TicketItem[];
  manualSheets?: ManualItem[];
  reservas?: ReservaItem[];
}

interface AllDataResponse {
  success?: boolean;
  data?: AllDataPayload;
}`;

  const psOneLiner = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'd:\\Users\\Arianny\\Downloads\\PROYECTOS\\steel-pro1'; .\\sincronizar-onedrive.bat"`;

  const handleCopyAutoScript = () => {
    navigator.clipboard.writeText(autoRealtimeOfficeScript);
    setCopiedAutoScript(true);
    setTimeout(() => setCopiedAutoScript(false), 2500);
  };

  const handleCopyPs = () => {
    navigator.clipboard.writeText(psOneLiner);
    setCopiedPs(true);
    setTimeout(() => setCopiedPs(false), 2500);
  };

  if (!fadeModal.shouldRender) return null;

  return createPortal(
    <div
      className={`fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-[999999] p-3 sm:p-5 ${fadeModal.backdropClass}`}
      onClick={() => fadeModal.requestClose(onClose)}
    >
      <div
        className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 ${fadeModal.modalClass} max-h-[92vh] overflow-y-auto space-y-3.5`}
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
                Sincronización Automática con OneDrive UPN
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug truncate">
                Archivo: <span className="font-mono font-bold text-sky-600 dark:text-sky-400">CONTROL DOCENTE - TEST.xlsx</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fadeModal.requestClose(onClose)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition shrink-0"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* CONEXIÓN DIRECTA EN LA NUBE CON MICROSOFT 365 (SIN SCRIPTS) */}
        <div className="p-4 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border-2 border-sky-300 dark:border-sky-700 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 stroke-[2.5] text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="text-xs font-black text-sky-950 dark:text-sky-200 leading-snug">
                CONEXIÓN DIRECTA MICROSOFT 365 (Sin pegar scripts)
              </span>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 text-center leading-none ${
              cloudStatus.connected
                ? 'bg-emerald-500 text-white'
                : 'bg-sky-600 text-white'
            }`}>
              {cloudStatus.connected ? 'CONECTADO 24/7' : '1 CLIC'}
            </span>
          </div>

          {cloudStatus.connected ? (
            <div className="space-y-2.5">
              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                ✅ Tu cuenta <span className="font-mono">tayron.salinas@upn.edu.pe</span> está vinculada directamente en la nube con <strong className="font-mono">{cloudStatus.fileName}</strong>. Cada cambio se guarda automáticamente.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={syncingNow}
                  onClick={handleSyncCloudNow}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95"
                >
                  <RefreshCw className={`w-3.5 h-3.5 stroke-[2.4] ${syncingNow ? 'animate-spin' : ''}`} />
                  <span>{syncingNow ? 'Sincronizando en OneDrive...' : 'Sincronizar Ahora con OneDrive'}</span>
                </button>
                <a
                  href={USER_ONEDRIVE_EXCEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 text-white text-xs font-black inline-flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 stroke-[2.4]" />
                  <span>Abrir Excel en OneDrive</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Conecta directamente el servidor con tu cuenta <strong className="font-mono text-slate-900 dark:text-white">tayron.salinas@upn.edu.pe</strong> para que actualice tu archivo <strong className="font-mono text-slate-900 dark:text-white">CONTROL DOCENTE - TEST.xlsx</strong> solo en la nube sin usar scripts ni descargas:
              </p>

              {deviceAuth ? (
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-sky-200 dark:border-sky-800 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                    Pega este código en la pestaña de Microsoft que se abrió (ya está copiado en tu portapapeles):
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center font-mono text-base font-black tracking-widest text-amber-950 dark:text-amber-300 select-all">
                      {deviceAuth.user_code}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(deviceAuth.user_code);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="h-10 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black inline-flex items-center gap-1.5"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode ? 'Copiado' : 'Copiar Código'}</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold animate-pulse">
                    ⏳ Esperando a que inicies sesión en Microsoft para vincular tu Excel automáticamente...
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartCloudAuth}
                    className="h-9 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black inline-flex items-center gap-2 transition active:scale-95 shadow-xs"
                  >
                    <Cloud className="w-4 h-4 stroke-[2.4]" />
                    <span>Conectar mi OneDrive UPN en 1 Clic (Sin Scripts)</span>
                  </button>
                  <a
                    href={USER_ONEDRIVE_EXCEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 stroke-[2.3]" />
                    <span>Ver mi Excel</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => fadeModal.requestClose(onClose)}
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
