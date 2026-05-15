import React, { memo, useEffect, useMemo, useRef } from 'react';
import { PlayCircle } from 'lucide-react';

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
  const videoRef = useRef(null);
  const revealedRef = useRef(false);
  const previewSrc = useMemo(() => withPreviewTime(src), [src]);

  useEffect(() => {
    revealedRef.current = false;
  }, [previewSrc]);

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
    <span className={`relative block overflow-hidden bg-black ${rounded} ${className}`}>
      <video
        ref={videoRef}
        src={previewSrc}
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
