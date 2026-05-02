import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCcw } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function MediaViewer({ media, onClose, onPrevious, onNext, positionLabel, details }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const pointersRef = useRef(new Map());
  const lastPanRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    if (!media) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsMediaLoading(true);
    pointersRef.current.clear();
    lastPanRef.current = null;
    pinchRef.current = null;
  }, [media]);

  useEffect(() => {
    if (!media) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === '+') setScale(value => clamp(value + 0.35, 1, 4));
      if (event.key === '-') setScale(value => clamp(value - 0.35, 1, 4));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [media, onClose]);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomBy = (amount) => {
    setScale(value => {
      const next = clamp(value + amount, 1, 4);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const getDistance = (points) => {
    const [first, second] = points;
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  const handlePointerDown = (event) => {
    if (media?.type !== 'image') return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (pointersRef.current.size === 1) {
      lastPanRef.current = { clientX: event.clientX, clientY: event.clientY };
    }
    if (pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values());
      pinchRef.current = { distance: getDistance(points), scale };
    }
  };

  const handlePointerMove = (event) => {
    if (media?.type !== 'image' || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values());
      const pinch = pinchRef.current;
      if (!pinch?.distance) return;
      const nextScale = clamp(pinch.scale * (getDistance(points) / pinch.distance), 1, 4);
      setScale(nextScale);
      return;
    }

    if (scale > 1 && lastPanRef.current) {
      const dx = event.clientX - lastPanRef.current.clientX;
      const dy = event.clientY - lastPanRef.current.clientY;
      lastPanRef.current = { clientX: event.clientX, clientY: event.clientY };
      setOffset(prev => ({
        x: clamp(prev.x + dx, -360 * scale, 360 * scale),
        y: clamp(prev.y + dy, -360 * scale, 360 * scale),
      }));
    }
  };

  const handlePointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      const [point] = Array.from(pointersRef.current.values());
      lastPanRef.current = point;
    } else {
      lastPanRef.current = null;
    }
    if (scale <= 1) setOffset({ x: 0, y: 0 });
  };

  return (
    <AnimatePresence>
      {media && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/94 p-3 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="media-viewer-frame flex h-full w-full max-w-[min(96vw,92rem)] flex-col"
            initial={{ scale: 0.98, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: 10 }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3 pt-[env(safe-area-inset-top)] text-white">
              <button
                type="button"
                onClick={onClose}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                aria-label="Back"
              >
                <ArrowLeft size={25} strokeWidth={2.8} />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-sm font-black">{media.name || media.title || 'Media preview'}</p>
                {(positionLabel || details) && (
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-white/55">{positionLabel || details}</p>
                )}
              </div>
              <a
                href={media.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                aria-label="Download media"
              >
                <Download size={20} />
              </a>
            </div>

            <div
              className="media-viewer-stage relative grid min-h-0 flex-1 touch-none select-none place-items-center overflow-hidden rounded-3xl bg-black/55 md:flex-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onDoubleClick={() => (scale > 1 ? resetZoom() : setScale(2.4))}
            >
              {isMediaLoading && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-black/35 text-white">
                  <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white/90 animate-spin" />
                </div>
              )}
              {media.type === 'video' ? (
                <video
                  key={media.url}
                  src={media.url}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload noplaybackrate"
                  onLoadedMetadata={() => setIsMediaLoading(false)}
                  onCanPlay={() => setIsMediaLoading(false)}
                  onError={() => setIsMediaLoading(false)}
                  className="media-viewer-video max-h-full max-w-full rounded-2xl bg-black object-contain"
                />
              ) : (
                <img
                  key={media.url}
                  src={media.url}
                  alt={media.name || 'Media preview'}
                  draggable={false}
                  onLoad={() => setIsMediaLoading(false)}
                  onError={() => setIsMediaLoading(false)}
                  className="media-viewer-image max-h-full max-w-full rounded-2xl object-contain transition-transform duration-75"
                  style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
                />
              )}

              {(onPrevious || onNext) && (
                <>
                  {onPrevious && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        onPrevious();
                      }}
                      className="absolute left-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-2xl bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                      aria-label="Previous media"
                    >
                      <ChevronLeft size={26} />
                    </button>
                  )}
                  {onNext && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        onNext();
                      }}
                      className="absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-2xl bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                      aria-label="Next media"
                    >
                      <ChevronRight size={26} />
                    </button>
                  )}
                </>
              )}
            </div>

            {media.type !== 'video' && (
              <div className="mx-auto mt-3 flex items-center gap-2 rounded-2xl bg-white/10 p-2 text-white backdrop-blur">
                <button type="button" onClick={() => zoomBy(-0.4)} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/15" aria-label="Zoom out">
                  <Minus size={18} />
                </button>
                <button type="button" onClick={resetZoom} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/15" aria-label="Reset zoom">
                  <RotateCcw size={18} />
                </button>
                <span className="min-w-14 text-center text-xs font-black">{Math.round(scale * 100)}%</span>
                <button type="button" onClick={() => zoomBy(0.4)} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/15" aria-label="Zoom in">
                  <Plus size={18} />
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
