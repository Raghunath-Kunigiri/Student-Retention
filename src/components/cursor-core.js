import { isReducedMotion } from '../utils.js';

export default class CursorCore {
  constructor(element){
    this.el = element;
    this.enabled = true;
    this.pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.smoothPos = { ...this.pos };
    this.velocity = { x: 0, y: 0 };
    this.shape = 'dot';
    this._lerp = isReducedMotion() ? 1 : 0.12;
    this._last = { ...this.pos };
    this._visible = false;

    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerEnter = this._onPointerEnter.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._loop = this._loop.bind(this);

    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    window.addEventListener('pointerup', this._onPointerUp, { passive: true });
    document.addEventListener('pointerenter', this._onPointerEnter, { passive: true });
    document.addEventListener('pointerleave', this._onPointerLeave, { passive: true });
    requestAnimationFrame(this._loop);
  }

  _onPointerMove(e){
    this.pos.x = e.clientX;
    this.pos.y = e.clientY;
    if (!this._visible) {
      this.show();
    }
    const detail = { x: this.pos.x, y: this.pos.y };
    this.el.dispatchEvent(new CustomEvent('cursor:move', { detail }));
  }

  _onPointerDown(){
    this.el.classList.add('is-pressing');
    this.el.dispatchEvent(new CustomEvent('cursor:down'));
  }

  _onPointerUp(){
    this.el.classList.remove('is-pressing');
    this.el.dispatchEvent(new CustomEvent('cursor:up'));
  }

  _onPointerEnter(){
    this.show();
  }

  _onPointerLeave(){
    this.hide();
  }

  _loop(){
    this.smoothPos.x += (this.pos.x - this.smoothPos.x) * this._lerp;
    this.smoothPos.y += (this.pos.y - this.smoothPos.y) * this._lerp;
    this.velocity.x = this.smoothPos.x - this._last.x;
    this.velocity.y = this.smoothPos.y - this._last.y;
    this._last.x = this.smoothPos.x;
    this._last.y = this.smoothPos.y;
    this.el.style.transform = `translate3d(${this.smoothPos.x}px, ${this.smoothPos.y}px, 0) translate(-50%,-50%)`;
    if (this.enabled) requestAnimationFrame(this._loop);
  }

  setShape(shapeName){
    this.shape = shapeName;
  }

  show(){ 
    this._visible = true;
    this.el.classList.add('is-visible');
    document.body.classList.add('cursor-active');
  }
  hide(){ 
    this._visible = false;
    this.el.classList.remove('is-visible');
    document.body.classList.remove('cursor-active');
  }

  destroy(){
    this.enabled = false;
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointerup', this._onPointerUp);
    document.removeEventListener('pointerenter', this._onPointerEnter);
    document.removeEventListener('pointerleave', this._onPointerLeave);
  }
}


