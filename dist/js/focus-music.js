// Original procedural scores, rendered once per layout and looped by the audio engine.
// No recordings, external assets, or background JavaScript scheduling.
export function musicProfile(layout){
  if(layout==='builder')return {layout,bpm:108,label:'Electronic pulse',description:'Original electronic loop: synth arpeggios, a rounded bass line, and a restrained drum groove at 108 BPM.'};
  if(layout==='founder')return {layout,bpm:96,label:'Baroque-inspired keys',description:'Original Baroque-inspired loop: plucked keyboard tones, a moving bass line, and interwoven melodic figures at 96 BPM.'};
  return {layout:'zen',label:'Warm ambient sound',description:'Soft, warm ambient sound for an unhurried pace.'};
}
export function musicLength(sampleRate,layout){return Math.round(sampleRate*60/musicProfile(layout).bpm*64);}
export function renderMusic(data,rate,layout){
  const profile=musicProfile(layout);if(profile.layout==='zen')throw new Error('Zen uses the ambient noise layer.');
  const beat=60/profile.bpm,tau=2*Math.PI;
  const frequency=midi=>440*2**((midi-69)/12);
  function note(midi,at,length,volume,kind){
    const start=Math.round(at*rate),count=Math.ceil(length*rate),hz=frequency(midi);
    for(let i=0;i<count;i++){
      const t=i/rate,attack=Math.min(1,t/.008),release=Math.min(1,(length-t)/.06);let value;
      if(kind==='keys')value=(Math.sin(tau*hz*t)+.42*Math.sin(tau*hz*2*t)+.2*Math.sin(tau*hz*3*t)+.09*Math.sin(tau*hz*4*t))*Math.exp(-t*4.5);
      else if(kind==='bass')value=Math.sin(tau*hz*t)*Math.exp(-t*3);
      else value=(Math.sin(tau*hz*t)+.22*Math.sin(tau*hz*2*t))*Math.exp(-t*9);
      data[(start+i)%data.length]+=value*volume*attack*Math.max(0,release);
    }
  }
  // C major, A minor, F major, G major; each progression spans four bars.
  const chords=[[60,64,67],[57,60,64],[53,57,60],[55,59,62]];
  let seed=1729;
  function noise(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;}
  function drum(at,kind){
    const start=Math.round(at*rate),length=kind==='kick'?.32:.12;
    for(let i=0;i<length*rate;i++){
      const t=i/rate;
      const value=kind==='kick'?Math.sin(tau*(48*t+70*.025*(1-Math.exp(-t/.025))))*Math.exp(-t*18)*.3:noise()*Math.exp(-t*(kind==='hat'?85:35))*(kind==='hat'?.035:.075);
      data[(start+i)%data.length]+=value*Math.min(1,t/.002);
    }
  }
  for(let bar=0;bar<16;bar++){
    const chord=chords[bar%4],at=bar*4*beat;
    for(let b=0;b<4;b++)note(chord[b%2===0?0:2]-12,at+b*beat,beat*.85,layout==='builder'?.19:.12,'bass');
    if(layout==='builder'){
      for(let step=0;step<8;step++)note(chord[[0,1,2,1,0,2,1,2][step]]+12,at+step*beat/2,beat*.7,.075,'synth');
      for(let b=0;b<4;b++){drum(at+b*beat,'kick');if(b%2)drum(at+b*beat,'snare');drum(at+(b+.5)*beat,'hat');}
    }else{
      const figure=bar%2?[2,1,0,1,2,1,0,2]:[0,1,2,1,0,2,1,2];
      for(let step=0;step<8;step++)note(chord[figure[step]]+12+(step===6&&bar%4===3?12:0),at+step*beat/2,beat*.9,.13,'keys');
      for(let b=0;b<4;b++)note(chord[(b+1)%3],at+b*beat,beat*1.3,.08,'keys');
    }
  }
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.8/peak;
}
