import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCcw } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SWIPE_THRESHOLD = 90;
const CLOSE_THRESHOLD = 130;

const isInteractiveTarget = (target) => Boolean(target?.closest?.('button,a,input,textarea,select,video'));

export default function MediaViewer({ media, onClose, onPrevious, onNext, positionLabel, details }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewerDrag, setViewerDrag] = useState({ x: 0, y: 0 });
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const pinchRef = useRef(null);
  const scaleRef = useRef(scale);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    if (!media) return;
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setViewerDrag({ x: 0, y: 0 });
    setIsMediaLoading(true);
    pointersRef.current.clear();
    gestureRef.current = null;
    pinchRef.current = null;
  }, [media]);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomBy = (amount) => {
    if (media?.type !== 'image') return;
    setScale(value => {
      const next = clamp(value + amount, 1, 4);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const moveMedia = (direction) => {
    setViewerDrag({ x: 0, y: 0 });
    resetZoom();
    if (direction < 0) onPrevious?.();
    else onNext?.();
  };

  useEffect(() => {
    if (!media) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'ArrowLeft' && onPrevious) {
        event.preventDefault();
        moveMedia(-1);
      }
      if (event.key === 'ArrowRight' && onNext) {
        event.preventDefault();
        moveMedia(1);
      }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && scaleRef.current <= 1) {
        event.preventDefault();
        onClose?.();
      }
      if (event.key === '+') zoomBy(0.35);
      if (event.key === '-') zoomBy(-0.35);
      if (event.key === '0') resetZoom();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [media, onClose, onPrevious, onNext]);

  const getDistance = (points) => {
    const [first, second] = points;
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  const handlePointerDown = (event) => {
    if (!media || isInteractiveTarget(event.target)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = { clientX: event.clientX, clientY: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startedAt: Date.now()
      };
    }

    if (media.type === 'image' && pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values());
      pinchRef.current = { distance: getDistance(points), scale: scaleRef.current };
      setViewerDrag({ x: 0, y: 0 });
    }
  };

  const handlePointerMove = (event) => {
    if (!media || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (media.type === 'image' && pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values());
      const pinch = pinchRef.current;
      if (!pinch?.distance) return;
      const nextScale = clamp(pinch.scale * (getDistance(points) / pinch.distance), 1, 4);
      setScale(nextScale);
      if (nextScale <= 1) setOffset({ x: 0, y: 0 });
      return;
    }

    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (media.type === 'image' && scaleRef.current > 1) {
      const moveX = event.clientX - gesture.lastX;
      const moveY = event.clientY - gesture.lastY;
      gestureRef.current = { ...gesture, lastX: event.clientX, lastY: event.clientY };
      setOffset(prev => ({
        x: clamp(prev.x + moveX, -420 * scaleRef.current, 420 * scaleRef.current),
        y: clamp(prev.y + moveY, -420 * scaleRef.current, 420 * scaleRef.current),
      }));
      return;
    }

    setViewerDrag({
      x: clamp(dx, -180, 180),
      y: clamp(dy, -240, 240)
    });
  };

  const finishGesture = (event) => {
    const gesture = gestureRef.current;
    const point = pointersRef.current.get(event.pointerId);
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size > 0) {
      const [remaining] = Array.from(pointersRef.current.entries());
      gestureRef.current = {
        pointerId: remaining[0],
        startX: remaining[1].clientX,
        startY: remaining[1].clientY,
        lastX: remaining[1].clientX,
        lastY: remaining[1].clientY,
        startedAt: Date.now()
      };
      return;
    }

    gestureRef.current = null;

    if (gesture && point && scaleRef.current <= 1) {
      const dx = point.clientX - gesture.startX;
      const dy = point.clientY - gesture.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const duration = Math.max(Date.now() - gesture.startedAt, 1);
      const velocityX = absX / duration;
      const velocityY = absY / duration;

      if (absY > CLOSE_THRESHOLD && absY > absX * 1.1 && velocityY > 0.25) {
        setViewerDrag({ x: 0, y: 0 });
        onClose?.();
        return;
      }

      if (absX > SWIPE_THRESHOLD && absX > absY * 1.15 && velocityX > 0.2) {
        if (dx < 0 && onNext) {
          moveMedia(1);
          return;
        }
        if (dx > 0 && onPrevious) {
          moveMedia(-1);
          return;
        }
      }
    }

    setViewerDrag({ x: 0, y: 0 });
    if (scaleRef.current <= 1) setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (event) => {
    if (media?.type !== 'image') return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 0.22 : -0.22);
  };

  const dragDistance = Math.min(Math.hypot(viewerDrag.x, viewerDrag.y), 220);
  const mediaOpacity = 1 - dragDistance / 520;
  const viewerMeta = [positionLabel, details].filter(Boolean).join(' · ');

  return (
    <AnimatePresence>
      {media && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-3 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="media-viewer-frame relative flex h-full w-full max-w-[min(96vw,92rem)] flex-col"
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
              <div className="pointer-events-none min-w-0 flex-1 text-center">
                {viewerMeta && (
                  <p className="truncate text-xs font-bold text-white/60">{viewerMeta}</p>
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
              className="media-viewer-stage relative grid min-h-0 flex-1 touch-none select-none place-items-center overflow-hidden rounded-3xl bg-black/50 md:flex-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishGesture}
              onPointerCancel={finishGesture}
              onWheel={handleWheel}
              onDoubleClick={() => media.type === 'image' && (scaleRef.current > 1 ? resetZoom() : setScale(2.4))}
            >
              {isMediaLoading && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-black/40 text-white">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/90" />
                </div>
              )}
              <div
                className="grid h-full w-full place-items-center"
                style={{
                  opacity: mediaOpacity,
                  transform: `translate3d(${viewerDrag.x}px, ${viewerDrag.y}px, 0)`,
                  transition: viewerDrag.x || viewerDrag.y ? 'none' : 'transform 160ms ease, opacity 160ms ease'
                }}
              >
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
                    alt={media.name || 'Media'}
                    draggable={false}
                    onLoad={() => setIsMediaLoading(false)}
                    onError={() => setIsMediaLoading(false)}
                    className="media-viewer-image max-h-full max-w-full rounded-2xl object-contain transition-transform duration-75"
                    style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
                  />
                )}
              </div>
            </div>

            {onPrevious && (
              <button
                type="button"
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  moveMedia(-1);
                }}
                className="absolute left-2 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white shadow-2xl backdrop-blur transition hover:bg-white/20 active:scale-95 md:left-4"
                aria-label="Previous media"
              >
                <ChevronLeft size={28} />
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  moveMedia(1);
                }}
                className="absolute right-2 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white shadow-2xl backdrop-blur transition hover:bg-white/20 active:scale-95 md:right-4"
                aria-label="Next media"
              >
                <ChevronRight size={28} />
              </button>
            )}

            {media.type !== 'video' && (
              <div className="mx-auto mt-3 flex items-center gap-2 rounded-2xl bg-white/10 p-2 text-white backdrop-blur">
                <button type="button" onClick={() => zoomBy(-0.4)} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/20" aria-label="Zoom out">
                  <Minus size={18} />
                </button>
                <button type="button" onClick={resetZoom} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/20" aria-label="Reset zoom">
                  <RotateCcw size={18} />
                </button>
                <span className="min-w-14 text-center text-xs font-black">{Math.round(scale * 100)}%</span>
                <button type="button" onClick={() => zoomBy(0.4)} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/20" aria-label="Zoom in">
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
