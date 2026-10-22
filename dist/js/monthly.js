import {voice,focusMantras,focusIdeas} from './personality.js?v=plan-labels-2';
import {dateActions} from './date-actions.js?v=quick-add-1';
import {dayKey,parseDay,timeLabel} from './model.js';
import {monthWeeks,offsetMonth,noteTitle} from './month-model.js?v=monthly-1';
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
const button=(text,label,action)=>{const el=node('button','',text);el.type='button';el.setAttribute('aria-label',label);el.addEventListener('click',action);return el;};
export function setupMonthly({root,getState,onOpen,onMove,onAdd,announce}){
  let month=dayKey().slice(0,7),drag=null,hoverTimer=null,touch=null,suppressClick=false;
  const dates=dateActions({onAdd:quickAdd,onOpen,isActive:()=>!root.hidden});
  function quickAdd(date){
    const dialog=node('dialog','month-quick-dialog'),form=node('form');
    const dateLabel=parseDay(date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
    const heading=node('h2','',`Quick note · ${dateLabel}`);heading.id='quick-note-heading';dialog.setAttribute('aria-labelledby',heading.id);
    const titleLabel=node('label','','Note title'),title=node('input');title.type='text';title.required=true;title.maxLength=200;title.placeholder='What would you like to plan?';title.setAttribute('aria-label','Quick note title');titleLabel.append(title);
    const timeLabel=node('label','','Time'),time=node('input');time.type='time';time.required=true;time.step='60';time.value='09:00';time.setAttribute('aria-label','Quick note time');timeLabel.append(time);
    const actions=node('div','inline'),add=node('button','primary','Add note');add.type='submit';
    actions.append(add,button('Cancel','Cancel quick note',()=>dialog.close()),button('Open day','Open this date in Daily',()=>{dialog.close();onOpen(date);}));
    form.append(heading,titleLabel,timeLabel,actions);dialog.append(form);document.body.append(dialog);
    title.addEventListener('input',()=>title.setCustomValidity(''));
    form.addEventListener('submit',event=>{
      event.preventDefault();title.setCustomValidity(title.value.trim()?'':'Enter a note title.');
      if(!form.reportValidity())return;if(onAdd(date,title.value,time.value)!==false)dialog.close();
    });
    dialog.addEventListener('close',()=>{dialog.remove();if(!root.hidden)root.querySelector(`[data-date="${date}"] .month-day-heading`)?.focus({preventScroll:true});});
    dialog.showModal();title.focus();
  }
  function shift(delta){month=offsetMonth(month,delta);render();}
  function chooseDate(source,id){
    const entry=getState().days[source]?.find(e=>e.id===id);if(!entry)return;
    const dialog=node('dialog','month-move-dialog'),form=node('form'),heading=node('h2','',`Move “${noteTitle(entry)}”`);
    const label=node('label','','New date'),input=node('input');input.type='date';input.value=source;input.required=true;input.setAttribute('aria-label','New date for note');label.append(input);
    const actions=node('div','inline'),cancel=button('Cancel','Cancel move',()=>dialog.close()),submit=node('button','primary','Move note');submit.type='submit';actions.append(cancel,submit);form.append(heading,label,actions);dialog.append(form);document.body.append(dialog);
    form.addEventListener('submit',event=>{event.preventDefault();if(!input.reportValidity())return;if(onMove(source,id,input.value)!==false)dialog.close();});
    dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();input.focus();
  }
  function render(){
    dates.reset();
    const content=document.createDocumentFragment(),head=node('div','month-heading'),heading=node('h1','',parseDay(month+'-01').toLocaleDateString(undefined,{month:'long',year:'numeric'}));heading.id='month-heading';
    const nav=node('div','month-navigation');
    const previous=button('←','Previous month',()=>shift(-1)),next=button('→','Next month',()=>shift(1));previous.dataset.monthStep=-1;next.dataset.monthStep=1;
    const picker=node('input');picker.type='month';picker.value=month;picker.setAttribute('aria-label','Go to month');picker.addEventListener('change',()=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(picker.value)){month=picker.value;render();}});
    nav.append(previous,picker,next,button('This month','Go to this month',()=>{month=dayKey().slice(0,7);render();}));head.append(heading,nav);
    content.append(node('div','eyebrow',voice("A LITTLE ROOM TO SEE AHEAD")),head,node('p','intro','Click or tap a date to add a title and time. Double-click or double-tap to open its day. Drag titles to reschedule.'));
    for(const week of monthWeeks(month)){
      const section=node('section','month-week');const weekHeading=node('h2','',`Week of ${parseDay(week[0]).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`);section.append(weekHeading);
      const grid=node('div','month-grid');
      for(const date of week){
        const day=node('section',`month-day${date.slice(0,7)!==month?' outside-month':''}${date===dayKey()?' month-today':''}`);day.dataset.date=date;
        const dateLabel=parseDay(date).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});day.setAttribute('aria-label',dateLabel);
        const open=button(parseDay(date).toLocaleDateString(undefined,{weekday:'short',day:'numeric'}),`Add a note on ${dateLabel}`,event=>dates.click(date,event.detail));open.className='month-day-heading';open.title='Click to add a note · Double-click to open Daily';
        open.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();dates.reset();onOpen(date);}});day.append(open);
        day.addEventListener('click',event=>{if(event.target.closest('button,input,.month-note'))return;dates.click(date,event.detail);});
        const list=node('div','month-notes');
        for(const entry of getState().days[date]||[]){
          const card=node('div',`month-note${entry.done?' completed':''}`);card.draggable=true;card.dataset.id=entry.id;card.dataset.source=date;
          const title=noteTitle(entry),edit=button(title,`Open note: ${title}`,()=>onOpen(date,entry.id));edit.className='month-note-title';edit.append(node('span','month-note-time',timeLabel(entry.minute,getState().settings.clock)));
          const handle=button('⠿',`Hold to drag ${title}, or choose a date`,()=>chooseDate(date,entry.id));handle.className='month-drag';
          const move=button('↗',`Move ${title} to another date`,()=>chooseDate(date,entry.id));move.className='month-move';
          card.append(handle,edit,move);list.append(card);
        }
        if(!list.children.length)list.append(node('span','month-empty','—'));
        day.append(list);grid.append(day);
      }
      section.append(grid);content.append(section);
    }
    root.replaceChildren(content);
  }
  function highlight(target){root.querySelectorAll('.month-drop-target').forEach(el=>el.classList.remove('month-drop-target'));target?.closest('.month-day')?.classList.add('month-drop-target');}
  function hoverMonth(target){
    const step=target?.closest('[data-month-step]');
    if(hoverTimer?.element===step)return;
    if(hoverTimer)clearTimeout(hoverTimer.timer);hoverTimer=null;
    if(step)hoverTimer={element:step,timer:setTimeout(()=>{shift(Number(step.dataset.monthStep));hoverTimer=null;},700)};
  }
  function clearDrag(){
    drag=null;if(hoverTimer)clearTimeout(hoverTimer.timer);hoverTimer=null;
    root.querySelectorAll('.month-drop-target').forEach(el=>el.classList.remove('month-drop-target'));
  }
  root.addEventListener('dragstart',event=>{
    const card=event.target.closest('.month-note');if(!card)return;
    dates.reset();drag={source:card.dataset.source,id:card.dataset.id};event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',card.querySelector('.month-note-title').textContent);
    announce('Drop the note on a day. Hover over a month arrow to change months.');
  });
  root.addEventListener('dragover',event=>{if(!drag)return;event.preventDefault();event.dataTransfer.dropEffect='move';highlight(event.target);hoverMonth(event.target);});
  root.addEventListener('drop',event=>{if(!drag)return;event.preventDefault();const day=event.target.closest('.month-day'),item=drag;clearDrag();if(day)onMove(item.source,item.id,day.dataset.date);});
  root.addEventListener('dragend',clearDrag);
  // Touch devices use a held drag handle, leaving normal page scrolling available.
  root.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'||!event.target.closest('.month-drag'))return;
    const card=event.target.closest('.month-note');touch={pointer:event.pointerId,x:event.clientX,y:event.clientY,source:card.dataset.source,id:card.dataset.id,active:false};
    touch.timer=setTimeout(()=>{if(!touch)return;touch.active=true;root.setPointerCapture(touch.pointer);announce('Drag to a day, then release.');},350);
  });
  root.addEventListener('pointermove',event=>{
    if(!touch||event.pointerId!==touch.pointer)return;
    if(!touch.active){if(Math.hypot(event.clientX-touch.x,event.clientY-touch.y)>10){clearTimeout(touch.timer);touch=null;}return;}
    event.preventDefault();const target=document.elementFromPoint(event.clientX,event.clientY);highlight(target);hoverMonth(target);
    if(event.clientY<100)window.scrollBy(0,-14);else if(event.clientY>innerHeight-100)window.scrollBy(0,14);
  });
  function release(event){
    if(!touch||event.pointerId!==touch.pointer)return;
    const item=touch;clearTimeout(item.timer);touch=null;
    if(item.active){suppressClick=true;setTimeout(()=>{suppressClick=false;},500);event.preventDefault();const day=document.elementFromPoint(event.clientX,event.clientY)?.closest('.month-day');clearDrag();if(event.type==='pointerup'&&day)onMove(item.source,item.id,day.dataset.date);}
  }
  root.addEventListener('pointerup',release);root.addEventListener('pointercancel',release);
  root.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();}},true);
  return {render,show(date){month=date.slice(0,7);render();}};
}
