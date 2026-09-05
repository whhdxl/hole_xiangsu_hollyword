import {MAP_EDGES,movementBounds} from './movement.js';

export const LEVELS = [0,250,900,2000,3600,5800,8800,12800,18000,25000,34000,46000,61000,80000,103000,131000,165000,205000,252000,310000];
export const RADII = Array.from({length:20},(_,i)=>i===19?9.8:1.12*Math.pow(9.8/1.12,i/19));
export const MAX_FALLING = 8192;
const gridKey=(x,z)=>(x+128)*512+z+128;

export class Simulation {
  constructor(world) {
    this.world = world;
    this.grid = new Map();
    this.sleepGrid = new Map();
    this.active = [];
    this.pending = [];
    this.pendingCursor = 0;
    this.collapseQueue = new Set();
    this.count = 0;
    this.time = 0;
    this.level = 1;
    this.hole = { x: 0, z: 20.4, radius: 1.12 };
    world.blocks.forEach((b, i) => {
      b.ox = b.x; b.oy = b.y; b.oz = b.z; b.state = 0;
      b.vx = 0; b.vy = 0; b.vz = 0; b.rx = 0; b.rz = 0; b.sinking = false;
      const key = gridKey(Math.floor(b.x*2),Math.floor(b.z*2));
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(i);
    });
    for (const e of world.entities) { e.collapsing = false; e.released = 0; }
  }
  release(i, delay = 0) {
    const b = this.world.blocks[i];
    if (b.state) return;
    b.state = 1; b.releaseAt = this.time + delay;
    this.pending.push(i);
    const e=this.world.entities[b.entity];e.released++;
    if(!e.collapsing&&e.released>=Math.max(2,e.ids.length*.14))this.collapseQueue.add(e);
  }
  tick(dt, onChange, onConsume) {
    this.time += dt;
    const {x: hx, z: hz, radius: r} = this.hole;
    const r2 = r * r;
    const limits=movementBounds(r),wallX=hx<=limits.minX+.04?-1:hx>=limits.maxX-.04?1:0,wallZ=hz<=limits.minZ+.04?-1:hz>=limits.maxZ-.04?1:0;
    // At an air wall, pull the stranded edge strip inward; it still falls only over the real aperture.
    const captureDistance2=(x,z)=>{
      const px=wallX<0?Math.max(x,limits.minX):wallX>0?Math.min(x,limits.maxX):x;
      const pz=wallZ<0?Math.max(z,limits.minZ):wallZ>0?Math.min(z,limits.maxZ):z;
      return (px-hx)**2+(pz-hz)**2;
    };
    const scanMinX=wallX<0?MAP_EDGES.minX-1.5:hx-r,scanMaxX=wallX>0?MAP_EDGES.maxX+1.5:hx+r;
    const scanMinZ=wallZ<0?MAP_EDGES.minZ-1.5:hz-r,scanMaxZ=wallZ>0?MAP_EDGES.maxZ+1.5:hz+r;
    // A spatial index releases the columns touching the aperture, bottom first.
    for(let gx=Math.floor(scanMinX*2);gx<=Math.floor(scanMaxX*2);gx++) for(let gz=Math.floor(scanMinZ*2);gz<=Math.floor(scanMaxZ*2);gz++) {
      const ids=this.grid.get(gridKey(gx,gz)); if(!ids)continue;
      for(let j=ids.length-1;j>=0;j--){const i=ids[j],b=this.world.blocks[i];
        if(!b.state&&captureDistance2(b.x,b.z)<r2*.93)this.release(i,.025+Math.max(0,b.y-.3)*.07+((i*7)%13)*.007);
        if(b.state){ids[j]=ids[ids.length-1];ids.pop();}
      }
      if(!ids.length)this.grid.delete(gridKey(gx,gz));
    }
    // Resting fragments leave the falling budget and wake only when the hole approaches their cell.
    for(let gx=Math.floor((scanMinX-2.5)*2);gx<=Math.floor((scanMaxX+2.5)*2);gx++)for(let gz=Math.floor((scanMinZ-2.5)*2);gz<=Math.floor((scanMaxZ+2.5)*2);gz++){
      const key=gridKey(gx,gz),ids=this.sleepGrid.get(key);if(!ids)continue;
      for(let j=ids.length-1;j>=0;j--){const i=ids[j],b=this.world.blocks[i];if(captureDistance2(b.x,b.z)>(r+2.3)**2)continue;
        b.state=1;b.releaseAt=this.time;this.pending.push(i);ids[j]=ids[ids.length-1];ids.pop();
      }
      if(!ids.length)this.sleepGrid.delete(key);
    }
    // Unsupported structures progressively collapse; loose pieces remain physical.
    for(const e of this.collapseQueue){
      e.collapsing=true;
      for(const i of e.ids){const b=this.world.blocks[i];this.release(i,.12+Math.sqrt((b.ox-hx)**2+(b.oz-hz)**2)*.1+Math.max(0,b.oy)*.045);}
    }
    this.collapseQueue.clear();
    // Start an avalanche in short waves: all pieces remain independent, with bounded simultaneous work.
    let examined=0,started=0,available=Math.min(768,MAX_FALLING-this.active.length);
    const scanBudget=Math.min(this.pending.length,4096);
    while(this.pending.length&&examined++<scanBudget&&started<available){
      if(this.pendingCursor>=this.pending.length)this.pendingCursor=0;
      const i=this.pending[this.pendingCursor],b=this.world.blocks[i];
      if(this.time<b.releaseAt){this.pendingCursor++;continue;}
      this.pending[this.pendingCursor]=this.pending[this.pending.length-1];this.pending.pop();
      b.state=2;b.vx=Math.sin(i*31.7)*.5;b.vz=Math.cos(i*27.3)*.5;b.spin=Math.sin(i*12.3)*2.6;
      this.active.push(i);started++;
    }
    const drag=Math.exp(-dt*5),hasWall=wallX||wallZ;
    for(let k=this.active.length-1;k>=0;k--){
      const i=this.active[k], b=this.world.blocks[i];
      const dx=hx-b.x,dz=hz-b.z,d=Math.sqrt(dx*dx+dz*dz),inside=d<r*.99||b.sinking;
      const influence=Math.max(0,1-(hasWall?Math.sqrt(captureDistance2(b.x,b.z)):d)/(r+2.5));
      if(!inside&&influence===0&&b.y<=b.sy*.48+.131&&Math.abs(b.vx)+Math.abs(b.vy)+Math.abs(b.vz)<.03){
        b.state=4;const key=gridKey(Math.floor(b.x*2),Math.floor(b.z*2));if(!this.sleepGrid.has(key))this.sleepGrid.set(key,[]);this.sleepGrid.get(key).push(i);
        this.active[k]=this.active[this.active.length-1];this.active.pop();onChange?.(i,b);continue;
      }
      if(inside || influence>0){const accel=inside?10:12*influence;b.vx+=(dx/(d+.12)*accel-b.vx*2.3)*dt;b.vz+=(dz/(d+.12)*accel-b.vz*2.3)*dt;}
      else {b.vx*=drag;b.vz*=drag;}
      b.vy-=18*dt;
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
      if(inside&&b.y<-.12)b.sinking=true;
      if(!inside&&b.y<b.sy*.48+.13){b.y=b.sy*.48+.13;if(b.vy<-.8)b.vy=-b.vy*.14;else b.vy=0;b.vx*=.9;b.vz*=.9;}
      if(inside||b.y>b.sy*.5+.18){b.rx+=b.spin*dt;b.rz+=b.spin*.7*dt;}
      if(b.y< -1.7){
        b.state=3;b.y=-100;this.count++;onConsume?.(b);
        this.active[k]=this.active[this.active.length-1];this.active.pop();
      }
      onChange?.(i,b);
    }
    // Radius changes on the threshold-crossing frame; no continuous growth drift.
    while(this.level<LEVELS.length&&this.count>=LEVELS[this.level])this.level++;
    this.hole.radius=RADII[this.level-1];
  }
  reset(onChange) {
    this.active.length=0;this.pending.length=0;this.pendingCursor=0;this.collapseQueue.clear();this.count=0;this.time=0;this.level=1;
    this.hole.x=0;this.hole.z=20.4;this.hole.radius=1.12;
    this.grid.clear();this.sleepGrid.clear();
    this.world.blocks.forEach((b,i)=>{b.x=b.ox;b.y=b.oy;b.z=b.oz;b.vx=b.vy=b.vz=b.rx=b.rz=0;b.state=0;b.sinking=false;const key=gridKey(Math.floor(b.x*2),Math.floor(b.z*2));if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(i);onChange?.(i,b);});
    for(const e of this.world.entities){e.collapsing=false;e.released=0;}
  }
}
