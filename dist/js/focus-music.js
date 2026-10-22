// Original procedural scores, rendered once per layout and looped by the audio engine.
// No recordings, external assets, or background JavaScript scheduling.
export function musicProfile(layout){
  if(layout==='builder')return {layout,bpm:112,label:'Cyberpunk drive',description:'Dark cyberpunk loop: distorted synth bass, punchy breakbeats, minor-key atmosphere, and glitch accents at 112 BPM.'};
  if(layout==='founder')return {layout,bpm:76,label:'Symphonic horizon',description:'Original synthesized orchestral score: sustained string-like ensembles, brass-like swells, deep bass, and timpani with a spacious hall effect at 76 BPM.'};
  return {layout:'zen',bpm:60,label:'Quiet piano',description:'Original synthesized ambient piano: slow, spacious notes over soft sustained pads at 60 BPM, without drums.'};
}
export function musicLength(sampleRate,layout){return Math.round(sampleRate*60/musicProfile(layout).bpm*64);}
export function renderMusic(data,rate,layout){
  const profile=musicProfile(layout);if(profile.layout==='zen'){renderPiano(data,rate);return;}
  if(layout==='builder'){renderCyberpunk(data,rate);return;}
  renderOrchestra(data,rate);
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

// Slow, connected orchestral voicings. Wavetables keep long ensemble notes inexpensive.
function renderOrchestra(data,rate){
  const beat=60/76,tau=2*Math.PI,size=2048;
  function table(harmonics){
    const values=new Float32Array(size);
    for(let i=0;i<size;i++)for(let h=1;h<=harmonics.length;h++)values[i]+=Math.sin(tau*i*h/size)*harmonics[h-1];
    return values;
  }
  const strings=table([.52,.21,.12,.065,.035,.02]),brass=table([.6,.24,.14,.075,.035]),bass=table([.8,.12,.04]);
  function sample(wave,phase){const at=((phase%1)+1)%1*size,i=Math.floor(at);return wave[i]+(wave[(i+1)%size]-wave[i])*(at-i);}
  function note(midi,at,length,volume,wave,ensemble=false){
    const hz=440*2**((midi-69)/12),start=Math.round(at*rate),count=Math.ceil(length*rate);
    let phase=0;
    for(let i=0;i<count;i++){
      const t=i/rate,u=t/length;
      const envelope=Math.min(1,t/.55)*Math.min(1,(length-t)/.7)*(.72+.28*Math.sin(Math.PI*u));
      phase+=hz/rate*(1+.0018*Math.sin(tau*4.7*t));
      let value=sample(wave,phase);
      if(ensemble)value=(value+sample(wave,phase*1.003+ .17)+sample(wave,phase*.997+ .39))/3;
      data[(start+i)%data.length]+=value*volume*Math.max(0,envelope);
    }
  }
  function timpani(at,midi,volume){
    const hz=440*2**((midi-69)/12),start=Math.round(at*rate);
    for(let i=0;i<rate*1.6;i++){
      const t=i/rate,value=(Math.sin(tau*hz*t)+.42*Math.sin(tau*hz*1.5*t)+.17*Math.sin(tau*hz*2.08*t))*Math.exp(-t*3.7)*Math.min(1,t/.006);
      data[(start+i)%data.length]+=value*volume;
    }
  }
  // D minor → B-flat → F → C, then G minor → B-flat → A → A: a broad eight-bar arc.
  const progression=[[50,57,62,65],[46,53,58,62],[41,53,57,60],[48,55,60,64],[43,55,58,62],[46,53,58,62],[45,52,57,61],[45,52,57,61]];
  const melody=[77,74,72,76,74,77,76,73,77,81,79,76,79,77,76,73];
  for(let bar=0;bar<16;bar++){
    const chord=progression[bar%8],at=bar*4*beat,secondHalf=bar>=8;
    chord.slice(1).forEach(midi=>note(midi,at,4.2*beat,.12,strings,true));
    note(chord[0]-12,at,4.1*beat,.16,bass);
    note(melody[bar],at+.25*beat,3.6*beat,secondHalf?.11:.08,strings,true);
    if(bar%2===0||secondHalf)chord.slice(1,3).forEach(midi=>note(midi,at+.4*beat,3.3*beat,secondHalf?.075:.045,brass,true));
    if(bar%2===0)timpani(at,chord[0]-12,.14);
    if(bar%4===3)timpani(at+3*beat,33,.075);
  }
  // A circular, non-recursive reverb tail carries naturally across the loop boundary.
  const dry=data.slice();
  for(const [seconds,gain] of [[.071,.13],[.113,.11],[.173,.09],[.239,.07],[.347,.055],[.503,.04]]){
    const delay=Math.round(seconds*rate);
    for(let i=0;i<data.length;i++)data[(i+delay)%data.length]+=dry[i]*gain;
  }
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.8/peak;
}

// Gentle, widely spaced piano-like notes with an understated sustained pad.
function renderPiano(data,rate){
  const tau=2*Math.PI,barLength=4;
  function note(midi,at,length,volume,pad=false){
    const hz=440*2**((midi-69)/12),start=Math.round(at*rate);
    for(let i=0;i<length*rate;i++){
      const t=i/rate,release=Math.min(1,(length-t)/.8);
      const envelope=pad?Math.min(1,t/1.2)*release:Math.min(1,t/.012)*Math.exp(-t*.85)*release;
      const value=pad?(Math.sin(tau*hz*t)+Math.sin(tau*hz*1.002*t))*.5:
        Math.sin(tau*hz*t)+.3*Math.sin(tau*hz*2.001*t)*Math.exp(-t*.6)+.1*Math.sin(tau*hz*3.003*t)*Math.exp(-t);
      data[(start+i)%data.length]+=value*volume*Math.max(0,envelope);
    }
  }
  const chords=[[48,55,64,71],[45,52,60,67],[41,48,57,64],[43,50,59,62]];
  for(let bar=0;bar<16;bar++){
    const chord=chords[Math.floor(bar/2)%4],at=bar*barLength;
    if(bar%2===0){note(chord[0],at,7.5,.13);for(const midi of chord.slice(1))note(midi,at,8.5,.025,true);}
    note(chord[2]+12,at+.5,4.8,.105);
    note(chord[3]+12,at+2.25,4.5,.08);
    if(bar%2===1)note(chord[1]+12,at+3.25,3.7,.065);
  }
  const dry=data.slice();
  for(const [seconds,gain] of [[.16,.13],[.31,.1],[.49,.07],[.73,.04]]){
    const delay=Math.round(seconds*rate);for(let i=0;i<data.length;i++)data[(i+delay)%data.length]+=dry[i]*gain;
  }
  let peak=0;for(const value of data)peak=Math.max(peak,Math.abs(value));
  if(peak>0)for(let i=0;i<data.length;i++)data[i]*=.8/peak;
}
