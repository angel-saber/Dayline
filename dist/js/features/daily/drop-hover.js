// A replacement is armed only while the pointer stays over the same note.
export function dropHover({delay=800,onChange=()=>{},schedule=setTimeout,cancel=clearTimeout}={}){
  let target=null,armed=null,timer=null;
  function clear(){if(timer!==null)cancel(timer);timer=null;target=null;armed=null;onChange(null,false);}
  return {clear,get targetId(){return armed;},update(id){
    if(id===target)return;
    clear();target=id;if(!id)return;onChange(id,false);
    timer=schedule(()=>{timer=null;armed=id;onChange(id,true);},delay);
  }};
}
