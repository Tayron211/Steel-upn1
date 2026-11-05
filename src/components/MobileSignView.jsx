import React, { useState, useEffect, useRef } from 'react';
import { 
  PenTool, 
  Check, 
  CheckCircle2, 
  ArrowLeft, 
  RotateCcw, 
  User, 
  Clock, 
  MapPin, 
  Package, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';

export default function MobileSignView({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('recepcion'); // 'entrega' | 'recepcion'
  const [personName, setPersonName] = useState('');
  const [signatureData, setSignatureData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canvasRef = useRef(null);

  // Fetch ticket details
  useEffect(() => {
    let isMounted = true;
    const fetchTicket = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/tickets');
        const json = await res.json();
        if (json.success && json.data) {
          const found = json.data.find(t => t.id === ticketId);
          if (found && isMounted) {
            setTicket(found);
            // Default role and name based on missing signature
            if (found.firmaEntrega && !found.firmaRecepcion) {
              setRole('recepcion');
              const match = (found.descripcionSolucion || '').match(/\[(🎓\s*ALUMNO|👨‍🏫\s*DOCENTE):\s*([^\]]+)\]/i);
              if (match && match[2]) setPersonName(match[2].trim());
            } else if (!found.firmaEntrega && found.firmaRecepcion) {
              setRole('entrega');
              setPersonName(found.entregadoPor || found.responsable || 'Operaciones Sede');
            } else {
              setRole('recepcion');
              const match = (found.descripcionSolucion || '').match(/\[(🎓\s*ALUMNO|👨‍🏫\s*DOCENTE):\s*([^\]]+)\]/i);
              if (match && match[2]) setPersonName(match[2].trim());
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTicket();
    return () => { isMounted = false; };
  }, [ticketId]);

  // Handle role change to prefill name
  const handleSelectRole = (selected) => {
    setRole(selected);
    if (!ticket) return;
    if (selected === 'entrega') {
      setPersonName(ticket.entregadoPor || ticket.responsable || 'Operaciones Sede');
    } else {
      const match = (ticket.descripcionSolucion || '').match(/\[(🎓\s*ALUMNO|👨‍🏫\s*DOCENTE):\s*([^\]]+)\]/i);
      setPersonName(match && match[2] ? match[2].trim() : (ticket.recibidoPor || ''));
    }
  };

  const handleSubmitSignature = async () => {
    if (!personName.trim()) {
      setErrorMsg('Por favor escribe tu nombre completo');
      return;
    }

    let finalSign = signatureData;
    if (canvasRef.current && canvasRef.current.hasContent()) {
      finalSign = canvasRef.current.getDataUrl();
    }

    if (!finalSign) {
      setErrorMsg('Por favor dibuja tu firma en el recuadro');
      return;
    }

    setErrorMsg('');
    setSubmitting(true);

    const payload = {};
    if (role === 'entrega') {
      payload.firmaEntrega = finalSign;
      payload.entregadoPor = personName.trim();
    } else {
      payload.firmaRecepcion = finalSign;
      payload.recibidoPor = personName.trim();
    }
    payload.fechaFirma = new Date().toISOString();

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        try {
          if (role === 'entrega') {
            localStorage.setItem(`upn_sign_entrega_${ticketId}`, finalSign);
            localStorage.setItem('upn_staff_signature', finalSign);
          } else {
            localStorage.setItem(`upn_sign_recepcion_${ticketId}`, finalSign);
          }
          window.dispatchEvent(new Event('storage'));
        } catch (e) {}
        setSubmitted(true);
      } else {
        setErrorMsg('No se pudo guardar la firma. Intente nuevamente.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Error de red. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-black text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center animate-pulse mb-3">
          <PenTool className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold">Cargando préstamo...</p>
        <span className="text-xs text-slate-400 font-mono mt-1">ID: {ticketId}</span>
      </div>
    );
  }

  if (!ticket && !loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-black text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-base font-bold text-rose-500 mb-2">Préstamo no encontrado</p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
          Es posible que haya sido devuelto o eliminado.
        </p>
        <button
          onClick={onBack}
          className="py-2 px-4 bg-slate-200 dark:bg-zinc-800 rounded-xl text-xs font-bold"
        >
          Volver a la App
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white flex flex-col p-4 max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-zinc-800 mb-3">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center active:scale-95 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-1.5 text-xs font-black tracking-wider uppercase">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>UPN Sede · Firma Móvil</span>
        </div>

        <div className="w-9" />
      </div>

      {submitted ? (
        /* SUCCESS CONFIRMATION */
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 animate-spring-up">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <h2 className="text-xl font-black tracking-tight mb-1">¡Firma Registrada!</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6 max-w-xs leading-relaxed">
            Tu firma digital como <strong className="text-slate-900 dark:text-white">{role === 'entrega' ? 'Entrega (Operaciones)' : 'Receptor Conforme'}</strong> quedó sincronizada en el sistema central en tiempo real.
          </p>

          <div className="w-full bg-white dark:bg-zinc-950 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm mb-6 text-left text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Aula:</span>
              <strong className="font-mono">{ticket.ambiente}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Material:</span>
              <strong className="truncate max-w-[200px]">{ticket.tipoSolicitud}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Firmado por:</span>
              <strong className="text-emerald-600 dark:text-emerald-400">{personName}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-sm transition active:scale-95"
          >
            Volver al Panel Principal
          </button>
        </div>
      ) : (
        /* SIGNING FORM */
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Loan Card Summary */}
            <div className="bg-white dark:bg-[#0c0c0f] rounded-2xl p-3.5 border border-slate-200/90 dark:border-zinc-800 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-black text-xs bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                  {ticket.ambiente || 'AULA'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {ticket.fecha} · {ticket.horaReporte}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5 leading-snug">
                {ticket.tipoSolicitud}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-tight">
                {ticket.descripcionSolucion}
              </p>
            </div>

            {/* Role Switcher */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wide">
                ¿Qué firma estás registrando?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectRole('entrega')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    role === 'entrega'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>1. Quien Entrega</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('recepcion')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                    role === 'recepcion'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>2. Quien Recibe</span>
                </button>
              </div>
            </div>

            {/* Person Name Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                {role === 'entrega' ? 'Nombre del Asistente / Operador' : 'Nombre del Docente o Alumno'}
              </label>
              <input
                type="text"
                value={personName}
                onChange={e => setPersonName(e.target.value)}
                placeholder={role === 'entrega' ? 'Ej: Alessandro Pascual' : 'Ej: Haro Omar'}
                className="w-full text-xs px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold"
              />
            </div>

            {/* Canvas */}
            <SignatureCanvas
              ref={canvasRef}
              title={role === 'entrega' ? 'Firma de Quien Entrega' : 'Firma de Quien Recibe'}
              subtitle="Usa tu dedo directamente sobre la pantalla"
              strokeColor={role === 'entrega' ? '#0284c7' : '#0f172a'}
              onSignChange={dataUrl => setSignatureData(dataUrl)}
            />

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 animate-shake">
                <span>⚠️ {errorMsg}</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 pb-4">
            <button
              type="button"
              onClick={handleSubmitSignature}
              disabled={submitting}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-md transition active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{submitting ? 'Enviando firma...' : 'Confirmar y Guardar Firma'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

