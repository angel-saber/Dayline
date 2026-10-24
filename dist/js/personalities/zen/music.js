export function renderScore(data,rate){
  const tau=2*Math.PI;
  function bowl(midi,at,length,volume,bell=false){
    const hz=440*2**((midi-69)/12),start=Math.round(at*rate);
    const partials=bell?[[1,1],[2.76,.22],[5.4,.07]]:[[1,1],[2.71,.28],[5.18,.09],[1.006,.38]];
    for(let i=0;i<length*rate;i++){
      const t=i/rate,attack=Math.min(1,t/(bell?.035:.28)),release=Math.min(1,(length-t)/1.8);
      let value=0;
      for(let p=0;p<partials.length;p++){
        const [ratio,level]=partials[p];
        if(hz*ratio<rate*.42)value+=Math.sin(tau*hz*ratio*t)*level*Math.exp(-t*(bell?.65:.19)*(1+p*.45));
      }
      data[(start+i)%data.length]+=value*volume*attack*Math.max(0,release);
    }
  }
  // A spacious 64-second phrase with gently overlapping low bowls.
  for(const [midi,at] of [[48,0],[55,12],[50,24],[57,36],[55,48]])bowl(midi,at,20,.18);
  for(const [midi,at] of [[72,7],[79,29],[74,51]])bowl(midi,at,9,.045,true);
  const dry=data.slice();
  for(const [seconds,gain] of [[.19,.13],[.37,.1],[.61,.075],[.97,.045]]){
    const delay=Math.round(seconds*rate);for(let i=0;i<data.length;i++)data[(i+delay)%data.length]+=dry[i]*gain;
  }
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.8/peak;
}
