export function renderScore(data,rate){
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
