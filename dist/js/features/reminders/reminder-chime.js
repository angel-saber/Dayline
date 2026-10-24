// A tiny, original PCM chime, generated locally. No remote audio or downloads.
export function reminderChime(silent=false){
  const rate=22050,length=Math.round(rate*1.05),bytes=new Uint8Array(44+length*2),view=new DataView(bytes.buffer);
  const word=(offset,text)=>[...text].forEach((letter,i)=>bytes[offset+i]=letter.charCodeAt(0));
  word(0,'RIFF');view.setUint32(4,bytes.length-8,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,length*2,true);
  if(!silent)for(let i=0;i<length;i++){
    let value=0;for(const [hz,start] of [[660,.03],[880,.25]]){const t=i/rate-start;if(t>=0&&t<.65){const envelope=Math.min(1,t/.025)*Math.exp(-t*7)*(1-t/.65);value+=Math.sin(2*Math.PI*hz*t)*envelope*.28;}}
    view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,value))*32767),true);
  }
  let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));return 'data:audio/wav;base64,'+btoa(binary);
}
