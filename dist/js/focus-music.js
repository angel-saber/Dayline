// Original procedural scores, rendered once per layout and looped by the audio engine.
// No recordings, external assets, or background JavaScript scheduling.
export function musicProfile(layout){
  if(layout==='builder')return {layout,bpm:112,label:'Cyberpunk drive',description:'Dark cyberpunk loop: distorted synth bass, punchy breakbeats, minor-key atmosphere, and glitch accents at 112 BPM.'};
  if(layout==='founder')return {layout,bpm:76,label:'Symphonic horizon',description:'Original synthesized orchestral score: sustained string-like ensembles, brass-like swells, deep bass, and timpani, with delicate bell-like sparkles and rising high strings in a spacious hall at 76 BPM.'};
  return {layout:'zen',bpm:60,label:'Still temple',description:'Original meditation-inspired soundscape: synthesized singing-bowl-like tones and soft bells with long, spacious decays. No piano, drums, chants, or ritual recordings.'};
}
export function musicLength(sampleRate,layout){return Math.round(sampleRate*60/musicProfile(layout).bpm*64);}
export function renderMusic(data,rate,layout){
  const profile=musicProfile(layout);if(profile.layout==='zen'){renderBowls(data,rate);return;}
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
  function sparkle(midi,at,volume){
    const hz=440*2**((midi-69)/12),start=Math.round(at*rate),length=2.4;
    for(let i=0;i<rate*length;i++){
      const t=i/rate,envelope=Math.min(1,t/.015)*Math.exp(-t*2.3)*Math.min(1,(length-t)/.3);
      let tone=Math.sin(tau*hz*t);
      if(hz*2.01<rate*.42)tone+=.24*Math.sin(tau*hz*2.01*t)*Math.exp(-t*1.2);
      if(hz*4.08<rate*.42)tone+=.055*Math.sin(tau*hz*4.08*t)*Math.exp(-t*2);
      data[(start+i)%data.length]+=tone*volume*Math.max(0,envelope);
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
    // Brief, chord-aligned glints leave the existing slow orchestral arc in front.
    if(bar%4===1||bar%4===2){
      const upper=chord.slice(1).map(midi=>midi+24);
      upper.forEach((midi,index)=>sparkle(midi,at+(1+index*.5)*beat,.035));
      if(secondHalf)upper.slice(0,2).forEach((midi,index)=>note(midi,at+(1.5+index*.75)*beat,1.9*beat,.026,strings,true));
    }
    if(bar===0||bar===8)sparkle(86,at+.5*beat,.025);
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

// An original bowl-and-bell soundscape; synthesized timbres, not ritual recordings.
function renderBowls(data,rate){
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
