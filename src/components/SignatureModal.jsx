import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  PenTool, 
  QrCode, 
  FileText, 
  Printer, 
  Copy, 
  Download,
  UserCheck, 
  CheckCircle2, 
  ExternalLink,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import QRCode from 'qrcode';
import SignatureCanvas from './SignatureCanvas';
import { generateCargoPdf } from '../utils/cargoPdfGenerator';

export default function SignatureModal({ 
  ticket, 
  isOpen, 
  onClose, 
  onSaveSignatures,
  defaultAssistant = 'Alessandro Pascual'
}) {
  if (!isOpen || !ticket) return null;

  // Tabs: 'acta' (Cargo preview & fill) | 'entrega' (Sign 1) | 'recepcion' (Sign 2) | 'qr' (Mobile QR)
  const [activeTab, setActiveTab] = useState('acta');

  // Fields corresponding exactly to the "Acta de Cargo" model
  const [cargoNum, setCargoNum] = useState(() => {
    return (ticket.id || '').replace(/^ticket_/, 'CARGO-').slice(-8).toUpperCase();
  });

  const [senorEs, setSenorEs] = useState(() => {
    if (ticket.recibidoPor) return ticket.recibidoPor;
    const match = (ticket.descripcionSolucion || '').match(/\[(🎓\s*ALUMNO|👨‍🏫\s*DOCENTE):\s*([^\]]+)\]/i);
    if (match && match[2]) return match[2].trim();
    return '';
  });

  const [remitimosConElPortador, setRemitimosConElPortador] = useState(() => {
    const cleanDesc = (ticket.descripcionSolucion || ticket.tipoSolicitud || '')
      .replace(/\[(🎓|👨‍🏫)?\s*(ALUMNO|DOCENTE)(?::[^\]]+)?\]/gi, '')
      .trim();
    return cleanDesc || ticket.tipoSolicitud || 'Plumones y mota acrílica';
  });

  const [entregadoPor, setEntregadoPor] = useState(() => {
    return ticket.entregadoPor || ticket.responsable || defaultAssistant;
  });

  const [recibidoPor, setRecibidoPor] = useState(() => {
    return ticket.recibidoPor || senorEs;
  });

  // Stored signatures
  const [firmaEntrega, setFirmaEntrega] = useState(() => ticket.firmaEntrega || null);
  const [firmaRecepcion, setFirmaRecepcion] = useState(() => ticket.firmaRecepcion || null);

  // QR Code Data URL
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasEntregaRef = useRef(null);
  const canvasRecepcionRef = useRef(null);

  // Sync recibidoPor with senorEs
  const handleSenorEsChange = (val) => {
    setSenorEs(val);
    setRecibidoPor(val);
  };

  // Compute mobile signing URL
  const getMobileSignUrl = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path}#firmar-${ticket.id}`;
  };

  // Generate QR Code
  useEffect(() => {
    const url = getMobileSignUrl();
    if (!url) return;
    QRCode.toDataURL(url, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then(data => setQrCodeDataUrl(data))
      .catch(err => console.error('Error generating QR', err));
  }, [ticket.id]);

  // Handle Save
  const handleSave = async () => {
    setSaving(true);
    
    let finalFirmaEntrega = firmaEntrega;
    let finalFirmaRecepcion = firmaRecepcion;

    if (canvasEntregaRef.current && canvasEntregaRef.current.hasContent()) {
      finalFirmaEntrega = canvasEntregaRef.current.getDataUrl();
    }
    if (canvasRecepcionRef.current && canvasRecepcionRef.current.hasContent()) {
      finalFirmaRecepcion = canvasRecepcionRef.current.getDataUrl();
    }

    const payload = {
      firmaEntrega: finalFirmaEntrega,
      firmaRecepcion: finalFirmaRecepcion,
      entregadoPor: entregadoPor.trim() || 'Operaciones Sede',
      recibidoPor: (senorEs || recibidoPor).trim() || 'Solicitante',
      fechaFirma: new Date().toISOString()
    };

    try {
      await onSaveSignatures(ticket.id, payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    let finalFirmaEntrega = firmaEntrega;
    let finalFirmaRecepcion = firmaRecepcion;

    if (canvasEntregaRef.current && canvasEntregaRef.current.hasContent()) {
      finalFirmaEntrega = canvasEntregaRef.current.getDataUrl();
    }
    if (canvasRecepcionRef.current && canvasRecepcionRef.current.hasContent()) {
      finalFirmaRecepcion = canvasRecepcionRef.current.getDataUrl();
    }

    generateCargoPdf({
      ticket: {
        ...ticket,
        descripcionSolucion: remitimosConElPortador
      },
      entregadoPor,
      recibidoPor: senorEs || recibidoPor,
      firmaEntrega: finalFirmaEntrega,
      firmaRecepcion: finalFirmaRecepcion
    });
  };

  const handleCopyLink = () => {
    const url = getMobileSignUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePrintActa = () => {
    window.print();
  };

  const hasBothSignatures = !!(firmaEntrega && firmaRecepcion);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-xs flex items-center justify-center z-[9999] p-2 sm:p-4 animate-backdrop-fade"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#0c0c0f] rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 max-h-[94vh] flex flex-col animate-spring-up overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight truncate">
                  Acta de Cargo y Firmas
                </h3>
                <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                  {ticket.ambiente || 'AULA'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                Modelo oficial de cargo UPN con firmas móviles y descarga en PDF
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
            title="Cerrar"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl my-3 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('acta')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'acta'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Modelo de Cargo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('entrega')}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'entrega'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>✍️ Entregué</span>
            {firmaEntrega ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recepcion')}
            className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'recepcion'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>✍️ Recibí Conforme</span>
            {firmaRecepcion ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'qr'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Firmar desde teléfono móvil con QR"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QR Celular</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {/* =========================================================================
              TAB 1: MODELO DE ACTA DE CARGO (Exact Reproduction from Image)
              ========================================================================= */}
          {activeTab === 'acta' && (
            <div className="space-y-4 animate-fade-in">
              {/* The Official Cargo Box (Double Border) */}
              <div className="p-1 rounded-3xl bg-slate-100 dark:bg-zinc-900 border-2 border-slate-700 dark:border-zinc-700 shadow-sm">
                <div className="p-4 sm:p-5 rounded-[22px] bg-white dark:bg-[#0c0c0f] border border-slate-400 dark:border-zinc-700 flex flex-col justify-between min-h-[300px]">
                  {/* Top Right: Cargo N° [ _______ ] */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                      UNIVERSIDAD PRIVADA DEL NORTE
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                        Cargo N°
                      </span>
                      <div className="px-3 py-1 rounded-xl border border-slate-400 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 font-mono font-bold text-xs text-slate-900 dark:text-white shadow-2xs">
                        {cargoNum}
                      </div>
                    </div>
                  </div>

                  {/* Main Fields: Señor(es) & Remitimos con el portador */}
                  <div className="space-y-4 mb-6">
                    {/* Field 1: Señor(es) */}
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-black text-slate-800 dark:text-zinc-200 shrink-0">
                          Señor(es)
                        </label>
                        <input
                          type="text"
                          value={senorEs}
                          onChange={e => handleSenorEsChange(e.target.value)}
                          placeholder="Nombre del Docente o Alumno solicitante..."
                          className="flex-1 text-xs font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-500 dark:border-zinc-600 focus:border-amber-500 focus:outline-none px-1 py-0.5"
                        />
                      </div>
                    </div>

                    {/* Field 2: Remitimos con el portador */}
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-black text-slate-800 dark:text-zinc-200 shrink-0">
                          Remitimos con el portador
                        </label>
                        <input
                          type="text"
                          value={remitimosConElPortador}
                          onChange={e => setRemitimosConElPortador(e.target.value)}
                          placeholder="Detalle del material prestado (plumones, llave, adaptador...)..."
                          className="flex-1 text-xs font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-500 dark:border-zinc-600 focus:border-amber-500 focus:outline-none px-1 py-0.5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lower Row: Entregué (Left) | Fecha/Hora (Center) | Recibí conforme (Right) */}
                  <div className="grid grid-cols-3 gap-2 items-end pt-3 border-t border-slate-100 dark:border-zinc-800">
                    {/* LEFT: ENTREGUÉ (Asistente / Operaciones) */}
                    <div className="flex flex-col items-center text-center">
                      <div 
                        onClick={() => setActiveTab('entrega')}
                        className="w-full h-18 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500 transition group p-1 mb-1"
                        title="Clic para firmar entrega"
                      >
                        {firmaEntrega ? (
                          <img src={firmaEntrega} alt="Firma Entregué" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline inline-flex items-center gap-1">
                            <PenTool className="w-3 h-3" /> Firmar aquí
                          </span>
                        )}
                      </div>
                      <div className="w-full border-t border-slate-600 dark:border-zinc-500 mt-0.5" />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 mt-1">
                        Entregué
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[120px] font-medium">
                        {entregadoPor || 'Operaciones Sede'}
                      </span>
                    </div>

                    {/* CENTER: FECHA Y HORA */}
                    <div className="flex flex-col items-center text-center pb-1">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-0.5">
                        Fecha
                      </span>
                      <div className="px-2.5 py-0.5 rounded-lg border border-slate-400 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900 font-mono font-bold text-[11px] text-slate-800 dark:text-zinc-200 mb-1.5 shadow-2xs">
                        {ticket.fecha || new Date().toISOString().split('T')[0]}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                        <span>Hora:</span>
                        <strong className="font-mono text-slate-900 dark:text-white">
                          {ticket.horaReporte || '--:--'}
                        </strong>
                      </div>
                    </div>

                    {/* RIGHT: RECIBÍ CONFORME (Docente / Alumno) */}
                    <div className="flex flex-col items-center text-center">
                      <div 
                        onClick={() => setActiveTab('recepcion')}
                        className="w-full h-18 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-dashed border-slate-300 dark:border-zinc-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-amber-500 transition group p-1 mb-1"
                        title="Clic para firmar recepción"
                      >
                        {firmaRecepcion ? (
                          <img src={firmaRecepcion} alt="Firma Recibí Conforme" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 group-hover:underline inline-flex items-center gap-1">
                            <PenTool className="w-3 h-3" /> Firmar aquí
                          </span>
                        )}
                      </div>
                      <div className="w-full border-t border-slate-600 dark:border-zinc-500 mt-0.5" />
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 mt-1">
                        Recibí conforme
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[120px] font-medium">
                        {senorEs || 'Docente / Alumno'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Download PDF & Print */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-sm transition inline-flex items-center justify-center gap-2 active:scale-95"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>Descargar Acta en PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintActa}
                  className="py-3 px-4 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-2xl text-xs font-bold transition inline-flex items-center justify-center gap-2 active:scale-95 border border-slate-200/80 dark:border-zinc-700"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: FIRMA DE ENTREGA (ASISTENTE / OPERACIONES)
              ========================================================================= */}
          {activeTab === 'entrega' && (
            <div className="space-y-3.5 animate-fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Nombre del Asistente (Entregué)
                </label>
                <input
                  type="text"
                  value={entregadoPor}
                  onChange={e => setEntregadoPor(e.target.value)}
                  placeholder="Ej: Alessandro Pascual"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold"
                />
              </div>

              <SignatureCanvas
                ref={canvasEntregaRef}
                title="Firma del Asistente · Entregué"
                subtitle="Certifica la entrega de los materiales con tu dedo o puntero"
                initialImage={firmaEntrega}
                strokeColor="#0284c7"
                onSignChange={dataUrl => setFirmaEntrega(dataUrl)}
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {firmaEntrega ? '✅ Firma de entrega registrada' : '⚠️ Pendiente de firma'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('recepcion')}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Ir a Firma Recibí Conforme &rarr;</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 3: FIRMA DE RECEPCIÓN (DOCENTE / ALUMNO)
              ========================================================================= */}
          {activeTab === 'recepcion' && (
            <div className="space-y-3.5 animate-fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Nombre de Quien Recibe · Señor(es)
                </label>
                <input
                  type="text"
                  value={senorEs}
                  onChange={e => handleSenorEsChange(e.target.value)}
                  placeholder="Ej: Haro Omar / Docente de Diseño"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold"
                />
              </div>

              <SignatureCanvas
                ref={canvasRecepcionRef}
                title="Firma de Conformidad · Recibí Conforme"
                subtitle="El docente o alumno certifica haber recibido el material conforme"
                initialImage={firmaRecepcion}
                strokeColor="#0f172a"
                onSignChange={dataUrl => setFirmaRecepcion(dataUrl)}
              />

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {firmaRecepcion ? '✅ Firma de recepción registrada' : '⚠️ Pendiente de firma'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('acta')}
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Ver Acta de Cargo Completa &rarr;</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 4: CÓDIGO QR PARA FIRMAR CON CELULAR
              ========================================================================= */}
          {activeTab === 'qr' && (
            <div className="py-2 flex flex-col items-center text-center animate-fade-in">
              <div className="p-3 bg-white rounded-3xl border-2 border-slate-200 shadow-md mb-3">
                {qrCodeDataUrl ? (
                  <img 
                    src={qrCodeDataUrl} 
                    alt="Código QR para firmar con celular" 
                    className="w-56 h-56 object-contain block"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs font-mono">
                    Generando QR...
                  </div>
                )}
              </div>

              <h4 className="text-sm font-black text-slate-900 dark:text-white mb-1">
                Firma Directa con Smartphone
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mb-4 leading-relaxed">
                Escanea el código QR con la cámara de tu celular para abrir el panel táctil y firmar el Acta de Cargo en pantalla.
              </p>

              <div className="flex items-center gap-2 w-full max-w-xs">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 active:scale-95 border border-slate-200/80 dark:border-zinc-700"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? '¡Enlace Copiado!' : 'Copiar Enlace'}</span>
                </button>

                <a
                  href={getMobileSignUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition inline-flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir aquí</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3.5 mt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
            <span>Firmas:</span>
            {hasBothSignatures ? (
              <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                2/2 Firmas completas
              </span>
            ) : firmaEntrega || firmaRecepcion ? (
              <span className="text-amber-600 dark:text-amber-400">1 de 2 firmas</span>
            ) : (
              <span className="text-slate-400">Sin firmas aún</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="py-2.5 px-5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-black shadow-xs transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{saving ? 'Guardando...' : 'Guardar y Confirmar'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
