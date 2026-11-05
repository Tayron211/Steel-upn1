import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { RotateCcw, Check, PenTool } from 'lucide-react';

const SignatureCanvas = forwardRef(function SignatureCanvas(
  { 
    title = 'Firma Digital',
    subtitle = 'Firme con el dedo o puntero sobre la línea',
    initialImage = null,
    strokeColor = '#0f172a',
    backgroundColor = '#ffffff',
    lineWidth = 2.8,
    onSignChange
  }, 
  ref
) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [hasContent, setHasContent] = useState(false);

  // Initialize and handle high-DPI resize
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(rect.width);
    const height = 180; // standard comfortable height for mobile signing

    // Preserve existing content if resizing
    let existingData = null;
    if (hasDrawnRef.current || initialImage) {
      existingData = canvas.toDataURL();
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;

    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw baseline guide
    drawGuide(ctx, width, height);

    // Restore existing or initial image
    if (existingData && existingData !== 'data:,') {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        hasDrawnRef.current = true;
        setHasContent(true);
      };
      img.src = existingData;
    } else if (initialImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        hasDrawnRef.current = true;
        setHasContent(true);
      };
      img.src = initialImage;
    }
  };

  const drawGuide = (ctx, w, h) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(24, h - 36);
    ctx.lineTo(w - 24, h - 36);
    ctx.stroke();

    // Small 'X' mark at start of line
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.fillText('✕', 26, h - 42);
    ctx.font = '10px sans-serif';
    ctx.fillText('LÍNEA DE FIRMA', 44, h - 42);
    ctx.restore();
  };

  useEffect(() => {
    setupCanvas();
    const handleResize = () => setupCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialImage, strokeColor, backgroundColor]);

  // Coordinates helper
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

  // Drawing event handlers
  const startDrawing = (e) => {
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
    setHasContent(true);
  };

  const draw = (e) => {
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
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (onSignChange) {
      onSignChange(getDataUrl());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, w, h);
    drawGuide(ctx, w, h);

    hasDrawnRef.current = false;
    setHasContent(false);
    if (onSignChange) onSignChange(null);
  };

  const getDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawnRef.current) return null;
    return canvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    clear,
    getDataUrl,
    hasContent: () => hasDrawnRef.current
  }));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-amber-500" />
            <span>{title}</span>
          </label>
          <p className="text-[10px] text-slate-500 dark:text-zinc-400">{subtitle}</p>
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={clear}
            className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800/80 transition inline-flex items-center gap-1 active:scale-95"
            title="Borrar y volver a firmar"
          >
            <RotateCcw className="w-3 h-3 stroke-[2.5]" />
            <span>Borrar</span>
          </button>
        )}
      </div>

      <div 
        ref={containerRef}
        className="w-full relative rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-inner select-none transition-colors"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />
        
        {!hasContent && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <span className="text-xs font-medium text-slate-400/80 dark:text-zinc-600 select-none">
              Dibuja tu firma aquí
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export default SignatureCanvas;
