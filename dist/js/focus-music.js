// Original procedural scores, rendered once per layout and looped by the audio engine.
// No recordings, external assets, or background JavaScript scheduling.
export function musicProfile(layout){
  if(layout==='builder')return {layout,bpm:112,label:'Cyberpunk drive',description:'Dark cyberpunk loop: distorted synth bass, punchy breakbeats, minor-key atmosphere, and glitch accents at 112 BPM.'};
  if(layout==='founder')return {layout,bpm:96,label:'Baroque-inspired keys',description:'Original Baroque-inspired loop: plucked keyboard tones, a moving bass line, and interwoven melodic figures at 96 BPM.'};
  return {layout:'zen',label:'Warm ambient sound',description:'Soft, warm ambient sound for an unhurried pace.'};
}
export function musicLength(sampleRate,layout){return Math.round(sampleRate*60/musicProfile(layout).bpm*64);}
export function renderMusic(data,rate,layout){
  const profile=musicProfile(layout);if(profile.layout==='zen')throw new Error('Zen uses the ambient noise layer.');
  if(layout==='builder'){renderCyberpunk(data,rate);return;}
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
  for(let bar=0;bar<16;bar++){
    const chord=chords[bar%4],at=bar*4*beat;
    for(let b=0;b<4;b++)note(chord[b%2===0?0:2]-12,at+b*beat,beat*.85,.12,'bass');
      const figure=bar%2?[2,1,0,1,2,1,0,2]:[0,1,2,1,0,2,1,2];
      for(let step=0;step<8;step++)note(chord[figure[step]]+12+(step===6&&bar%4===3?12:0),at+step*beat/2,beat*.9,.13,'keys');
      for(let b=0;b<4;b++)note(chord[(b+1)%3],at+b*beat,beat*1.3,.08,'keys');
  }
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.8/peak;
}

// A sparse E-minor industrial groove with a half-time backbeat and four-bar fills.
function renderCyberpunk(data,rate){
  const beat=60/112,tau=2*Math.PI;
  let seed=7319;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  function sound(at,length,fn){
    const start=Math.round(at*rate),count=Math.ceil(length*rate);
    for(let i=0;i<count;i++){
      const t=i/rate,edge=Math.min(1,t/.003,(length-t)/.012);
      data[(start+i)%data.length]+=fn(t)*Math.max(0,edge);
    }
  }
  function bass(midi,at,length){
    const hz=440*2**((midi-69)/12);
    sound(at,length,t=>{
      // Band-limited harmonics add grit without a harsh full-spectrum saw wave.
      let wave=0;
      for(let h=1;h<=7&&hz*h<rate*.42;h++)wave+=Math.sin(tau*hz*h*t+Math.sin(tau*.3*t)*.08)/h;
      const grit=Math.tanh(wave*2.2)*.16,sub=Math.sin(tau*hz*t)*.13;
      const pump=.45+.55*Math.min(1,(t%beat)/.14);
      return (grit+sub)*Math.exp(-t*1.8)*pump;
    });
  }
  function kick(at){sound(at,.4,t=>(Math.sin(tau*(43*t+100*.018*(1-Math.exp(-t/.018))))*Math.exp(-t*13)*.52+noise()*Math.exp(-t*190)*.055));}
  function snare(at){let previous=0;sound(at,.22,t=>{const n=noise(),high=n-previous;previous=n;return high*Math.exp(-t*22)*.1+Math.sin(tau*175*t)*Math.exp(-t*32)*.11;});}
  function hat(at,open=false){let previous=0;sound(at,open?.17:.055,t=>{const n=noise(),high=n-previous;previous=n;return high*Math.exp(-t*(open?30:85))*.027;});}
  function atmosphere(root,at){
    sound(at,beat*4,t=>{
      const envelope=Math.sin(Math.PI*t/(beat*4))**2;
      return [0,3,7].reduce((sum,offset)=>{const hz=440*2**((root+offset-69)/12);return sum+Math.sin(tau*hz*t)*.012+Math.sin(tau*hz*1.003*t)*.009;},0)*envelope;
    });
  }
  const riff=[0,.75,1.5,2.5,3.25,3.75];
  for(let bar=0;bar<16;bar++){
    const at=bar*4*beat,root=[28,28,24,26][Math.floor(bar/2)%4];
    riff.forEach((position,i)=>bass(root+(i===3?7:i===5&&bar%4===3?12:0),at+position*beat,beat*(i===0?.6:.27)));
    [0,1.5,2.75].forEach(position=>kick(at+position*beat));
    snare(at+2*beat);
    for(let step=0;step<8;step++)if(step!==4)hat(at+step*beat/2,step===7);
    if(bar%4===3){snare(at+3.5*beat);hat(at+3.75*beat);}
    atmosphere(root+36,at);
    // Short, low-volume digital stutters punctuate the ends of phrases.
    if(bar%2===1)for(let j=0;j<3;j++)sound(at+(3.5+j*.125)*beat,.045,t=>Math.sin(tau*(880+j*220)*t)*Math.exp(-t*70)*.025);
  }
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.8/peak;
}
