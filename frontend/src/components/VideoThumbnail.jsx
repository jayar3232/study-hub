import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { PlayCircle } from 'lucide-react';
import useRenderDebug from '../hooks/useRenderDebug';

const withPreviewTime = (src) => {
  if (!src) return '';
  if (src.includes('#')) return src;
  return `${src}#t=0.1`;
};

function VideoThumbnail({
  src,
  className = '',
  videoClassName = '',
  iconSize = 28,
  showOverlay = true,
  rounded = 'rounded-2xl',
  label = 'Video preview',
  preload = 'metadata',
  onReady
}) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const revealedRef = useRef(false);
  const previewSrc = useMemo(() => withPreviewTime(src), [src]);
  const canUseIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;
  const [shouldLoad, setShouldLoad] = useState(!canUseIntersectionObserver);

  useRenderDebug('VideoThumbnail', () => ({
    src: previewSrc,
    shouldLoad
  }));

  useEffect(() => {
    revealedRef.current = false;
    setShouldLoad(!canUseIntersectionObserver);
  }, [canUseIntersectionObserver, previewSrc]);

  useEffect(() => {
    if (!canUseIntersectionObserver || shouldLoad || !wrapperRef.current) return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting || entry.intersectionRatio > 0)) return;
      setShouldLoad(true);
      observer.disconnect();
    }, {
      rootMargin: '360px 0px'
    });

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [canUseIntersectionObserver, shouldLoad, previewSrc]);

  const revealFirstFrame = (event) => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      try {
        video.currentTime = Math.min(0.12, Math.max(0, video.duration - 0.05));
      } catch {
        // Some mobile browsers block seeking before enough metadata is ready.
      }
    }
    onReady?.(event);
  };

  return (
    <span ref={wrapperRef} className={`relative block overflow-hidden bg-black ${rounded} ${className}`}>
      <video
        ref={videoRef}
        src={shouldLoad ? previewSrc : undefined}
        muted
        playsInline
        preload={preload}
        controls={false}
        disablePictureInPicture
        tabIndex={-1}
        aria-label={label}
        onLoadedMetadata={revealFirstFrame}
        onLoadedData={revealFirstFrame}
        className={`pointer-events-none h-full w-full object-cover ${rounded} ${videoClassName}`}
      />
      {showOverlay && (
        <span className="absolute inset-0 grid place-items-center bg-black/12">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-gray-950 shadow-2xl backdrop-blur">
            <PlayCircle size={iconSize} fill="currentColor" />
          </span>
        </span>
      )}
    </span>
  );
}

export default memo(VideoThumbnail);
