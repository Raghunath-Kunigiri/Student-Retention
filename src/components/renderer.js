export default class Renderer {
  constructor(){
    this.queue = [];
    this._rafId = null;
    this._commit = this._commit.bind(this);
  }

  queueTransform(element, translateX, translateY, options = {}){
    const { scale = 1, rotate = 0 } = options;
    const transform = `translate3d(${translateX}px, ${translateY}px, 0)${scale !== 1 ? ` scale(${scale})` : ''}${rotate ? ` rotate(${rotate}deg)` : ''}`;
    this.queue.push({ element, transform });
    if (this._rafId == null) this._rafId = requestAnimationFrame(this._commit);
  }

  queueStyle(element, styles){
    this.queue.push({ element, styles });
    if (this._rafId == null) this._rafId = requestAnimationFrame(this._commit);
  }

  _commit(){
    for (const item of this.queue){
      if (item.transform !== undefined){
        item.element.style.transform = item.transform;
      }
      if (item.styles){
        for (const key in item.styles){
          item.element.style[key] = item.styles[key];
        }
      }
    }
    this.queue.length = 0;
    this._rafId = null;
  }
}


