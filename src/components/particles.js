import { isReducedMotion, isTouchLike } from '../utils.js';

export default class Particles {
  constructor(canvas, max = 60){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.max = max;
    this.pool = Array.from({ length: max }, () => ({ alive: false }));
    this._running = true;
    this._reduced = isReducedMotion();
    this._touch = isTouchLike();
    this._loop = this._loop.bind(this);
    this._resize = this._resize.bind(this);
    this._resize();
    window.addEventListener('resize', this._resize);
    requestAnimationFrame(this._loop);
  }

  _resize(){
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  spawn(x, y){
    if (!this._running || this._reduced || this._touch) return;
    const p = this.pool.find(p => !p.alive);
    if (!p) return;
    p.alive = true;
    p.x = x; p.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * 1.6;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 0;
    p.maxLife = 40 + Math.random() * 40;
    p.size = 1 + Math.random() * 3;
  }

  _loop(){
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.pool){
      if (!p.alive) continue;
      p.x += p.vx; p.y += p.vy; p.life++;
      const t = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - t);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(107,114,128,0.3)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t), 0, Math.PI * 2); ctx.fill();
      if (p.life > p.maxLife) p.alive = false;
    }
    requestAnimationFrame(this._loop);
  }

  pause(){ this._running = false; }
  resume(){ this._running = true; }
  destroy(){ this._running = false; window.removeEventListener('resize', this._resize); }
}


