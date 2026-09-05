import * as THREE from './vendor/three.module.js';
import {createWorld} from './world.js';
import {Simulation,LEVELS} from './physics.js';

const $ = id => document.getElementById(id);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas:$('scene'), antialias:true, alpha:false, powerPreference:'high-performance'});
} catch (error) {
  $('loading').hidden=true;$('error').hidden=false;
  console.error('WebGL renderer initialization failed:',error);
}
if (renderer) initialize();

function initialize(){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#b9e3f5');
  scene.fog=new THREE.Fog('#b9e3f5',110,190);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.19;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const hemi=new THREE.HemisphereLight('#e7f6ff','#9b9763',2.25);scene.add(hemi);
  const sunlight=new THREE.DirectionalLight('#fff0d1',3.3);sunlight.position.set(-22,42,18);
  sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);
  Object.assign(sunlight.shadow.camera,{left:-38,right:38,top:42,bottom:-35,near:.5,far:110});
  sunlight.shadow.bias=-.00018;sunlight.shadow.normalBias=.045;sunlight.shadow.radius=2;
  sunlight.target.position.set(0,0,-4);scene.add(sunlight,sunlight.target);
  const fill=new THREE.DirectionalLight('#b9ddff',.55);fill.position.set(26,15,-16);scene.add(fill);
  const camera=new THREE.OrthographicCamera(-35,35,23,-23,.1,250);
  const world=createWorld(), sim=new Simulation(world);
  const holeUniform=new THREE.Vector3(sim.hole.x,sim.hole.z,sim.hole.radius);
  const geometry=new THREE.BoxGeometry(1,1,1);
  const dummy=new THREE.Object3D(), color=new THREE.Color();
  const voxelMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.8,metalness:.015});
  // Clip fragments below street level, while retaining the open aperture.
  voxelMat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 voxelWorld;');
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvoxelWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 voxelWorld;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(voxelWorld.y < -0.95) discard;');
  };
  const groundMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.96,metalness:0});
  groundMat.onBeforeCompile=shader=>{
    shader.uniforms.hole={value:holeUniform};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 groundWorld;');
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ngroundWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 hole; varying vec3 groundWorld;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(distance(groundWorld.xz,hole.xy)<hole.z) discard;');
  };
  const voxels=new THREE.InstancedMesh(geometry,voxelMat,world.blocks.length);
  voxels.instanceMatrix.setUsage(THREE.DynamicDrawUsage);voxels.castShadow=true;voxels.receiveShadow=true;voxels.frustumCulled=false;
  function transform(i,b){dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(b.rx||0,b.rotation||0,b.rz||0);const s=b.state===3?0:1;dummy.scale.set(b.sx*s,b.sy*s,b.sz*s);dummy.updateMatrix();voxels.setMatrixAt(i,dummy.matrix);}
  world.blocks.forEach((b,i)=>{transform(i,b);color.set(b.color).multiplyScalar(b.shade);voxels.setColorAt(i,color);});scene.add(voxels);
  const terrain=new THREE.InstancedMesh(geometry,groundMat,world.terrain.length);terrain.receiveShadow=true;terrain.castShadow=true;terrain.frustumCulled=false;
  world.terrain.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,b.rotation,0);dummy.scale.set(b.sx,b.sy,b.sz);dummy.updateMatrix();terrain.setMatrixAt(i,dummy.matrix);terrain.setColorAt(i,color.set(b.color).multiplyScalar(b.shade));});scene.add(terrain);
  // Light blue horizon and quiet voxel clouds.
  const cloudMat=new THREE.MeshStandardMaterial({color:'#fffefa',roughness:1});
  for(const [x,y,z,s] of [[-25,1,-28,1.1],[-15,1.6,-28.5,.75],[13,1.2,-28,.85],[26,.6,-28,1.1],[2,.8,-29,.7]]){
    const cloud=new THREE.Group();for(const [dx,dy,dz,w,h,d] of [[0,0,0,2.7,.65,1.25],[-.9,-.23,.1,1.3,.58,1],[.3,.53,0,1.1,.7,1],[1.3,-.16,0,1.2,.55,.9]]){const m=new THREE.Mesh(geometry,cloudMat);m.position.set(dx,dy,dz);m.scale.set(w,h,d);cloud.add(m);}cloud.position.set(x,y,z);cloud.scale.setScalar(s);scene.add(cloud);
  }
  // Sign textures only contain typography; structures themselves are voxel models.
  const signMeshes=world.signs.map(s=>{
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.max(96,Math.round(768*s.h/s.w));
    const ctx=canvas.getContext('2d');ctx.fillStyle=s.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle=s.fg;ctx.lineWidth=3;ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);
    ctx.fillStyle=s.fg;ctx.textAlign='center';ctx.textBaseline='middle';
    if(s.text==='The Beverly Hills Hotel'){
      const lines=['The','Beverly Hills','Hotel'];lines.forEach((t,i)=>{ctx.font=`italic ${canvas.height*.19}px Georgia,serif`;ctx.fillText(t,canvas.width/2,canvas.height*(.22+i*.27),canvas.width*.88);});
    }else{ctx.font=`700 ${Math.min(canvas.height*.52,canvas.width/(s.text.length*.61))}px Arial,sans-serif`;ctx.fillText(s.text,canvas.width/2,canvas.height/2+1,canvas.width*.9);}
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.h),new THREE.MeshStandardMaterial({map:tex,roughness:.8}));mesh.position.set(s.x,s.y,s.z);scene.add(mesh);return mesh;
  });
  // A deep, open black hole with a cool inner wall and fine electric rim.
  const aperture=new THREE.Group();scene.add(aperture);
  const darkness=new THREE.Mesh(new THREE.CircleGeometry(1,96),new THREE.MeshBasicMaterial({color:'#02040e'}));darkness.rotation.x=-Math.PI/2;darkness.position.y=-.9;aperture.add(darkness);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(1,.82,.98,96,1,true),new THREE.MeshBasicMaterial({color:'#11163b',side:THREE.DoubleSide}));wall.position.y=-.41;aperture.add(wall);
  function ring(radius,tube,y,c){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,96),new THREE.MeshBasicMaterial({color:c}));m.rotation.x=-Math.PI/2;m.position.y=y;aperture.add(m);return m;}
  ring(1,.052,.075,'#344cff');ring(1.065,.022,.07,'#a5eaff');ring(.955,.018,-.045,'#5a74ff');ring(.88,.012,-.38,'#213bb7');
  const halo=new THREE.Mesh(new THREE.RingGeometry(1.05,1.21,96),new THREE.MeshBasicMaterial({color:'#6ba8ff',transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.062;aperture.add(halo);
  const upgradeRing=new THREE.Mesh(new THREE.RingGeometry(1,1.055,96),new THREE.MeshBasicMaterial({color:'#ffd865',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));upgradeRing.rotation.x=-Math.PI/2;upgradeRing.position.y=.16;scene.add(upgradeRing);
  const sparkCount=52,sparkPositions=new Float32Array(sparkCount*3);const sparksGeometry=new THREE.BufferGeometry();sparksGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
  const sparks=new THREE.Points(sparksGeometry,new THREE.PointsMaterial({size:.045,color:'#9dcdff',transparent:true,opacity:.7,depthWrite:false}));scene.add(sparks);
  // Responsive orthographic framing preserves the central axis on narrow screens.
  let zoom=1,width=innerWidth,height=innerHeight,paused=false,dragging=false,started=false,soundOn=false;
  let targetX=sim.hole.x,targetZ=sim.hole.z,lastLevel=1,lastCount=-1,upgradeTime=-10,lastFrame=performance.now(),lastShadow=0,toastTimer,hintTimer;
  let audioCtx=null,lastSound=0,dragStart=null,activePointerId=null,shadowDirty=false;
  const viewTarget=new THREE.Vector3(0,1.9,-1.2),lookTarget=viewTarget.clone(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
  const keys=new Set();
  function layout(){
    width=$('game').clientWidth;height=$('game').clientHeight;renderer.setSize(width,height,false);
    const aspect=width/height,span=aspect>1.2?Math.max(39,60/aspect):46;
    camera.left=-span*aspect/2/zoom;camera.right=span*aspect/2/zoom;camera.top=span/2/zoom;camera.bottom=-span/2/zoom;camera.updateProjectionMatrix();
    $('zoom-label').textContent=`${Math.round(zoom*100)}%`;
  }
  function setZoom(v){zoom=THREE.MathUtils.clamp(v,.7,2.1);layout();}
  function pointerWorld(e){const rect=$('scene').getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(groundPlane,point)?point.clone():null;}
  function begin(){if(started)return;started=true;clearTimeout(hintTimer);hintTimer=setTimeout(()=>$('hint').classList.add('subtle'),2400);}
  function releasePointer(e){if(e&&e.pointerId!==activePointerId)return;dragging=false;dragStart=null;activePointerId=null;$('scene').classList.remove('dragging');}
  $('scene').addEventListener('pointerdown',e=>{if(paused||dragging||!e.isPrimary||e.button>0)return;const p=pointerWorld(e);if(!p)return;dragging=true;activePointerId=e.pointerId;begin();$('scene').focus({preventScroll:true});$('scene').setPointerCapture(e.pointerId);$('scene').classList.add('dragging');dragStart={clientX:e.clientX,clientY:e.clientY};});
  $('scene').addEventListener('pointermove',e=>{if(!dragging||paused||e.pointerId!==activePointerId)return;const p=pointerWorld(e),previous=pointerWorld(dragStart);if(!p||!previous)return;targetX=THREE.MathUtils.clamp(targetX+p.x-previous.x,-27,27);targetZ=THREE.MathUtils.clamp(targetZ+p.z-previous.z,-24,24);dragStart={clientX:e.clientX,clientY:e.clientY};});
  $('scene').addEventListener('pointerup',releasePointer);$('scene').addEventListener('pointercancel',releasePointer);$('scene').addEventListener('lostpointercapture',releasePointer);
  $('scene').addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
  function togglePause(){paused=!paused;$('paused').hidden=!paused;$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'继续游戏':'暂停游戏');$('pause-icon').setAttribute('d',paused?'M8 4 19 12 8 20Z':'M8 5v14M16 5v14');releasePointer();keys.clear();}
  function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400);}
  function reset(){sim.reset(transform);voxels.instanceMatrix.needsUpdate=true;signMeshes.forEach(m=>m.visible=true);targetX=0;targetZ=20.4;lastLevel=1;lastCount=-1;upgradeTime=-10;started=false;releasePointer();keys.clear();if(paused)togglePause();clearTimeout(hintTimer);$('hint').classList.remove('subtle');$('toast').classList.remove('visible');viewTarget.set(0,1.9,-1.2);lookTarget.copy(viewTarget);setZoom(1);renderer.shadowMap.needsUpdate=true;updateHUD();}
  $('pause').onclick=togglePause;$('resume').onclick=togglePause;$('restart').onclick=reset;
  $('zoom-in').onclick=()=>setZoom(zoom*1.15);$('zoom-out').onclick=()=>setZoom(zoom/1.15);$('reset-view').onclick=()=>{setZoom(1);viewTarget.set(0,1.9,-1.2);};
  $('sound').onclick=()=>{soundOn=!soundOn;if(soundOn){audioCtx??=new(window.AudioContext||window.webkitAudioContext)();audioCtx.resume().catch(err=>console.warn('Audio could not resume:',err));} $('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'关闭音效':'开启音效');$('sound-waves').setAttribute('d',soundOn?'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 5 6m0-6-5 6');};
  function playPop(){if(!soundOn||!audioCtx||audioCtx.currentTime-lastSound<.065)return;lastSound=audioCtx.currentTime;const oscillator=audioCtx.createOscillator(),gain=audioCtx.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(200+(sim.count%7)*40,lastSound);oscillator.frequency.exponentialRampToValueAtTime(80,lastSound+.08);gain.gain.setValueAtTime(.055,lastSound);gain.gain.exponentialRampToValueAtTime(.001,lastSound+.09);oscillator.connect(gain);gain.connect(audioCtx.destination);oscillator.start();oscillator.stop(lastSound+.1);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
  window.addEventListener('keydown',e=>{if(e.target instanceof HTMLButtonElement)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k))e.preventDefault();if(k===' '&&!e.repeat)togglePause();if(k==='r'&&!e.repeat)reset();if(!paused&&['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){keys.add(k);begin();}});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();releasePointer();});
  document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden){keys.clear();releasePointer();}});
  window.addEventListener('resize',layout);
  $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('error-message').textContent='图形连接已中断，请重新加载场景。';$('error').hidden=false;});
  function updateHUD(){
    if(sim.count===lastCount)return;lastCount=sim.count;
    const percent=Math.floor(sim.count/world.blocks.length*100);$('count').textContent=sim.count.toLocaleString();$('percent').innerHTML=`${percent}<span>%</span>`;$('progress-fill').style.width=`${percent}%`;document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',String(percent));
    let level=1;for(let i=1;i<LEVELS.length;i++)if(sim.count>=LEVELS[i])level=i+1;
    $('level').textContent=`Lv. ${level}`;
    if(level>lastLevel){upgradeTime=sim.time;toast(`SIZE UP!  黑洞升级 · Lv. ${level}`);lastLevel=level;}
    if(sim.count===world.blocks.length)toast('城市已清空！点击重新开始，再探索一次。');
  }
  function frame(now){
    requestAnimationFrame(frame);const dt=Math.min((now-lastFrame)/1000,.034);lastFrame=now;
    if(!paused&&!document.hidden){
      let mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),mz=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      if(mx||mz){const n=Math.hypot(mx,mz);targetX=THREE.MathUtils.clamp(targetX+mx/n*dt*9,-27,27);targetZ=THREE.MathUtils.clamp(targetZ+mz/n*dt*9,-24,24);}
      const dx=targetX-sim.hole.x,dz=targetZ-sim.hole.z,dist=Math.hypot(dx,dz),step=Math.min(dist,dt*18);
      if(dist>.0001){sim.hole.x+=dx/dist*step;sim.hole.z+=dz/dist*step;}
      // Waiting before the first gesture lets the full composition remain intact.
      if(started){const wasActive=sim.active.length;sim.tick(dt,transform,playPop);if(sim.active.length||wasActive||sim.count!==lastCount){voxels.instanceMatrix.needsUpdate=true;shadowDirty=true;}}
      world.signs.forEach((s,i)=>{if(s.entity>=0)signMeshes[i].visible=!world.entities[s.entity].collapsing;});
      updateHUD();
      if(width/height<1.2||zoom>1.2){viewTarget.set(sim.hole.x*(width/height<1.2?.75:.45),1.9,sim.hole.z*.28-3.5);}else viewTarget.set(0,1.9,-1.2);
      lookTarget.lerp(viewTarget,1-Math.exp(-dt*2.4));
    }
    camera.position.copy(lookTarget).add(new THREE.Vector3(0,44,56));camera.lookAt(lookTarget);camera.updateMatrixWorld();
    holeUniform.set(sim.hole.x,sim.hole.z,sim.hole.radius);
    aperture.position.set(sim.hole.x,0,sim.hole.z);aperture.scale.set(sim.hole.radius,1,sim.hole.radius);
    halo.material.opacity=.16+Math.sin(now*.002)*.045;
    const up=sim.time-upgradeTime;upgradeRing.material.opacity=Math.max(0,1-up/1.2)*.85;upgradeRing.position.set(sim.hole.x,.16,sim.hole.z);upgradeRing.scale.setScalar(sim.hole.radius*(1+Math.min(up,1.2)*1.4));
    for(let i=0;i<sparkCount;i++){const a=i/sparkCount*Math.PI*2+now*.00016,rad=sim.hole.radius*(1.035+.04*Math.sin(i*17));sparkPositions[i*3]=sim.hole.x+Math.cos(a)*rad;sparkPositions[i*3+1]=.08+.13*(.5+.5*Math.sin(now*.002+i));sparkPositions[i*3+2]=sim.hole.z+Math.sin(a)*rad;}
    sparksGeometry.attributes.position.needsUpdate=true;
    if(shadowDirty&&now-lastShadow>110){renderer.shadowMap.needsUpdate=true;lastShadow=now;shadowDirty=false;}
    const district=sim.hole.z< -13?'Hollywood Hills':sim.hole.z< -4?'Downtown Los Angeles':sim.hole.z<7?(sim.hole.x< -7?'Sunset Studios':sim.hole.x>10?'The Grove':'Liberty Plaza'):'Beverly Hills';$('district').textContent=district;
    renderer.render(scene,camera);
  }
  layout();renderer.shadowMap.needsUpdate=true;camera.position.copy(lookTarget).add(new THREE.Vector3(0,44,56));camera.lookAt(lookTarget);renderer.render(scene,camera);$('loading').hidden=true;requestAnimationFrame(frame);
}
