import * as THREE from './vendor/three.module.js';
import {createWorld} from './world.js';
import {Simulation} from './physics.js';
import {CAMERA_FOV,CAMERA_PITCH,CAMERA_SPANS,followPose} from './camera-rig.js';
import {movementScale,clampHolePosition,moveHole} from './movement.js';

const $ = id => document.getElementById(id);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas:$('scene'), antialias:true, alpha:false, powerPreference:'high-performance'});
} catch (error) {
  $('loading').hidden=true;$('error').hidden=false;
  console.error('WebGL renderer initialization failed:',error);
}
if(renderer){
  fetch('./landmark-assets.json').then(response=>{if(!response.ok)throw new Error(`Landmark request failed: ${response.status}`);return response.json();}).then(initialize).catch(error=>{$('loading').hidden=true;$('error').hidden=false;$('error-message').textContent='场景资源未能完整加载，请重新加载。';console.error('Scene initialization failed:',error);});
}

function initialize(landmarks){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#69d7ec');
  scene.fog=new THREE.Fog('#80deec',145,280);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const hemi=new THREE.HemisphereLight('#dff3ff','#927f52',1.85);scene.add(hemi);
  const sunlight=new THREE.DirectionalLight('#fff0d1',3.6);sunlight.position.set(-22,42,18);
  sunlight.castShadow=true;sunlight.shadow.mapSize.set(3072,3072);
  Object.assign(sunlight.shadow.camera,{left:-44,right:44,top:44,bottom:-42,near:.5,far:140});
  sunlight.shadow.bias=-.00018;sunlight.shadow.normalBias=.045;sunlight.shadow.radius=2;
  sunlight.target.position.set(0,0,-4);scene.add(sunlight,sunlight.target);
  const fill=new THREE.DirectionalLight('#b9ddff',.55);fill.position.set(26,15,-16);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(CAMERA_FOV,innerWidth/innerHeight,.1,400);
  const world=createWorld(landmarks), sim=new Simulation(world);
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
  // Spatial batches keep a close follow-camera from drawing the entire city.
  const batches=[],buckets=new Map(),batchOf=new Uint16Array(world.blocks.length),slotOf=new Uint32Array(world.blocks.length),dirtyBatches=new Set();
  world.blocks.forEach((b,i)=>{const key=`${Math.floor(b.x/7)},${Math.floor(b.z/7)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);});
  for(const ids of buckets.values()){
    const mesh=new THREE.InstancedMesh(geometry,voxelMat,ids.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;
    const batch={mesh,min:Infinity,max:-1};const index=batches.length;batches.push(batch);ids.forEach((id,slot)=>{batchOf[id]=index;slotOf[id]=slot;});scene.add(mesh);
  }
  function transform(i,b){
    dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(b.rx||0,b.rotation||0,b.rz||0);const s=b.state===3?0:1;dummy.scale.set(b.sx*s,b.sy*s,b.sz*s);dummy.updateMatrix();
    const batch=batches[batchOf[i]],slot=slotOf[i];batch.mesh.setMatrixAt(slot,dummy.matrix);batch.min=Math.min(batch.min,slot);batch.max=Math.max(batch.max,slot);dirtyBatches.add(batch);
    const sphere=batch.mesh.boundingSphere;if(sphere&&b.state!==3){const d2=(b.x-sphere.center.x)**2+(b.y-sphere.center.y)**2+(b.z-sphere.center.z)**2;if(d2>(sphere.radius-.5)**2)sphere.radius=Math.sqrt(d2)+1;}
  }
  function flushVoxels(){for(const batch of dirtyBatches){batch.mesh.instanceMatrix.addUpdateRange(batch.min*16,(batch.max-batch.min+1)*16);batch.mesh.instanceMatrix.needsUpdate=true;batch.min=Infinity;batch.max=-1;}dirtyBatches.clear();}
  world.blocks.forEach((b,i)=>{transform(i,b);color.set(b.color).multiplyScalar(b.shade);batches[batchOf[i]].mesh.setColorAt(slotOf[i],color);});
  for(const b of batches){b.mesh.computeBoundingSphere();b.mesh.boundingSphere.radius+=5;b.baseSphere=b.mesh.boundingSphere.clone();}flushVoxels();
  const terrain=new THREE.InstancedMesh(geometry,groundMat,world.terrain.length);terrain.receiveShadow=true;terrain.castShadow=true;terrain.frustumCulled=false;
  world.terrain.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,b.rotation,0);dummy.scale.set(b.sx,b.sy,b.sz);dummy.updateMatrix();terrain.setMatrixAt(i,dummy.matrix);terrain.setColorAt(i,color.set(b.color).multiplyScalar(b.shade));});scene.add(terrain);
  // A large cyan world around the raised city, with separated distant city islands.
  const outerFloor=new THREE.Mesh(new THREE.PlaneGeometry(420,420),new THREE.MeshStandardMaterial({color:'#42cbdc',roughness:.64,metalness:.06}));outerFloor.rotation.x=-Math.PI/2;outerFloor.position.y=-3.71;outerFloor.receiveShadow=true;scene.add(outerFloor);
  const islandMat=new THREE.MeshStandardMaterial({color:'#78b34b',roughness:1});
  const farBuildingMat=new THREE.MeshStandardMaterial({color:'#c8e1da',roughness:.9});
  for(const [x,z,w,d] of [[-72,-44,28,25],[6,-69,33,22],[68,-31,25,31]]){
    const base=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#d1bb86',roughness:.9}));base.position.set(x,-2.5,z);base.scale.set(w,2.4,d);base.receiveShadow=true;scene.add(base);
    const turf=new THREE.Mesh(geometry,islandMat);turf.position.set(x,-1.23,z);turf.scale.set(w,.16,d);scene.add(turf);
    for(let i=0;i<11;i++){const h=2.0+(i*7%9),building=new THREE.Mesh(geometry,farBuildingMat);building.position.set(x-w*.35+(i%4)*w*.22,-1.15+h/2,z-d*.3+Math.floor(i/4)*d*.27);building.scale.set(2.2+(i%2),h,2.3);scene.add(building);}
  }
  // Light blue horizon and quiet voxel clouds.
  const cloudMat=new THREE.MeshStandardMaterial({color:'#fffefa',roughness:1});
  for(const [x,y,z,s] of [[-25,10,-28,1.1],[-15,9,-28.5,.75],[13,10,-28,.85],[26,11,-28,1.1],[2,9,-29,.7]]){
    const cloud=new THREE.Group();for(const [dx,dy,dz,w,h,d] of [[0,0,0,2.7,.65,1.25],[-.9,-.23,.1,1.3,.58,1],[.3,.53,0,1.1,.7,1],[1.3,-.16,0,1.2,.55,.9]]){const m=new THREE.Mesh(geometry,cloudMat);m.position.set(dx,dy,dz);m.scale.set(w,h,d);cloud.add(m);}cloud.position.set(x,y,z);cloud.scale.setScalar(s);scene.add(cloud);
  }
  // Sign textures only contain typography; structures themselves are voxel models.
  const signMeshes=world.signs.map(s=>{
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=Math.max(96,Math.round(768*s.h/s.w));
    const ctx=canvas.getContext('2d');ctx.fillStyle=s.bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    if(s.text.length>2){ctx.strokeStyle=s.fg;ctx.lineWidth=3;ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);}
    ctx.fillStyle=s.fg;ctx.textAlign='center';ctx.textBaseline='middle';
    if(s.text.includes('\n')){
      const lines=s.text.split('\n');lines.forEach((t,i)=>{ctx.font=`700 ${canvas.height*.33}px Georgia,serif`;ctx.fillText(t,canvas.width/2,canvas.height*(.29+i*.44),canvas.width*.9);});
    }else if(s.text==='The Beverly Hills Hotel'){
      const lines=['The','Beverly Hills','Hotel'];lines.forEach((t,i)=>{ctx.font=`italic ${canvas.height*.19}px Georgia,serif`;ctx.fillText(t,canvas.width/2,canvas.height*(.22+i*.27),canvas.width*.88);});
    }else{ctx.font=`700 ${Math.min(canvas.height*.52,canvas.width/(s.text.length*.61))}px Arial,sans-serif`;ctx.fillText(s.text,canvas.width/2,canvas.height/2+1,canvas.width*.9);}
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.h),new THREE.MeshStandardMaterial({map:tex,roughness:.8}));mesh.position.set(s.x,s.y,s.z);mesh.rotation.y=s.rotation||0;scene.add(mesh);return mesh;
  });
  // A deep, open black hole with a cool inner wall and fine electric rim.
  const aperture=new THREE.Group();scene.add(aperture);
  const darkness=new THREE.Mesh(new THREE.CircleGeometry(1,96),new THREE.MeshBasicMaterial({color:'#02040e'}));darkness.rotation.x=-Math.PI/2;darkness.position.y=-.9;aperture.add(darkness);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(1,.82,.98,96,1,true),new THREE.MeshBasicMaterial({color:'#11163b',side:THREE.DoubleSide}));wall.position.y=-.41;aperture.add(wall);
  function ring(radius,tube,y,c){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,8,96),new THREE.MeshBasicMaterial({color:c}));m.rotation.x=-Math.PI/2;m.position.y=y;aperture.add(m);return m;}
  ring(1,.052,.075,'#344cff');ring(1.065,.022,.07,'#a5eaff');ring(.955,.018,-.045,'#5a74ff');ring(.88,.012,-.38,'#213bb7');
  const halo=new THREE.Mesh(new THREE.RingGeometry(1.05,1.21,96),new THREE.MeshBasicMaterial({color:'#6ba8ff',transparent:true,opacity:.19,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.062;aperture.add(halo);
  const upgradeRing=new THREE.Mesh(new THREE.RingGeometry(1,1.13,96),new THREE.MeshBasicMaterial({color:'#ffe26b',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));upgradeRing.rotation.x=-Math.PI/2;upgradeRing.position.y=.24;scene.add(upgradeRing);
  const upgradeCanvas=document.createElement('canvas');upgradeCanvas.width=1024;upgradeCanvas.height=256;const uc=upgradeCanvas.getContext('2d');uc.textAlign='center';uc.textBaseline='middle';uc.font='italic 900 150px Arial';uc.lineJoin='round';uc.strokeStyle='#435743';uc.lineWidth=11;uc.strokeText('Size Up!',512,120);uc.fillStyle='#fffdef';uc.fillText('Size Up!',512,120);const upgradeTexture=new THREE.CanvasTexture(upgradeCanvas);upgradeTexture.colorSpace=THREE.SRGBColorSpace;
  const sizeUpSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:upgradeTexture,transparent:true,depthTest:false,depthWrite:false}));sizeUpSprite.renderOrder=10;sizeUpSprite.visible=false;scene.add(sizeUpSprite);
  const burstPositions=new Float32Array(72*3),burstGeometry=new THREE.BufferGeometry();burstGeometry.setAttribute('position',new THREE.BufferAttribute(burstPositions,3));const burst=new THREE.Points(burstGeometry,new THREE.PointsMaterial({color:'#fff5a3',size:.14,transparent:true,opacity:0,depthWrite:false}));burst.frustumCulled=false;scene.add(burst);
  const sparkCount=52,sparkPositions=new Float32Array(sparkCount*3);const sparksGeometry=new THREE.BufferGeometry();sparksGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
  const sparks=new THREE.Points(sparksGeometry,new THREE.PointsMaterial({size:.045,color:'#9dcdff',transparent:true,opacity:.7,depthWrite:false}));sparks.frustumCulled=false;scene.add(sparks);
  // Follow at every screen size. Upgrades change height, distance and visible area.
  let zoom=1,width=innerWidth,height=innerHeight,paused=false,dragging=false,started=false,soundOn=false;
  let targetX=sim.hole.x,targetZ=sim.hole.z,lastLevel=1,lastCount=-1,upgradeTime=-10,lastFrame=performance.now(),lastShadow=0,toastTimer,hintTimer;
  let overview=true,currentSpan=47,visualTime=0,hitStop=0,openingTime=0;
  let audioCtx=null,lastSound=0,dragStart=null,activePointerId=null,shadowDirty=false;
  const lookTarget=new THREE.Vector3(0,1.2,-1),cameraPosition=new THREE.Vector3(0,44,61),desiredPosition=new THREE.Vector3(),desiredTarget=new THREE.Vector3(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
  const keys=new Set();
  function layout(){
    width=$('game').clientWidth;height=$('game').clientHeight;renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    $('zoom-label').textContent=`${Math.round(zoom*100)}%`;
  }
  function setZoom(v){zoom=THREE.MathUtils.clamp(v,.7,2.1);layout();}
  function pointerWorld(e){const rect=$('scene').getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(groundPlane,point)?point.clone():null;}
  function begin(){overview=false;if(started)return;started=true;openingTime=visualTime;clearTimeout(hintTimer);hintTimer=setTimeout(()=>$('hint').classList.add('subtle'),1700);}
  function releasePointer(e){if(e&&e.pointerId!==activePointerId)return;dragging=false;dragStart=null;activePointerId=null;$('scene').classList.remove('dragging');}
  $('scene').addEventListener('pointerdown',e=>{if(paused||dragging||!e.isPrimary||e.button>0)return;const p=pointerWorld(e);if(!p)return;dragging=true;activePointerId=e.pointerId;begin();$('scene').focus({preventScroll:true});$('scene').setPointerCapture(e.pointerId);$('scene').classList.add('dragging');dragStart={clientX:e.clientX,clientY:e.clientY};});
  $('scene').addEventListener('pointermove',e=>{if(!dragging||paused||e.pointerId!==activePointerId)return;const p=pointerWorld(e),previous=pointerWorld(dragStart);if(!p||!previous)return;const scale=movementScale(sim.level),target=clampHolePosition(targetX+(p.x-previous.x)*scale,targetZ+(p.z-previous.z)*scale,sim.hole.radius);targetX=target.x;targetZ=target.z;dragStart={clientX:e.clientX,clientY:e.clientY};});
  $('scene').addEventListener('pointerup',releasePointer);$('scene').addEventListener('pointercancel',releasePointer);$('scene').addEventListener('lostpointercapture',releasePointer);
  $('scene').addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
  function togglePause(){paused=!paused;$('paused').hidden=!paused;$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'继续游戏':'暂停游戏');$('pause-icon').setAttribute('d',paused?'M8 4 19 12 8 20Z':'M8 5v14M16 5v14');releasePointer();keys.clear();}
  function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400);}
  function reset(){sim.reset(transform);flushVoxels();for(const b of batches)b.mesh.boundingSphere.copy(b.baseSphere);signMeshes.forEach(m=>m.visible=true);targetX=0;targetZ=20.4;lastLevel=1;lastCount=-1;upgradeTime=-10;started=false;overview=true;hitStop=0;currentSpan=47;releasePointer();keys.clear();if(paused)togglePause();clearTimeout(hintTimer);$('hint').classList.remove('subtle');$('toast').classList.remove('visible');setZoom(1);renderer.shadowMap.needsUpdate=true;updateHUD();}
  $('pause').onclick=togglePause;$('resume').onclick=togglePause;$('restart').onclick=reset;
  $('zoom-in').onclick=()=>setZoom(zoom*1.15);$('zoom-out').onclick=()=>setZoom(zoom/1.15);$('reset-view').onclick=()=>{overview=!overview;setZoom(1);};
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
    const level=sim.level;
    $('level').textContent=`Lv. ${level}`;
    if(level>lastLevel){upgradeTime=visualTime;hitStop=.065;lastLevel=level;playUpgrade();}
    if(sim.count===world.blocks.length)toast('城市已清空！点击重新开始，再探索一次。');
  }
  function playUpgrade(){if(!soundOn||!audioCtx)return;const t=audioCtx.currentTime;for(let i=0;i<3;i++){const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.value=[392,523.25,783.99][i];g.gain.setValueAtTime(0,t);g.gain.setValueAtTime(.07,t+i*.045);g.gain.exponentialRampToValueAtTime(.001,t+.3+i*.03);o.connect(g);g.connect(audioCtx.destination);o.start(t+i*.045);o.stop(t+.4);o.onended=()=>{o.disconnect();g.disconnect();};}}
  function updateCamera(dt){
    const fullSpan=Math.max(47,70/(width/height))/zoom;
    const desiredSpan=overview?fullSpan:CAMERA_SPANS[sim.level-1]/zoom;
    currentSpan+=(desiredSpan-currentSpan)*(1-Math.exp(-dt*(visualTime-openingTime<1.1?4.7:8)));
    if(overview){const distance=currentSpan/(2*Math.tan(CAMERA_FOV*Math.PI/360));desiredTarget.set(0,1.2,-1);desiredPosition.set(0,1.2+Math.sin(CAMERA_PITCH)*distance,-1+Math.cos(CAMERA_PITCH)*distance);}
    else{const pose=followPose(sim.hole.x,sim.hole.z,currentSpan);desiredTarget.fromArray(pose.target);desiredPosition.fromArray(pose.position);}
    const factor=1-Math.exp(-dt*(overview?5:14));lookTarget.lerp(desiredTarget,factor);cameraPosition.lerp(desiredPosition,factor);camera.position.copy(cameraPosition);camera.lookAt(lookTarget);camera.updateMatrixWorld();
    $('reset-view').setAttribute('aria-label',overview?'跟随黑洞':'查看全景');$('reset-view').title=overview?'跟随黑洞':'查看全景';
  }
  function frame(now){
    requestAnimationFrame(frame);const dt=Math.min((now-lastFrame)/1000,.034);lastFrame=now;
    if(!paused&&!document.hidden){
      visualTime+=dt;const frozen=Math.min(hitStop,dt),simulationDt=dt-frozen;hitStop-=frozen;
      let mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),mz=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      if(mx||mz){const n=Math.hypot(mx,mz),speed=9*movementScale(sim.level),target=clampHolePosition(targetX+mx/n*simulationDt*speed,targetZ+mz/n*simulationDt*speed,sim.hole.radius);targetX=target.x;targetZ=target.z;}
      const target=moveHole(sim.hole,targetX,targetZ,simulationDt,sim.level);targetX=target.x;targetZ=target.z;
      // Waiting before the first gesture lets the full composition remain intact.
      if(started&&simulationDt>0){sim.tick(simulationDt,transform,playPop);const position=clampHolePosition(sim.hole.x,sim.hole.z,sim.hole.radius);sim.hole.x=position.x;sim.hole.z=position.z;const target=clampHolePosition(targetX,targetZ,sim.hole.radius);targetX=target.x;targetZ=target.z;if(dirtyBatches.size){flushVoxels();shadowDirty=true;}}
      world.signs.forEach((s,i)=>{if(s.entity>=0)signMeshes[i].visible=!world.entities[s.entity].collapsing;});
      updateHUD();
      updateCamera(dt);
    }
    holeUniform.set(sim.hole.x,sim.hole.z,sim.hole.radius);
    const up=visualTime-upgradeTime,pop=up>=0&&up<.24?Math.sin(up/.24*Math.PI)*.11:0,displayRadius=sim.hole.radius*(1+pop);
    aperture.position.set(sim.hole.x,0,sim.hole.z);aperture.scale.set(displayRadius,1,displayRadius);holeUniform.z=displayRadius;
    halo.material.opacity=.16+Math.sin(now*.002)*.045;
    upgradeRing.material.opacity=Math.max(0,1-up/.64)*.95;upgradeRing.position.set(sim.hole.x,.25,sim.hole.z);upgradeRing.scale.setScalar(sim.hole.radius*(1+Math.min(up,.64)*2.7));
    sizeUpSprite.visible=up>=0&&up<.87;sizeUpSprite.material.opacity=Math.min(1,Math.max(0,(.87-up)/.25));sizeUpSprite.position.set(sim.hole.x,sim.hole.radius*.76+1.1+up*.6,sim.hole.z-.15);sizeUpSprite.scale.set(sim.hole.radius*3.1*(1+pop),sim.hole.radius*.775*(1+pop),1);
    burst.material.opacity=Math.max(0,1-up/.7);for(let i=0;i<72;i++){const a=i/72*Math.PI*2,r=sim.hole.radius*(1+Math.min(up,.7)*(1.4+(i%4)*.16));burstPositions[i*3]=sim.hole.x+Math.cos(a)*r;burstPositions[i*3+1]=.25+Math.max(0,Math.sin(Math.min(up,.7)/.7*Math.PI))*(.4+i%5*.18);burstPositions[i*3+2]=sim.hole.z+Math.sin(a)*r;}burstGeometry.attributes.position.needsUpdate=true;
    for(let i=0;i<sparkCount;i++){const a=i/sparkCount*Math.PI*2+now*.00016,rad=sim.hole.radius*(1.035+.04*Math.sin(i*17));sparkPositions[i*3]=sim.hole.x+Math.cos(a)*rad;sparkPositions[i*3+1]=.08+.13*(.5+.5*Math.sin(now*.002+i));sparkPositions[i*3+2]=sim.hole.z+Math.sin(a)*rad;}
    sparksGeometry.attributes.position.needsUpdate=true;
    if(shadowDirty&&now-lastShadow>160){renderer.shadowMap.needsUpdate=true;lastShadow=now;shadowDirty=false;}
    const district=sim.hole.z< -13?'Hollywood Hills':sim.hole.z< -4?'Downtown Los Angeles':sim.hole.z<7?(sim.hole.x< -7?'Sunset Studios':sim.hole.x>10?'The Grove':'Liberty Plaza'):'Beverly Hills';$('district').textContent=district;
    renderer.render(scene,camera);
  }
  layout();currentSpan=Math.max(47,70/(width/height));updateCamera(1);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);$('loading').hidden=true;requestAnimationFrame(frame);
}
