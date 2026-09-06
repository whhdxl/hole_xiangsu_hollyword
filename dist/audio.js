const FILES={music:'music.mp3',gulp1:'gulp-1.wav',gulp2:'gulp-2.wav',gulp3:'gulp-3.wav',crumble:'crumble.wav',upgrade:'upgrade.wav',complete:'complete.wav',click:'click.wav'};

// Decode each original sound once; share one music loop and a bounded pool of effects.
export class GameAudio {
  constructor(onError){
    this.onError=onError;this.context=null;this.enabled=true;this.playing=false;
    this.buffers={};this.voices=new Set();this.music=null;this.loading=null;
    this.lastGulp=-1;this.lastCrumble=-1;this.variant=0;
  }
  unlock(){
    if(!this.context){
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext){this.enabled=false;this.onError(new Error('Web Audio is unavailable'));return;}
      this.context=new AudioContext();
      this.master=this.context.createGain();this.master.gain.value=.72;
      const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=10;limiter.ratio.value=8;
      this.master.connect(limiter);limiter.connect(this.context.destination);
      this.musicGain=this.context.createGain();this.musicGain.gain.value=.33;this.musicGain.connect(this.master);
      this.loading=Promise.all(Object.entries(FILES).map(async([key,file])=>{
        const response=await fetch(new URL('./audio/'+file,import.meta.url));
        if(!response.ok)throw new Error(`Audio request failed: ${file} (${response.status})`);
        this.buffers[key]=await this.context.decodeAudioData(await response.arrayBuffer());
      })).then(()=>this.startMusic()).catch(this.onError);
    }
    this.sync();
  }
  setPlaying(playing){this.playing=playing;this.sync();}
  setEnabled(enabled){this.enabled=enabled;if(enabled)this.unlock();else this.sync();}
  sync(){
    if(!this.context)return;
    const audible=this.enabled&&this.playing;
    this.master.gain.value=audible?.72:0;
    if(audible){this.context.resume().catch(this.onError);this.startMusic();}
    else{this.stopEffects();this.context.suspend().catch(this.onError);}
  }
  startMusic(){
    if(!this.enabled||!this.playing||this.music||!this.buffers.music)return;
    this.music=this.context.createBufferSource();this.music.buffer=this.buffers.music;
    this.music.loop=true;this.music.connect(this.musicGain);this.music.start();
  }
  stopEffects(){for(const voice of this.voices)voice.stop();this.voices.clear();}
  reset(){
    this.stopEffects();if(this.music){this.music.stop();this.music.disconnect();this.music=null;}
    this.lastGulp=this.lastCrumble=-1;this.variant=0;this.setPlaying(false);
  }
  play(key,gain=1,rate=1,priority=false){
    if(!this.enabled||!this.playing||this.context?.state!=='running'||!this.buffers[key])return;
    if(this.voices.size>=8){if(!priority)return;const oldest=this.voices.values().next().value;oldest.stop();this.voices.delete(oldest);}
    const source=this.context.createBufferSource(),volume=this.context.createGain();
    source.buffer=this.buffers[key];source.playbackRate.value=rate;volume.gain.value=gain;
    source.connect(volume);volume.connect(this.master);this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();volume.disconnect();};source.start();
  }
  swallow(count,released,level){
    if(!this.enabled||!this.playing||this.context?.state!=='running')return;
    const now=this.context.currentTime;
    // Soft grains overlap gently, with subtle spacing and pitch variation.
    if(count>0&&now-this.lastGulp>=.15+this.variant*.012){this.lastGulp=now;this.variant=(this.variant+1)%3;this.play('gulp'+(this.variant+1),.48+Math.min(count,80)*.00125,1+(level-1)*.002);}
    if(released>24&&now-this.lastCrumble>=.48){this.lastCrumble=now;this.play('crumble',.26+Math.min(released,300)*.00025);}
  }
  celebrate(complete=false){
    this.play(complete?'complete':'upgrade',complete?.85:.78,1,true);
    if(!this.musicGain||!this.enabled||!this.playing)return;
    const now=this.context.currentTime,gain=this.musicGain.gain;
    gain.cancelScheduledValues(now);gain.setValueAtTime(.12,now);gain.linearRampToValueAtTime(.33,now+(complete?2:1.1));
  }
}
