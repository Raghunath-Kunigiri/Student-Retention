import Renderer from './renderer.js';
import Tooltip from './tooltip.js';
import { distance, isReducedMotion, isTouchLike } from '../utils.js';

export default class InteractionManager {
  constructor(options = {}){
    this.renderer = options.renderer || new Renderer();
    this.tooltip = options.tooltip || new Tooltip();
    this.magnetOpts = options.magnet || { radius: 120, strength: 0.16 };
    this._reduced = isReducedMotion();
    this._touch = isTouchLike();

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerEnter = this._onPointerEnter.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._onClick = this._onClick.bind(this);

    this._activeTooltipTarget = null;
  }

  attach(root = document){
    // Tooltip targets
    root.addEventListener('pointerenter', this._onPointerEnter, true);
    root.addEventListener('pointerleave', this._onPointerLeave, true);
    root.addEventListener('pointermove', this._onPointerMove, { passive: true, capture: true });
    // Ripple
    root.addEventListener('click', this._onClick, true);
  }

  detach(root = document){
    root.removeEventListener('pointerenter', this._onPointerEnter, true);
    root.removeEventListener('pointerleave', this._onPointerLeave, true);
    root.removeEventListener('pointermove', this._onPointerMove, true);
    root.removeEventListener('click', this._onClick, true);
  }

  _onPointerEnter(e){
    if (!e.target || !e.target.closest) return;
    const target = e.target.closest('[data-tooltip], [data-magnet]');
    if (!target) return;
    if (target.hasAttribute('data-tooltip')){
      const content = target.getAttribute('data-tooltip') || '';
      this.tooltip.showFor(target, content);
      this._activeTooltipTarget = target;
    }
  }

  _onPointerLeave(e){
    if (!e.target || !e.target.closest) return;
    const target = e.target.closest('[data-tooltip], [data-magnet]');
    if (!target) return;
    if (this._activeTooltipTarget === target){
      this.tooltip.hide(target);
      this._activeTooltipTarget = null;
    }
    // Reset magnet transform
    if (target.hasAttribute('data-magnet')){
      target.style.transform = '';
    }
  }

  _onPointerMove(e){
    // Tooltip follow
    if (this._activeTooltipTarget){
      this.tooltip.updateFor({ x: e.clientX, y: e.clientY });
    }
    // Magnet
    if (e.target && e.target.closest) {
      const mag = e.target.closest('[data-magnet]');
      if (mag && !this._touch){
        this._applyMagnet(mag, e.clientX, e.clientY);
      }
    }
  }

  _applyMagnet(el, px, py){
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = px - cx;
    const dy = py - cy;
    const dist = distance(px, py, cx, cy);
    const radius = Number(el.getAttribute('data-magnet-radius')) || this.magnetOpts.radius;
    const strength = Number(el.getAttribute('data-magnet-strength')) || this.magnetOpts.strength;
    if (dist < radius && !this._reduced){
      const force = (1 - dist / radius) * strength;
      const scale = 1 + force * 0.15;
      this.renderer.queueTransform(el, dx * force, dy * force, { scale });
    } else {
      this.renderer.queueStyle(el, { transform: '' });
    }
  }

  _onClick(e){
    if (!e.target || !e.target.closest) return;
    const container = e.target.closest('.ripple-container');
    if (!container) return;
    this._spawnRipple(container, e.clientX, e.clientY);
  }

  _spawnRipple(container, px, py){
    if (this._reduced) return;
    const rect = container.getBoundingClientRect();
    const x = px - rect.left; const y = py - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const maxDim = Math.max(rect.width, rect.height);
    const size = maxDim * 1.2;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.opacity = '0.25';
    container.appendChild(ripple);
    const start = performance.now();
    const dur = 420;
    const animate = (t) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / dur);
      const scale = 0.2 + p;
      ripple.style.transform = `translate3d(-50%,-50%,0) scale(${scale})`;
      ripple.style.opacity = String(0.25 * (1 - p));
      if (p < 1) requestAnimationFrame(animate);
      else container.removeChild(ripple);
    };
    requestAnimationFrame(animate);
  }
}


