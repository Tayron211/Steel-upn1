import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, Check, PenTool, Maximize2, X } from 'lucide-react';

const SignatureCanvas = forwardRef(function SignatureCanvas(
  {
    title = 'Firma Digital',
    subtitle = 'Firme con el dedo o puntero sobre la línea',
    initialImage = null,
    strokeColor = '#0f172a',
    backgroundColor = '#ffffff',
    lineWidth = 3.2,
    height = 120,
    compact = false,
    autoOpen = false,
    onSignChange,
    onClose
  },
  ref
) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(Boolean(initialImage));

  const [savedDataUrl, setSavedDataUrl] = useState(initialImage || null);
  const [isModalOpen, setIsModalOpen] = useState(Boolean(autoOpen));
  const [modalHasContent, setModalHasContent] = useState(Boolean(initialImage));

  useEffect(() => {
    setSavedDataUrl(initialImage || null);
    hasDrawnRef.current = Boolean(initialImage);
    setModalHasContent(Boolean(initialImage));
  }, [initialImage]);

  // Configurar el lienzo amplio dentro del modal
  const setupModalCanvas = (preloadImage = savedDataUrl) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(Math.floor(rect.width), 280);
    const modalHeight = window.innerWidth < 640 ? 260 : 320;

    canvas.width = width * dpr;
    canvas.height = modalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${modalHeight}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, modalHeight);

    if (preloadImage && preloadImage !== 'data:,') {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, modalHeight);
        hasDrawnRef.current = true;
        setModalHasContent(true);
      };
      img.src = preloadImage;
    } else {
      hasDrawnRef.current = false;
      setModalHasContent(false);
    }
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const raf = requestAnimationFrame(() => {
      setupModalCanvas(savedDataUrl);
    });
    const handleResize = () => {
      const currentUrl =
        hasDrawnRef.current && canvasRef.current
          ? canvasRef.current.toDataURL('image/png')
          : savedDataUrl;
      setupModalCanvas(currentUrl);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
    };
  }, [isModalOpen, strokeColor, backgroundColor]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    hasDrawnRef.current = true;
    setModalHasContent(true);
  };

  const draw = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    if (!isDrawingRef.current) return;
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (e.stopPropagation) e.stopPropagation();
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
  };

  const clearModalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, w, h);

    hasDrawnRef.current = false;
    setModalHasContent(false);
  };

  const clearSavedSignature = () => {
    hasDrawnRef.current = false;
    setModalHasContent(false);
    setSavedDataUrl(null);
    if (onSignChange) onSignChange(null);
  };

  const handleConfirmModalSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) {
      clearSavedSignature();
      setIsModalOpen(false);
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    setSavedDataUrl(dataUrl);
    if (onSignChange) {
      onSignChange(dataUrl);
    }
    setIsModalOpen(false);
  };

  useImperativeHandle(ref, () => ({
    clear: clearSavedSignature,
    getDataUrl: () => savedDataUrl,
    hasContent: () => Boolean(savedDataUrl),
    openModal: () => setIsModalOpen(true)
  }));

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (onClose) {
      try {
        onClose();
      } catch (e) {
        console.error('Error on SignatureCanvas onClose:', e);
      }
    }
  };

  return (
    <div className="w-full">
      {/* Cabecera del apartado de firma */}
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="min-w-0">
          <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{title}</span>
          </label>
          {!compact && subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{subtitle}</p>
          )}
        </div>

        {savedDataUrl && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/70 transition inline-flex items-center gap-1 active:scale-95"
              title="Abrir ventana grande para volver a firmar"
            >
              <PenTool className="w-3 h-3 stroke-[2.3]" />
              <span>Cambiar</span>
            </button>
            <button
              type="button"
              onClick={clearSavedSignature}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-800/80 transition inline-flex items-center gap-1 active:scale-95"
              title="Borrar firma"
            >
              <RotateCcw className="w-3 h-3 stroke-[2.5]" />
              <span>Borrar</span>
            </button>
          </div>
        )}
      </div>

      {/* Botón para abrir la ventana grande de firma o vista previa si ya firmó */}
      {savedDataUrl ? (
        <div
          onClick={() => setIsModalOpen(true)}
          className="w-full relative rounded-2xl overflow-hidden border-2 border-emerald-400/80 dark:border-emerald-600/70 bg-white dark:bg-zinc-950 p-2 cursor-pointer group hover:border-amber-400 transition shadow-xs"
          title="Toca para ampliar o modificar la firma"
        >
          <div className="h-20 sm:h-24 w-full flex items-center justify-center bg-white rounded-xl overflow-hidden">
            <img
              src={savedDataUrl}
              alt={title}
              className="max-h-full max-w-full object-contain select-none"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
              <Check className="w-3 h-3 stroke-[3]" />
              Firma lista
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 group-hover:text-amber-500 transition inline-flex items-center gap-1">
              <Maximize2 className="w-3 h-3" />
              Toca para ampliar y editar
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full min-h-[76px] sm:min-h-[84px] px-4 py-3 rounded-2xl border-2 border-dashed border-amber-400/70 dark:border-zinc-700 hover:border-[#FDBA30] dark:hover:border-[#FDBA30] bg-white dark:bg-zinc-950/90 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition flex items-center justify-between gap-3 group active:scale-[0.99] shadow-2xs"
        >
          <div className="flex items-center gap-3 min-w-0 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-[#FDBA30] border border-amber-300/60 dark:border-amber-800/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <PenTool className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">
                Firmar en pantalla amplia
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                Toca aquí para abrir la ventana grande y firmar con comodidad
              </p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#FDBA30] text-slate-950 font-black text-xs inline-flex items-center gap-1.5 shrink-0 shadow-2xs group-hover:bg-[#ffc642] transition">
            <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Firmar</span>
          </div>
        </button>
      )}

      {/* Ventana Modal Grande para Firmar con Comodidad */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 sm:p-5 animate-backdrop-fade"
          onClick={handleModalClose}
        >
          <div
            className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 animate-spring-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal de Firma */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800 mb-4">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-[#FDBA30] border border-amber-300/60 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                  <PenTool className="w-5 h-5 stroke-[2.3]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-slate-950 dark:text-white tracking-tight leading-tight truncate">
                    {title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Dibuja tu firma con comodidad dentro del recuadro blanco
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleModalClose}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Lienzo Grande de Firma */}
            <div
              ref={containerRef}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="w-full relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-white shadow-inner select-none"
              style={{ touchAction: 'none' }}
            >
              <canvas
                ref={canvasRef}
                className="block w-full cursor-crosshair relative z-10"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
              />

              {/* Línea guía visual superpuesta (no se guarda en el PNG) */}
              <div className="absolute inset-x-8 bottom-12 pointer-events-none flex items-center justify-between border-b-2 border-dashed border-slate-300/90 pb-1.5 z-20">
                <span className="text-[11px] font-black tracking-wider text-slate-400 select-none">
                  ✕ LÍNEA DE FIRMA
                </span>
                <span className="text-[10px] font-bold text-slate-400 select-none">
                  STEEL PRO · UPN
                </span>
              </div>

              {!modalHasContent && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20 px-4 text-center">
                  <PenTool className="w-7 h-7 text-slate-300 mb-1.5 stroke-[1.8]" />
                  <span className="text-sm font-bold text-slate-400 select-none">
                    Firma aquí con tu dedo, lápiz óptico o mouse
                  </span>
                </div>
              )}
            </div>

            {/* Botones de Acción del Modal Grande */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={clearModalCanvas}
                className="h-11 px-4 rounded-2xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-800/70 transition inline-flex items-center gap-1.5 active:scale-95"
              >
                <RotateCcw className="w-4 h-4 stroke-[2.3]" />
                <span>Limpiar trazo</span>
              </button>

              <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="h-11 px-4 rounded-2xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 transition inline-flex items-center justify-center active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmModalSignature}
                  disabled={!modalHasContent}
                  className="h-11 px-6 rounded-2xl text-xs sm:text-sm font-black bg-[#FDBA30] hover:bg-[#ffc642] disabled:opacity-45 text-slate-950 shadow-sm transition inline-flex items-center justify-center gap-2 active:scale-95"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar Firma</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default SignatureCanvas;
