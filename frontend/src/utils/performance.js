const hasWindow = () => typeof window !== 'undefined';

const getNow = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

export const isMobilePerformanceRuntime = () => {
  if (!hasWindow()) return false;
  return Boolean(window.Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    Boolean(window.matchMedia?.('(max-width: 900px), (pointer: coarse)').matches);
};

export const requestIdleWork = (callback, { timeout = 600 } = {}) => {
  if (!hasWindow()) {
    callback({ didTimeout: true, timeRemaining: () => 0 });
    return null;
  }

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout });
    return { type: 'idle', id };
  }

  const start = getNow();
  const id = window.setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 12 - (getNow() - start))
    });
  }, 1);
  return { type: 'timeout', id };
};

export const cancelIdleWork = (handle) => {
  if (!handle || !hasWindow()) return;
  if (handle.type === 'idle' && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle.id);
    return;
  }
  window.clearTimeout(handle.id);
};

export const createFrameBatcher = (flush) => {
  let frameId = 0;
  let queue = [];

  const run = () => {
    frameId = 0;
    const items = queue;
    queue = [];
    if (items.length) flush(items);
  };

  const schedule = () => {
    if (frameId || !hasWindow()) return;
    frameId = window.requestAnimationFrame(run);
  };

  return {
    push(item) {
      queue.push(item);
      schedule();
    },
    flushNow() {
      if (frameId && hasWindow()) window.cancelAnimationFrame(frameId);
      run();
    },
    cancel() {
      if (frameId && hasWindow()) window.cancelAnimationFrame(frameId);
      frameId = 0;
      queue = [];
    }
  };
};

export const scheduleChunkedWork = (items, worker, {
  chunkSize = 8,
  timeout = 700,
  onComplete
} = {}) => {
  let index = 0;
  let cancelled = false;
  let idleHandle = null;
  const list = Array.isArray(items) ? items : [];

  const runChunk = (deadline) => {
    if (cancelled) return;

    let processed = 0;
    while (
      index < list.length &&
      processed < chunkSize &&
      (deadline.didTimeout || deadline.timeRemaining() > 3)
    ) {
      worker(list[index], index);
      index += 1;
      processed += 1;
    }

    if (index < list.length) {
      idleHandle = requestIdleWork(runChunk, { timeout });
      return;
    }

    onComplete?.();
  };

  idleHandle = requestIdleWork(runChunk, { timeout });

  return () => {
    cancelled = true;
    cancelIdleWork(idleHandle);
  };
};
