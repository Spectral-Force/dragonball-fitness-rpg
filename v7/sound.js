// Optional, locally synthesized feedback. Never plays before an explicit enabled action.
let context;
const melodies={workout:[392,493.88,587.33],purchase:[440,554.37],saga:[329.63,392,493.88,659.25],awakening:[261.63,392,523.25,659.25,783.99],wish:[293.66,369.99,440,587.33,739.99]};
document.addEventListener('v7-feedback',async event=>{
  if(event.detail?.sound!==true||document.hidden)return;
  const notes=melodies[event.detail.type];if(!notes)return;
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
  try{
    context ||= new Audio();
    await context.resume();
    if(context.state!=='running')return;
    const now=context.currentTime;
    notes.forEach((frequency,index)=>{
      const oscillator=context.createOscillator(),gain=context.createGain();
      const start=now+index*.09;
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.055,start+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+.30);
      oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(start+.32);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    });
  }catch{/* Audio is optional; an unsupported output never blocks training or saving. */}
});
