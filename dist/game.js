import * as THREE from './vendor/three.module.js';
import {createWorld} from './world.js';
import {Simulation,LEVELS,RADII} from './physics.js';
import {VoxelBatches} from './voxel-batches.js';
import {CAMERA_FOV,CAMERA_PITCH,CAMERA_SPANS,followPose} from './camera-rig.js';
import {movementScale,clampHolePosition,moveHole} from './movement.js';
import {GameAudio} from './audio.js';

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
  sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);
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
  const voxels=new VoxelBatches(scene,world,geometry,voxelMat);
  const transform=voxels.transform;
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
  // Broad white rim, ink outline, graphite cavity and a warm upgrade glow.
  const aperture=new THREE.Group();scene.add(aperture);
  const darkness=new THREE.Mesh(new THREE.CircleGeometry(.945,80),new THREE.MeshBasicMaterial({color:'#282828',toneMapped:false}));darkness.rotation.x=-Math.PI/2;darkness.position.y=-.87;aperture.add(darkness);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(.945,.82,.98,80,1,true),new THREE.MeshBasicMaterial({color:'#514d47',side:THREE.DoubleSide,toneMapped:false}));wall.position.y=-.4;aperture.add(wall);
  function ring(radius,tube,y,c){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,6,80),new THREE.MeshBasicMaterial({color:c,toneMapped:false}));m.rotation.x=-Math.PI/2;m.position.y=y;aperture.add(m);return m;}
  const whiteRim=new THREE.Mesh(new THREE.RingGeometry(.945,1.078,80),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide,toneMapped:false}));whiteRim.rotation.x=-Math.PI/2;whiteRim.position.y=.105;aperture.add(whiteRim);
  ring(1.083,.015,.1,'#20251b');ring(.945,.018,.093,'#161914');ring(.918,.015,-.08,'#aaa296');ring(.872,.024,-.43,'#33322f');
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(4.8,4.8),new THREE.ShaderMaterial({uniforms:{strength:{value:.22}},vertexShader:'varying vec2 glowUV; void main(){glowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec2 glowUV; uniform float strength; void main(){float r=length(glowUV-.5)*4.8;float a=exp(-pow((r-1.03)/.54,2.0))*strength*smoothstep(.94,1.06,r);gl_FragColor=vec4(1.0,.88,.25,a);}',transparent:true,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.061;aperture.add(halo);
  const upgradeRings=[0,1].map(i=>{const m=new THREE.Mesh(new THREE.RingGeometry(1,1.08,80),new THREE.MeshBasicMaterial({color:i?'#fff8cd':'#ffc632',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));m.rotation.x=-Math.PI/2;scene.add(m);return m;});
  const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.35,0,.27,.35,0,.27,0,0,-.45],3));arrowGeometry.computeVertexNormals();
  const directionArrow=new THREE.Mesh(arrowGeometry,new THREE.MeshBasicMaterial({color:'#ffdf65',side:THREE.DoubleSide,toneMapped:false}));scene.add(directionArrow);
  let directionX=0,directionZ=-1,previousHoleX=sim.hole.x,previousHoleZ=sim.hole.z;
  const sizeCanvas=document.createElement('canvas');sizeCanvas.width=512;sizeCanvas.height=128;const sizeContext=sizeCanvas.getContext('2d'),sizeTexture=new THREE.CanvasTexture(sizeCanvas);sizeTexture.colorSpace=THREE.SRGBColorSpace;
  const sizeLabel=new THREE.Sprite(new THREE.SpriteMaterial({map:sizeTexture,depthTest:false,depthWrite:false,toneMapped:false}));sizeLabel.renderOrder=9;scene.add(sizeLabel);
  function updateSizeLabel(){sizeContext.clearRect(0,0,512,128);sizeContext.font='900 85px Arial';sizeContext.textAlign='center';sizeContext.textBaseline='middle';sizeContext.lineJoin='round';sizeContext.strokeStyle='#263d35';sizeContext.lineWidth=10;sizeContext.strokeText(`Size ${sim.level}`,256,67);sizeContext.fillStyle='#fff';sizeContext.fillText(`Size ${sim.level}`,256,67);sizeTexture.needsUpdate=true;}
  updateSizeLabel();
  const upgradeCanvas=document.createElement('canvas');upgradeCanvas.width=1024;upgradeCanvas.height=256;const uc=upgradeCanvas.getContext('2d');uc.textAlign='center';uc.textBaseline='middle';uc.font='italic 900 150px Arial';uc.lineJoin='round';uc.strokeStyle='#ffc632';uc.lineWidth=24;uc.strokeText('Size Up!',512,120);uc.strokeStyle='#344b36';uc.lineWidth=12;uc.strokeText('Size Up!',512,120);uc.fillStyle='#fffdef';uc.fillText('Size Up!',512,120);const upgradeTexture=new THREE.CanvasTexture(upgradeCanvas);upgradeTexture.colorSpace=THREE.SRGBColorSpace;
  const sizeUpSprite=new THREE.Sprite(new THREE.SpriteMaterial({map:upgradeTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));sizeUpSprite.renderOrder=10;sizeUpSprite.visible=false;scene.add(sizeUpSprite);
  const burstPositions=new Float32Array(72*3),burstGeometry=new THREE.BufferGeometry();burstGeometry.setAttribute('position',new THREE.BufferAttribute(burstPositions,3));const burst=new THREE.Points(burstGeometry,new THREE.PointsMaterial({color:'#fff5a3',size:.14,transparent:true,opacity:0,depthWrite:false}));burst.frustumCulled=false;scene.add(burst);
  // Follow at every screen size. Upgrades change height, distance and visible area.
  let zoom=1,width=innerWidth,height=innerHeight,paused=false,dragging=false,started=false,soundOn=true;
  let targetX=sim.hole.x,targetZ=sim.hole.z,lastLevel=1,lastCount=-1,upgradeTime=-10,lastFrame=performance.now(),lastShadow=0,toastTimer,hintTimer;
  let overview=true,currentSpan=47,visualTime=0,openingTime=0;
  let dragStart=null,activePointerId=null,shadowDirty=false;
  const audio=new GameAudio(error=>{console.warn('Game audio failed:',error);toast('音频未能加载，请重新加载场景。');});
  const lookTarget=new THREE.Vector3(0,1.2,-1),cameraPosition=new THREE.Vector3(0,44,61),desiredPosition=new THREE.Vector3(),desiredTarget=new THREE.Vector3(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();
  const keys=new Set();
  function layout(){
    width=$('game').clientWidth;height=$('game').clientHeight;renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    $('zoom-label').textContent=`${Math.round(zoom*100)}%`;
  }
  function setZoom(v){zoom=THREE.MathUtils.clamp(v,.7,2.1);layout();}
  function pointerWorld(e){const rect=$('scene').getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(groundPlane,point)?point.clone():null;}
  function showHint(){clearTimeout(hintTimer);$('hint').classList.remove('subtle');$('hint').setAttribute('aria-hidden','false');hintTimer=setTimeout(()=>{$('hint').classList.add('subtle');$('hint').setAttribute('aria-hidden','true');},5000);}
  function begin(){overview=false;audio.playing=true;audio.unlock();if(started)return;started=true;openingTime=visualTime;}
  function releasePointer(e){if(e&&e.pointerId!==activePointerId)return;dragging=false;dragStart=null;activePointerId=null;$('scene').classList.remove('dragging');}
  $('scene').addEventListener('pointerdown',e=>{if(paused||dragging||!e.isPrimary||e.button>0)return;const p=pointerWorld(e);if(!p)return;dragging=true;activePointerId=e.pointerId;begin();$('scene').focus({preventScroll:true});$('scene').setPointerCapture(e.pointerId);$('scene').classList.add('dragging');dragStart={clientX:e.clientX,clientY:e.clientY};});
  $('scene').addEventListener('pointermove',e=>{if(!dragging||paused||e.pointerId!==activePointerId)return;const p=pointerWorld(e),previous=pointerWorld(dragStart);if(!p||!previous)return;const scale=movementScale(sim.level),target=clampHolePosition(targetX+(p.x-previous.x)*scale,targetZ+(p.z-previous.z)*scale,sim.hole.radius);targetX=target.x;targetZ=target.z;dragStart={clientX:e.clientX,clientY:e.clientY};});
  $('scene').addEventListener('pointerup',releasePointer);$('scene').addEventListener('pointercancel',releasePointer);$('scene').addEventListener('lostpointercapture',releasePointer);
  $('scene').addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
  function togglePause(){paused=!paused;$('paused').hidden=!paused;$('pause').setAttribute('aria-pressed',String(paused));$('pause').setAttribute('aria-label',paused?'继续游戏':'暂停游戏');$('pause-icon').setAttribute('d',paused?'M8 4 19 12 8 20Z':'M8 5v14M16 5v14');releasePointer();keys.clear();audio.setPlaying(started&&!paused&&!document.hidden);}
  function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400);}
  function reset(){sim.reset();voxels.reset();updateSizeLabel();directionX=0;directionZ=-1;previousHoleX=0;previousHoleZ=20.4;signMeshes.forEach(m=>m.visible=true);targetX=0;targetZ=20.4;lastLevel=1;lastCount=-1;upgradeTime=-10;started=false;overview=true;currentSpan=47;releasePointer();keys.clear();if(paused)togglePause();audio.reset();showHint();$('toast').classList.remove('visible');setZoom(1);renderer.shadowMap.needsUpdate=true;updateHUD();}
  $('pause').onclick=togglePause;$('resume').onclick=togglePause;$('restart').onclick=reset;
  $('zoom-in').onclick=()=>setZoom(zoom*1.15);$('zoom-out').onclick=()=>setZoom(zoom/1.15);$('reset-view').onclick=()=>{overview=!overview;setZoom(1);};
  $('sound').onclick=()=>{soundOn=!soundOn;audio.setEnabled(soundOn);$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'关闭配乐和音效':'开启配乐和音效');$('sound-waves').setAttribute('d',soundOn?'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 5 6m0-6-5 6');};
  document.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>audio.play('click',.28)));
  window.addEventListener('keydown',e=>{if(e.target instanceof HTMLButtonElement)return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k))e.preventDefault();if(k===' '&&!e.repeat)togglePause();if(k==='r'&&!e.repeat)reset();if(!paused&&['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){keys.add(k);begin();}});
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();releasePointer();});
  document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.hidden){keys.clear();releasePointer();}audio.setPlaying(started&&!paused&&!document.hidden);});
  window.addEventListener('resize',layout);
  $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;audio.setPlaying(false);$('error-message').textContent='图形连接已中断，请重新加载场景。';$('error').hidden=false;});
  function updateHUD(){
    if(sim.count===lastCount)return;lastCount=sim.count;
    const percent=Math.floor(sim.count/world.blocks.length*100);$('count').textContent=sim.count.toLocaleString();$('percent').innerHTML=`${percent}<span>%</span>`;$('progress-fill').style.width=`${percent}%`;document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',String(percent));
    const level=sim.level;
    $('level').textContent=`Lv. ${level} / ${LEVELS.length}`;
    if(level>lastLevel){upgradeTime=visualTime;lastLevel=level;updateSizeLabel();audio.celebrate();}
    if(sim.count===world.blocks.length){toast('城市已清空！点击重新开始，再探索一次。');audio.celebrate(true);}
  }
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
      visualTime+=dt;const simulationDt=dt;
      let mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),mz=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      if(mx||mz){const n=Math.hypot(mx,mz),speed=9*movementScale(sim.level),target=clampHolePosition(targetX+mx/n*simulationDt*speed,targetZ+mz/n*simulationDt*speed,sim.hole.radius);targetX=target.x;targetZ=target.z;}
      const target=moveHole(sim.hole,targetX,targetZ,simulationDt,sim.level);targetX=target.x;targetZ=target.z;
      // Waiting before the first gesture lets the full composition remain intact.
      if(started&&simulationDt>0){const beforeCount=sim.count,beforeActive=sim.active.length;sim.tick(simulationDt,transform);const consumed=sim.count-beforeCount;audio.swallow(consumed,Math.max(0,sim.active.length-beforeActive+consumed),sim.level);const position=clampHolePosition(sim.hole.x,sim.hole.z,sim.hole.radius);sim.hole.x=position.x;sim.hole.z=position.z;const target=clampHolePosition(targetX,targetZ,sim.hole.radius);targetX=target.x;targetZ=target.z;if(voxels.dirty.size){voxels.flush();shadowDirty=true;}}
      world.signs.forEach((s,i)=>{if(s.entity>=0)signMeshes[i].visible=!world.entities[s.entity].collapsing;});
      updateHUD();
      updateCamera(dt);
    }
    holeUniform.set(sim.hole.x,sim.hole.z,sim.hole.radius);
    // Slow only upgrade playback through Size 10. Movement and falling keep their real timestep.
    const effectSpeed=sim.level<=10?.75:1,up=(visualTime-upgradeTime)*effectSpeed;
    const effectRadius=Math.max(sim.hole.radius,RADII[9]);
    const pop=up>=0&&up<.24?Math.sin(up/.24*Math.PI)*.11:0,displayRadius=sim.hole.radius*(1+pop);
    aperture.position.set(sim.hole.x,0,sim.hole.z);aperture.scale.set(displayRadius,1,displayRadius);holeUniform.z=displayRadius;
    halo.material.uniforms.strength.value=.22+(up>=0&&up<.85?Math.sin(up/.85*Math.PI)*.52:0);
    for(let i=0;i<upgradeRings.length;i++){const age=up-i*.11,m=upgradeRings[i];m.visible=age>=0&&age<.78;m.material.opacity=m.visible?(1-age/.78)*.98:0;m.position.set(sim.hole.x,.19+i*.025,sim.hole.z);m.scale.setScalar(effectRadius*(1+Math.max(0,age)*1.55));}
    const bannerWidth=Math.max(7.2,sim.hole.radius*3.35)*(1+pop);
    sizeUpSprite.visible=up>=0&&up<.87;sizeUpSprite.material.opacity=Math.min(1,Math.max(0,(.87-up)/.25));sizeUpSprite.position.set(sim.hole.x,sim.hole.radius*.76+1.1+up*.6,sim.hole.z-.15);sizeUpSprite.scale.set(bannerWidth,bannerWidth/4,1);
    burst.visible=up>=0&&up<.7;
    if(burst.visible){burst.material.opacity=1-up/.7;for(let i=0;i<72;i++){const a=i/72*Math.PI*2,r=effectRadius*(1+up*(1.4+(i%4)*.16));burstPositions[i*3]=sim.hole.x+Math.cos(a)*r;burstPositions[i*3+1]=.25+Math.sin(up/.7*Math.PI)*(.4+i%5*.18);burstPositions[i*3+2]=sim.hole.z+Math.sin(a)*r;}burstGeometry.attributes.position.needsUpdate=true;}
    const travelX=sim.hole.x-previousHoleX,travelZ=sim.hole.z-previousHoleZ,travel=Math.hypot(travelX,travelZ);if(travel>.002){directionX=travelX/travel;directionZ=travelZ/travel;}previousHoleX=sim.hole.x;previousHoleZ=sim.hole.z;
    directionArrow.position.set(sim.hole.x+directionX*displayRadius*1.48,.2,sim.hole.z+directionZ*displayRadius*1.48);directionArrow.rotation.y=Math.atan2(-directionX,-directionZ);directionArrow.scale.setScalar(displayRadius*.48);
    sizeLabel.position.set(sim.hole.x,.16,sim.hole.z+displayRadius*1.46);sizeLabel.scale.set(displayRadius*1.86,displayRadius*.465,1);
    if(shadowDirty&&now-lastShadow>220){renderer.shadowMap.needsUpdate=true;lastShadow=now;shadowDirty=false;}
    const district=sim.hole.z< -13?'Hollywood Hills':sim.hole.z< -4?'Downtown Los Angeles':sim.hole.z<7?(sim.hole.x< -7?'Sunset Studios':sim.hole.x>10?'The Grove':'Fountain Plaza'):sim.hole.z<15&&Math.abs(sim.hole.x)<4?'Liberty Plaza':'Beverly Hills';$('district').textContent=district;
    renderer.render(scene,camera);
  }
  layout();currentSpan=Math.max(47,70/(width/height));updateCamera(1);renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);$('loading').hidden=true;showHint();requestAnimationFrame(frame);
}
