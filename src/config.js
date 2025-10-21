const config = {
  cursorSize: 28,
  enableParticles: false,
  particleMax: 80,
  magnet: { radius: 120, strength: 0.16 },
  breakpoints: { disableParticlesBelow: 768 },
  reducedMotion: window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
};

export default config;


