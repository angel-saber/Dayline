// One delegated pointer controller; never blocks vertical scrolling on note cards.
export function attachGestures(root, {complete,remove,move,announce}) {
  let active=null,suppressClick=false;
  root.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}},true);
  const clear=()=>{
    if(!active)return;
    clearTimeout(active.hold);cancelAnimationFrame(active.frame);
    active.card?.classList.remove('dragging','swiping');
    active.card?.style.removeProperty('--swipe');
    document.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));
    active=null;
  };
  function targetAt(x,y) { return document.elementFromPoint(x,y)?.closest('.slot'); }
  root.addEventListener('pointerdown',e=>{
    if(e.button!==0 || e.target.closest('textarea,select,input,a,details') || (e.target.closest('button')&&!e.target.closest('.note-text'))) return;
    const card=e.target.closest('.entry'); if(!card)return;
    active={id:card.dataset.id,card,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,pointer:e.pointerId,drag:false,handle:!!e.target.closest('.drag-handle')};
    if(active.handle) {
      active.hold=setTimeout(()=>{
        if(!active)return;active.drag=true;card.classList.add('dragging');
        card.setPointerCapture(e.pointerId);announce('Move to a time slot, then release.');
        function scroll(){
          if(!active?.drag)return;
          const y=active.lastY;
          if(y<110)window.scrollBy(0,-12);else if(y>innerHeight-110)window.scrollBy(0,12);
          active.frame=requestAnimationFrame(scroll);
        } scroll();
      },350);
    }
  });
  root.addEventListener('pointermove',e=>{
    if(!active || e.pointerId!==active.pointer)return;
    const dx=e.clientX-active.x,dy=e.clientY-active.y;
    active.lastX=e.clientX;active.lastY=e.clientY;
    if(active.drag) {
      e.preventDefault();
      document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));
      const target=targetAt(e.clientX,e.clientY);target?.classList.add('drop-target');
      active.target=target?.dataset.minute;return;
    }
    if(Math.abs(dx)>8||Math.abs(dy)>8)clearTimeout(active.hold);
    if(!active.handle && Math.abs(dx)>Math.abs(dy)*1.5 && Math.abs(dx)>12) {
      active.card.classList.add('swiping');active.card.style.setProperty('--swipe',`${Math.max(-110,Math.min(110,dx))}px`);
    }
  });
  root.addEventListener('pointerup',e=>{
    if(!active || active.pointer!==e.pointerId)return;
    const {id,drag,target,handle,x,y}=active,dx=e.clientX-x,dy=e.clientY-y;
    clear();
    if(drag&&target!==undefined){suppressClick=true;move(id,Number(target));}
    else if(!handle && Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.5) {suppressClick=true;if(dx>0)complete(id);else remove(id);}
    if(suppressClick)setTimeout(()=>{suppressClick=false;},0);
  });
  root.addEventListener('pointercancel',clear);
  window.addEventListener('blur',clear);
  return clear;
}
