import React, { useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus, RotateCcw, X } from 'lucide-react';

interface PhotoCropEditorProps {
  file: File;
  title?: string;
  aspectRatio?: number;
  onCancel: () => void;
  onApply: (file: File) => void;
}

export const PhotoCropEditor: React.FC<PhotoCropEditorProps> = ({
  file, title = 'Atur Foto', aspectRatio = 1, onCancel, onApply,
}) => {
  const [imageUrl, setImageUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y };
    setDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    setOffset({
      x: dragRef.current.originX + (event.clientX - dragRef.current.x) / rect.width * 100,
      y: dragRef.current.originY + (event.clientY - dragRef.current.y) / rect.height * 100,
    });
  };

  const applyCrop = async () => {
    const image = imageRef.current;
    const frame = frameRef.current;
    if (!image || !frame) return;
    setBusy(true);
    try {
      const width = 1024;
      const height = Math.round(width / aspectRatio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Editor foto tidak dapat dibuka.');
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const centerX = width / 2 + offset.x / 100 * width;
      const centerY = height / 2 + offset.y / 100 * height;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Foto gagal diproses.')), 'image/jpeg', 0.92));
      const cropped = new File([blob], file.name.replace(/\.[^.]+$/, '') + '-yuku.jpg', { type: 'image/jpeg', lastModified: Date.now() });
      onApply(cropped);
    } catch (error) {
      console.error('YUKU photo crop failed', error);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div><h2 className="text-sm font-bold text-slate-900">{title}</h2><p className="text-[11px] text-slate-500">Geser foto untuk mengatur posisi.</p></div>
          <button type="button" onClick={onCancel} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup"><X className="h-5 w-5" /></button>
        </div>
        <div className="bg-slate-950 p-4 sm:p-6">
          <div ref={frameRef} className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-xl bg-slate-800 touch-none" style={{ aspectRatio }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
            {imageUrl && <img ref={imageRef} src={imageUrl} alt="Pratinjau crop foto" draggable={false} onLoad={() => setOffset({ x: 0, y: 0 })} className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(calc(-50% + ${offset.x}%), calc(-50% + ${offset.y}%)) scale(${zoom})` }} />}
            <div className="pointer-events-none absolute inset-0 border border-white/50" />
          </div>
          <div className="mx-auto mt-5 flex max-w-[320px] items-center gap-3 text-white">
            <button type="button" onClick={() => setZoom((v) => Math.max(1, +(v - 0.1).toFixed(2)))} className="rounded-lg p-2 hover:bg-white/10" aria-label="Perkecil"><Minus className="h-4 w-4" /></button>
            <input aria-label="Zoom foto" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-purple-400" />
            <button type="button" onClick={() => setZoom((v) => Math.min(3, +(v + 0.1).toFixed(2)))} className="rounded-lg p-2 hover:bg-white/10" aria-label="Perbesar"><Plus className="h-4 w-4" /></button>
            <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="rounded-lg p-2 hover:bg-white/10" aria-label="Reset"><RotateCcw className="h-4 w-4" /></button>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-300">Zoom {Math.round(zoom * 100)}% · Geser dengan jari atau mouse</p>
        </div>
        <div className="flex gap-2 p-4">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Batal</button>
          <button type="button" onClick={applyCrop} disabled={busy || !imageUrl} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Memproses...' : <><Check className="h-4 w-4" /> Gunakan Foto</>}</button>
        </div>
      </div>
    </div>
  );
};
