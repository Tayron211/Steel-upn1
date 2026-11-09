import React, { useState, useEffect, useRef } from 'react';
import { createDbChangeGate } from '../utils/webSignGate';
import {
  X,
  Check,
  PenTool,
  QrCode,
  FileText,
  Printer,
  Copy,
  Download,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import QRCode from 'qrcode';
import SignatureCanvas from './SignatureCanvas';
import CustomSelect from './CustomSelect';
import { useAssistants } from '../utils/assistants';
import { generateCargoPdf, formatCargoNumber } from '../utils/cargoPdfGenerator';
import { useFadeModal } from '../utils/useFadeModal';

export default function SignatureModal({
  ticket,
  isOpen,
  onClose,
  onSaveSignatures,
  defaultAssistant = 'TAYRON SALINAS'
}) {
  const signModalFade = useFadeModal(isOpen && Boolean(ticket), onClose, 200);
  const asistentes = useAssistants();
  if (!signModalFade.shouldRender || !ticket) return null;

  // Cargo Folio Number (formato correlativo 5 dígitos desde 00001)
  const cargoNum = formatCargoNumber(ticket);

  // Señor(es) - Recipient
  const [senorEs, setSenorEs] = useState(() => {
    if (ticket.recibidoPor) return ticket.recibidoPor;
    const match = (ticket.descripcionSolucion || '').match(/\[(🎓\s*ALUMNO|👨‍🏫\s*DOCENTE):\s*([^\]]+)\]/i);
    if (match && match[2]) return match[2].trim();
    return '';
  });

  // Remitimos con el portador - Material description
  const [remitimosConElPortador, setRemitimosConElPortador] = useState(() => {
    const cleanDesc = (ticket.descripcionSolucion || ticket.tipoSolicitud || '')
      .replace(/\[(🎓|👨‍🏫)?\s*(ALUMNO|DOCENTE)(?::[^\]]+)?\]/gi, '')
      .trim();
    return cleanDesc || ticket.tipoSolicitud || 'PROYECTOR';
  });

  // Names for Entregué & Recibí
  const [entregadoPor, setEntregadoPor] = useState(() => {
    return ticket.entregadoPor || ticket.responsable || defaultAssistant;
  });

  // Signatures State with persistent fallback in localStorage so they are NEVER lost
  const [firmaEntrega, setFirmaEntrega] = useState(() => {
    if (ticket.firmaEntrega) return ticket.firmaEntrega;
    try {
      const local = localStorage.getItem(`upn_sign_entrega_${ticket.id}`);
      if (local) return local;
      // Optional: global saved staff signature
      const staffSign = localStorage.getItem('upn_staff_signature');
      return staffSign || null;
    } catch (e) {
      return null;
    }
  });

  const [firmaRecepcion, setFirmaRecepcion] = useState(() => {
    if (ticket.firmaRecepcion) return ticket.firmaRecepcion;
    try {
      return localStorage.getItem(`upn_sign_recepcion_${ticket.id}`) || null;
    } catch (e) {
      return null;
    }
  });

  // Mode toggles: edit signature directly in modal
  const [isEditingEntrega, setIsEditingEntrega] = useState(() => !ticket.firmaEntrega);
  const [isEditingRecepcion, setIsEditingRecepcion] = useState(() => !ticket.firmaRecepcion);

  // QR Code drawer toggle
  const [showQrDrawer, setShowQrDrawer] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasEntregaRef = useRef(null);
  const canvasRecepcionRef = useRef(null);
  const dbGateRef = useRef(null);
  if (!dbGateRef.current) dbGateRef.current = createDbChangeGate();

  // Mobile signing URL
  const getMobileSignUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}#firmar-${ticket.id}`;
  };

  useEffect(() => {
    const url = getMobileSignUrl();
    if (!url) return;
    QRCode.toDataURL(url, {
      width: 240,
      margin: 1.5,
      color: { dark: '#0f172a', light: '#ffffff' }
    })
      .then(data => setQrCodeDataUrl(data))
      .catch(err => console.error(err));
  }, [ticket.id]);

  // Sincronización en Vivo: Si firman desde el celular o en otra pestaña, se actualiza automáticamente en pantalla
  useEffect(() => {
    if (!ticket || !ticket.id) return;

    const handleStorageEvent = (e) => {
      if (e.key === `upn_sign_recepcion_${ticket.id}` && e.newValue) {
        setFirmaRecepcion(e.newValue);
        setIsEditingRecepcion(false);
      }
      if (e.key === `upn_sign_entrega_${ticket.id}` && e.newValue) {
        setFirmaEntrega(e.newValue);
        setIsEditingEntrega(false);
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    // Consulta periódica por si el celular firmó y envió al backend
    const poller = setInterval(async () => {
      try {
        if (!(await dbGateRef.current())) return; // sin escrituras nuevas -> no gastar lecturas de D1

        // 1 fila en vez de toda la tabla; si el backend local no tiene la ruta,
        // se cae al listado completo (comportamiento anterior).
        let current = null;
        const res = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) current = json.data;
        }
        if (!current) {
          const listRes = await fetch('/api/tickets');
          if (listRes.ok) {
            const json = await listRes.json();
            if (json.success && Array.isArray(json.data)) {
              current = json.data.find(t => t.id === ticket.id) || null;
            }
          }
        }

        if (current) {
          if (current.firmaRecepcion && current.firmaRecepcion !== firmaRecepcion) {
            setFirmaRecepcion(current.firmaRecepcion);
            setIsEditingRecepcion(false);
            try { localStorage.setItem(`upn_sign_recepcion_${ticket.id}`, current.firmaRecepcion); } catch (e) { }
          }
          if (current.firmaEntrega && current.firmaEntrega !== firmaEntrega) {
            setFirmaEntrega(current.firmaEntrega);
            setIsEditingEntrega(false);
            try { localStorage.setItem(`upn_sign_entrega_${ticket.id}`, current.firmaEntrega); } catch (e) { }
          }
          if (current.recibidoPor && !senorEs) {
            setSenorEs(current.recibidoPor);
          }
        }
      } catch (err) { }
    }, 15000);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      clearInterval(poller);
    };
  }, [ticket.id, firmaRecepcion, firmaEntrega, senorEs]);

  // Handle signature change and persist immediately
  const handleFirmaEntregaChange = (dataUrl) => {
    setFirmaEntrega(dataUrl);
    try {
      if (dataUrl) {
        localStorage.setItem(`upn_sign_entrega_${ticket.id}`, dataUrl);
        localStorage.setItem('upn_staff_signature', dataUrl); // save staff default
      }
    } catch (e) { }
  };

  const handleFirmaRecepcionChange = (dataUrl) => {
    setFirmaRecepcion(dataUrl);
    try {
      if (dataUrl) {
        localStorage.setItem(`upn_sign_recepcion_${ticket.id}`, dataUrl);
      }
    } catch (e) { }
  };

  // Save changes
  const handleSaveAll = async () => {
    setSaving(true);
    let finalEntrega = firmaEntrega;
    let finalRecepcion = firmaRecepcion;

    if (canvasEntregaRef.current && canvasEntregaRef.current.hasContent()) {
      finalEntrega = canvasEntregaRef.current.getDataUrl();
    }
    if (canvasRecepcionRef.current && canvasRecepcionRef.current.hasContent()) {
      finalRecepcion = canvasRecepcionRef.current.getDataUrl();
    }

    const payload = {
      firmaEntrega: finalEntrega,
      firmaRecepcion: finalRecepcion,
      entregadoPor: entregadoPor.trim() || 'Operaciones Sede',
      recibidoPor: senorEs.trim() || 'Solicitante',
      descripcionSolucion: remitimosConElPortador.trim() || ticket.descripcionSolucion,
      fechaFirma: new Date().toISOString()
    };

    // Keep locally
    try {
      if (finalEntrega) localStorage.setItem(`upn_sign_entrega_${ticket.id}`, finalEntrega);
      if (finalRecepcion) localStorage.setItem(`upn_sign_recepcion_${ticket.id}`, finalRecepcion);
    } catch (e) { }

    try {
      await onSaveSignatures(ticket.id, payload);
      signModalFade.requestClose(onClose);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // PDF Export
  const handleDownloadPdf = () => {
    let finalEntrega = firmaEntrega;
    let finalRecepcion = firmaRecepcion;

    if (canvasEntregaRef.current && canvasEntregaRef.current.hasContent()) {
      finalEntrega = canvasEntregaRef.current.getDataUrl();
    }
    if (canvasRecepcionRef.current && canvasRecepcionRef.current.hasContent()) {
      finalRecepcion = canvasRecepcionRef.current.getDataUrl();
    }

    generateCargoPdf({
      ticket: {
        ...ticket,
        descripcionSolucion: remitimosConElPortador
      },
      entregadoPor,
      recibidoPor: senorEs,
      firmaEntrega: finalEntrega,
      firmaRecepcion: finalRecepcion
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getMobileSignUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const hasBothSignatures = !!(firmaEntrega && firmaRecepcion);

  return (
    <div
      className={`fixed inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs flex items-center justify-center z-[9999] p-2 sm:p-4 ${signModalFade.backdropClass}`}
      onClick={() => signModalFade.requestClose(onClose)}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div
        className={`bg-white dark:bg-[#0c0c0f] rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200/90 dark:border-zinc-800 max-h-[96vh] flex flex-col ${signModalFade.modalClass} overflow-hidden`}
        onClick={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight truncate">
                  Acta de Cargo Oficial
                </h3>
                <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                  {ticket.ambiente || 'DOCENCIA'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                Firma directamente abajo o genera el PDF con 1 toque
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowQrDrawer(prev => !prev)}
              className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold transition inline-flex items-center gap-1.5 border border-slate-200/80 dark:border-zinc-700"
              title="Abrir código QR para firmar en tu celular"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Firmar con Celular</span>
              {showQrDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => signModalFade.requestClose(onClose)}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
              title="Cerrar"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Expandable Mobile QR Drawer */}
        {showQrDrawer && (
          <div className="p-3 my-2 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 animate-fade-in shrink-0">
            <div className="p-1.5 bg-white rounded-xl border border-slate-200 shrink-0">
              {qrCodeDataUrl && (
                <img src={qrCodeDataUrl} alt="QR Firma" className="w-20 h-20 object-contain block" />
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <h4 className="text-xs font-black text-slate-900 dark:text-white">Escanea con tu celular</h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                Apunta con la cámara de tu móvil para abrir el lienzo táctil a pantalla completa.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-1 px-2.5 bg-white dark:bg-zinc-800 rounded-lg text-[10px] font-bold border border-slate-200 dark:border-zinc-700 inline-flex items-center gap-1 text-slate-700 dark:text-zinc-300"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedLink ? '¡Copiado!' : 'Copiar enlace'}</span>
                </button>
                <a
                  href={getMobileSignUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1 px-2.5 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-black inline-flex items-center gap-1 shadow-2xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir móvil</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Unified Single-Page Cargo Sheet */}
        <div className="flex-1 overflow-y-auto pr-1 my-3">
          <div className="p-1 rounded-3xl bg-slate-100 dark:bg-zinc-900 border-2 border-slate-700 dark:border-zinc-700 shadow-sm">
            <div className="p-4 sm:p-5 rounded-[22px] bg-white dark:bg-[#0c0c0f] border border-slate-400 dark:border-zinc-700 flex flex-col justify-between space-y-4">

              {/* Header: University & Cargo Number */}
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <img src="/icon.svg" alt="UPN" className="w-4 h-4 rounded-xs shrink-0 object-contain" />
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                    UPN · OPERACIONES SEDE
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                    Cargo N°
                  </span>
                  <div className="px-3 py-1 rounded-xl border border-slate-400 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 font-mono font-bold text-xs text-slate-900 dark:text-white shadow-2xs">
                    {cargoNum}
                  </div>
                </div>
              </div>

              {/* Field 1: Señor(es) */}
              <div className="flex items-center gap-2 pt-1">
                <label className="text-sm font-black text-slate-800 dark:text-zinc-200 shrink-0">
                  Señor(es)
                </label>
                <input
                  type="text"
                  value={senorEs}
                  onChange={e => setSenorEs(e.target.value)}
                  placeholder="Nombre del Docente o Alumno..."
                  className="flex-1 text-xs font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-500 dark:border-zinc-600 focus:border-amber-500 focus:outline-none px-1 py-0.5"
                />
              </div>

              {/* Field 2: Remitimos con el portador (Multi-renglón con líneas continuas) */}
              <div className="pt-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <label className="text-sm font-black text-slate-800 dark:text-zinc-200 shrink-0">
                    Remitimos con el portador
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={remitimosConElPortador}
                  onChange={e => setRemitimosConElPortador(e.target.value)}
                  placeholder="Detalle de materiales prestados..."
                  className="w-full text-xs font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none resize-none px-1 py-1"
                  style={{
                    lineHeight: '26px',
                    backgroundImage: 'repeating-linear-gradient(transparent, transparent 24px, rgba(148, 163, 184, 0.7) 24px, rgba(148, 163, 184, 0.7) 25px)',
                    backgroundAttachment: 'local'
                  }}
                />
              </div>

              {/* Integrated Signatures Row: Entregué (Left) | Fecha/Hora (Center) | Recibí conforme (Right) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800 items-end">

                {/* 1. ENTREGUÉ (OPERACIONES / ASISTENTE) */}
                <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50/70 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
                  <div className="w-full flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1 px-1">
                    <span>1. ENTREGUÉ</span>
                    {firmaEntrega && (
                      <button
                        type="button"
                        onClick={() => setIsEditingEntrega(true)}
                        className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Re-firmar
                      </button>
                    )}
                  </div>

                  {firmaEntrega && !isEditingEntrega ? (
                    <div className="w-full h-24 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                      <img src={firmaEntrega} alt="Firma Entregué" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-full">
                      <SignatureCanvas
                        ref={canvasEntregaRef}
                        title="Firma Asistente"
                        subtitle="Firma aquí con el dedo"
                        initialImage={firmaEntrega}
                        strokeColor="#0284c7"
                        onSignChange={handleFirmaEntregaChange}
                      />
                    </div>
                  )}

                  <div className="w-full border-t border-slate-600 dark:border-zinc-500 mt-2 pt-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block mb-1">
                      Entregué (Asistente)
                    </span>
                    <CustomSelect
                      value={entregadoPor}
                      onChange={setEntregadoPor}
                      options={asistentes}
                      placeholder="Seleccionar Asistente"
                      className="h-8 text-[11px] font-bold"
                    />
                  </div>
                </div>

                {/* 2. FECHA Y HORA (CENTRO) */}
                <div className="flex flex-col items-center text-center justify-center py-2">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-0.5">
                    Fecha
                  </span>
                  <div className="px-3 py-1 rounded-xl border border-slate-400 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 font-mono font-bold text-xs text-slate-800 dark:text-zinc-200 mb-2 shadow-2xs">
                    {ticket.fecha || new Date().toISOString().split('T')[0]}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-zinc-400">
                    <span>Hora:</span>
                    <strong className="font-mono text-slate-900 dark:text-white text-sm">
                      {ticket.horaReporte || '--:--'}
                    </strong>
                  </div>

                  {(ticket.estado === 'ATENDIDO' || firmaEntrega) && (
                    <div className="mt-2 flex flex-col items-center">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tracking-wider">
                        DEVOLUCIÓN CONFORME
                      </span>
                      <span className="text-[9px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-tight">
                        {((entregadoPor && entregadoPor !== senorEs ? entregadoPor : null) || ticket.responsable || defaultAssistant).slice(0, 32)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. RECIBÍ CONFORME (DOCENTE / ALUMNO) */}
                <div className="flex flex-col items-center text-center p-2 rounded-2xl bg-slate-50/70 dark:bg-zinc-900/40 border border-slate-200/80 dark:border-zinc-800">
                  <div className="w-full flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1 px-1">
                    <span>2. RECIBÍ CONFORME</span>
                    {firmaRecepcion && (
                      <button
                        type="button"
                        onClick={() => setIsEditingRecepcion(true)}
                        className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Re-firmar
                      </button>
                    )}
                  </div>

                  {firmaRecepcion && !isEditingRecepcion ? (
                    <div className="w-full h-24 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                      <img src={firmaRecepcion} alt="Firma Recibí Conforme" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-full">
                      <SignatureCanvas
                        ref={canvasRecepcionRef}
                        title="Firma Receptor"
                        subtitle="Firma aquí con el dedo"
                        initialImage={firmaRecepcion}
                        strokeColor="#0f172a"
                        onSignChange={handleFirmaRecepcionChange}
                      />
                    </div>
                  )}

                  <div className="w-full border-t border-slate-600 dark:border-zinc-500 mt-2 pt-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                      Recibí conforme
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block truncate max-w-[140px]">
                      {senorEs || 'Docente / Alumno'}
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* Modal Footer: Download PDF & Save Button */}
        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400">
            <span>Estado:</span>
            {hasBothSignatures ? (
              <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                2/2 Firmas completas
              </span>
            ) : firmaEntrega || firmaRecepcion ? (
              <span className="text-amber-600 dark:text-amber-400">1 de 2 firmas</span>
            ) : (
              <span className="text-slate-400">Sin firmas registradas</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-initial py-2.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Descargar PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="flex-1 sm:flex-initial py-2.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-black shadow-xs transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{saving ? 'Guardando...' : 'Guardar y Cerrar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
