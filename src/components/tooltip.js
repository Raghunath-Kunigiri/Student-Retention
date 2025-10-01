export default class Tooltip {
  constructor(){
    this.el = document.createElement('div');
    this.el.className = 'tooltip';
    this.el.setAttribute('role', 'tooltip');
    document.body.appendChild(this.el);
    this.visible = false;
  }

  showFor(target, content){
    this.el.textContent = content;
    const id = 'tt-' + Math.random().toString(36).slice(2,8);
    this.el.id = id;
    target.setAttribute('aria-describedby', id);
    this.el.classList.add('is-visible');
    this.visible = true;
  }

  updateFor(pointerPos){
    if (!this.visible) return;
    const offset = 16;
    const x = pointerPos.x + offset;
    const y = pointerPos.y + offset;
    this.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  hide(target){
    this.el.classList.remove('is-visible');
    if (target) target.removeAttribute('aria-describedby');
    this.visible = false;
  }
}


