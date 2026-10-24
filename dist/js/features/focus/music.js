// Original procedural scores, rendered once per layout and looped by the audio engine.
// No recordings, external assets, or background JavaScript scheduling.
export function musicProfile(layout){
  if(layout==='builder')return {layout,bpm:116,label:'Cyberpunk mission',description:'Original synthesized cyberpunk score: a driving mechanical beat, gritty sequenced bass, dark drones, and rhythmic glitch textures that evolve together at 116 BPM.'};
  if(layout==='founder')return {layout,bpm:76,label:'Symphonic horizon',description:'Original synthesized orchestral score: sustained string-like ensembles, brass-like swells, deep bass, and timpani, with lively rising bells and a sustained strings-and-trumpet-like crescendo with a gradual rise, broad held peak, and gentle release at 76 BPM.'};
  return {layout:'zen',bpm:60,label:'Still temple',description:'Original meditation-inspired soundscape: synthesized singing-bowl-like tones and soft bells with long, spacious decays. No piano, drums, chants, or ritual recordings.'};
}
export function musicLength(sampleRate,layout){return Math.round(sampleRate*60/musicProfile(layout).bpm*(layout==='founder'?96:layout==='builder'?128:64));}
export function renderMusic(data,rate,layout){
  const profile=musicProfile(layout);if(profile.layout==='zen'){renderBowls(data,rate);return;}
  if(layout==='builder'){renderCyberpunk(data,rate);return;}
  renderOrchestra(data,rate);
}

// One continuous cyberpunk cue: every layer shares the same grid and evolving intensity.
function renderCyberpunk(data,rate){
  const beat=60/116,tau=2*Math.PI,size=2048;
  let seed=90210;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
  const smooth=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
  const saw=new Float32Array(size);
  for(let i=0;i<size;i++)for(let h=1;h<=8;h++)saw[i]+=Math.sin(tau*i*h/size)/h;
  const sample=phase=>{const at=((phase%1)+1)%1*size,i=Math.floor(at);return saw[i]+(saw[(i+1)%size]-saw[i])*(at-i);};
  function sound(at,length,fn){
    const start=Math.round(at*rate),count=Math.ceil(length*rate);
    for(let i=0;i<count;i++){
      const t=i/rate,edge=smooth(t/.004)*smooth((length-t)/.016);
      data[(start+i)%data.length]+=fn(t)*edge;
    }
  }
  function bass(midi,at,volume){
    const hz=440*2**((midi-69)/12);
    sound(at,beat*.45,t=>{
      const transient=Math.exp(-t*11),sub=Math.sin(tau*hz*t)*.6;
      const body=Math.tanh(sample(hz*t)*1.8)*(.4+.3*transient);
      return (sub+body)*volume*Math.exp(-t*4.5)*smooth(t/.012);
    });
  }
  function sequence(midi,at,volume){
    const hz=440*2**((midi-69)/12);
    sound(at,beat*.32,t=>{
      // Short, low-mid synth gates repeat as texture, without a solo melody.
      const envelope=Math.exp(-t*22);
      return (sample(hz*t)*.7+sample(hz*1.003*t+.2)*.3)*volume*envelope;
    });
  }
  function kick(at,volume){sound(at,.34,t=>(Math.sin(tau*(42*t+85*.018*(1-Math.exp(-t/.018))))*Math.exp(-t*15)+noise()*Math.exp(-t*210)*.04)*volume);}
  function snare(at,volume){let last=0;sound(at,.16,t=>{const n=noise(),high=n-last;last=n;return (high*Math.exp(-t*32)*.6+Math.sin(tau*190*t)*Math.exp(-t*38)*.4)*volume;});}
  function tick(at,volume){let last=0;sound(at,.04,t=>{const n=noise(),high=n-last;last=n;return high*Math.exp(-t*130)*volume;});}
  function drone(midi,at,volume){
    const hz=440*2**((midi-69)/12),length=17*beat;
    sound(at,length,t=>(sample(hz*t)+sample(hz*1.0015*t+.3))*.5*volume*smooth(t/1.7)*smooth((length-t)/2));
  }
  for(let bar=0;bar<32;bar++){
    const at=bar*4*beat,root=[28,28,24,26][Math.floor(bar/8)];
    // A broad rise and fall keeps the loop moving without an abrupt drop or spotlight cue.
    const intensity=.45+.55*Math.sin(Math.PI*(bar+.5)/32)**2;
    for(let step=0;step<8;step++)bass(root+(step===6&&bar%4===3?12:0),at+step*beat/2,(step%2===0?.15:.105)*intensity);
    for(let b=0;b<4;b++)kick(at+b*beat,.22+.07*intensity);
    snare(at+2*beat,.065+.035*intensity);
    const pattern=[12,19,12,24,12,19,15,19];
    for(let step=0;step<8;step++){
      sequence(root+pattern[step],at+step*beat/2,.025+.025*intensity);
      tick(at+(step+.5)*beat/2,.011+.009*intensity);
    }
    // Tiny gated static bursts recur inside the rhythm instead of becoming a separate hook.
    for(const step of (bar%2?[5,11,14]:[3,10])){
      sound(at+step*beat/4,beat*.17,t=>{
        const gate=Math.sin(tau*75*t)>0?1:0;
        return noise()*gate*Math.exp(-t*65)*(.018+.012*intensity);
      });
    }
    if(bar%4===0){drone(root+24,at,.013+.008*intensity);drone(root+31,at,.009+.005*intensity);}
    if(bar>=8&&bar<24)sequence(root+24,at+3.75*beat,.022*intensity);
  }
  // Dark electronic atmosphere slowly opens above the pulse and subsides before looping.
  sound(0,128*beat,t=>{
    const u=t/(128*beat),swell=Math.sin(Math.PI*u)**2;
    return (Math.sin(tau*164.81*t)+.3*Math.sin(tau*246.94*t))*swell*.016;
  });
  const dry=data.slice();
  for(const [seconds,gain] of [[beat*.75,.075],[beat*1.5,.045]]){
    const delay=Math.round(seconds*rate);for(let i=0;i<data.length;i++)data[(i+delay)%data.length]+=dry[i]*gain;
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
  const strings=table([.52,.21,.12,.065,.035,.02]),brass=table([.6,.24,.14,.075,.035]),bass=table([.8,.12,.04]),trumpets=table([.45,.34,.25,.17,.1,.065,.035]);
  function sample(wave,phase){const at=((phase%1)+1)%1*size,i=Math.floor(at);return wave[i]+(wave[(i+1)%size]-wave[i])*(at-i);}
  const ramp=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
  function note(midi,at,length,volume,wave,ensemble=false,legato=false){
    const hz=440*2**((midi-69)/12),start=Math.round(at*rate),count=Math.ceil(length*rate);
    let phase=0;
    for(let i=0;i<count;i++){
      const t=i/rate,u=t/length;
      const envelope=ramp(t/(legato?1.8:.7))*ramp((length-t)/(legato?2:.9))*(.85+.15*Math.sin(Math.PI*u));
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
  for(let bar=0;bar<24;bar++){
    const chord=progression[bar%8],at=bar*4*beat,secondHalf=bar>=8;
    chord.slice(1).forEach(midi=>note(midi,at,4.2*beat,.12,strings,true));
    note(chord[0]-12,at,4.1*beat,.16,bass);
    note(melody[bar%melody.length],at+.25*beat,3.6*beat,secondHalf?.11:.08,strings,true);
    if(bar%2===0||secondHalf)chord.slice(1,3).forEach(midi=>note(midi,at+.4*beat,3.3*beat,secondHalf?.075:.045,brass,true));
    if(bar%2===0)timpani(at,chord[0]-12,.14);
    if(bar%4===3)timpani(at+3*beat,33,.075);
    // Bell figures quicken and climb during the build, then give the ending space.
    const upper=chord.slice(1).map(midi=>midi+24);
    if(bar%2===1||bar>=6&&bar<=17){
      const building=bar>=6&&bar<=16,pattern=building?[0,1,2,1,2,2]:[0,1,2,1];
      pattern.forEach((index,step)=>sparkle(upper[index]+(building&&step===5?12:0),at+(.5+step*(building?.375:.5))*beat,building?.055:.04));
    }
    if(bar>=2&&bar<=22){
      // Overlap long string and trumpet-like phrases rather than switching a choir on suddenly.
      const rise=Math.max(0,Math.min(1,(bar-2)/8)),fall=Math.max(0,Math.min(1,(23-bar)/7));
      const intensity=rise*rise*(3-2*rise)*fall*fall*(3-2*fall);
      upper.slice(0,2).forEach((midi,index)=>note(midi,at+index*.25*beat,6*beat,.052*intensity,strings,true,true));
      chord.slice(1).forEach(midi=>note(midi+12,at+.2*beat,5.7*beat,.065*intensity,trumpets,true,true));
      if(bar>=9&&bar<=15)for(let step=0;step<2;step++)timpani(at+step*2*beat,chord[0]-12,.045*intensity);
    }
    if(bar===0||bar===8)sparkle(86,at+.5*beat,.03);
  }
  // A continuous phrase-wide envelope shapes the whole ensemble, not just its volume per bar.
  // Rise over 28 seconds, hold the crest for roughly 16 seconds, then release over 25 seconds.
  const smooth=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
  for(let i=0;i<data.length;i++){
    const position=i/rate/beat;
    const rise=smooth((position-8)/36),fall=1-smooth((position-64)/32);
    data[i]*=.62+1.15*rise*fall;
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
