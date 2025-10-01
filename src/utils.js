export function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

export function lerp(start, end, t){
  return start + (end - start) * t;
}

export function distance(x1, y1, x2, y2){
  const dx = x2 - x1; const dy = y2 - y1; return Math.hypot(dx, dy);
}

export function isReducedMotion(){
  if (!window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isTouchLike(){
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

export function onMediaQuery(query, handler){
  if (!window.matchMedia) return () => {};
  const mq = window.matchMedia(query);
  const listener = () => handler(mq.matches);
  if (mq.addEventListener) mq.addEventListener('change', listener);
  else mq.addListener(listener);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', listener);
    else mq.removeListener(listener);
  };
}


