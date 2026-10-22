/* Device appearance is independent of notes, backups, and focus sessions. */
(()=>{
  const key='dayline.appearance.v1',layouts=['zen','builder','founder'];
  let current='zen';
  try{const saved=localStorage.getItem(key);if(layouts.includes(saved))current=saved;}catch{}
  function apply(value){
    document.documentElement.dataset.layout=value;
    window.dispatchEvent(new Event('dayline:appearance'));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',({zen:'#f5f4ef',builder:'#0b111b',founder:'#eee5d6'})[value]);
  }
  apply(current);
  document.addEventListener('DOMContentLoaded',()=>{
    const choices=document.querySelectorAll('input[name="layout"]'),status=document.querySelector('#layout-status');
    function select(value){current=value;apply(value);choices.forEach(input=>{input.checked=input.value===value;});}
    select(current);
    choices.forEach(input=>input.addEventListener('change',()=>{
      if(!input.checked||!layouts.includes(input.value))return;
      select(input.value);
      try{localStorage.setItem(key,current);status.textContent='Layout saved on this device.';}catch{status.textContent='Layout applied for now. Your browser could not save this preference.';}
    }));
    window.addEventListener('storage',event=>{if(event.key===key)select(layouts.includes(event.newValue)?event.newValue:'zen');});
  });
})();
