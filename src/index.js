import config from './config.js';
import CursorCore from './components/cursor-core.js';
import InteractionManager from './components/interaction-manager.js';
import Particles from './components/particles.js';

function init(){
  console.log('Initializing interactions...');
  const canvas = document.getElementById('particle-canvas');
  
  if (!canvas) {
    console.error('Particle canvas not found!');
  }

  // Skip custom cursor - use native cursor
  const interactions = new InteractionManager({ magnet: config.magnet });
  interactions.attach(document);

  let particles = null;
  const enableParticles = config.enableParticles && window.innerWidth >= config.breakpoints.disableParticlesBelow && !config.reducedMotion;
  console.log('Particles enabled:', enableParticles, 'Window width:', window.innerWidth, 'Config:', config);
  
  if (enableParticles && canvas){
    particles = new Particles(canvas, config.particleMax);
    console.log('Particles initialized');
    // Spawn particles on pointer move
    window.addEventListener('pointermove', (e) => {
      particles.spawn(e.clientX, e.clientY);
    }, { passive: true });
    
    // Spawn more particles on click
    window.addEventListener('pointerdown', (e) => {
      for(let i = 0; i < 3; i++) {
        particles.spawn(e.clientX, e.clientY);
      }
    }, { passive: true });
  }

  // Expose minimal API for quick toggles in console
  window.cursorFX = {
    interactions,
    particles,
    destroy(){
      interactions.detach(document);
      if (particles) particles.destroy();
    }
  };
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


