export const LEVELS = [0, 300, 1500, 4500, 10500, 24000, 50000, 100000, 180000];
export const RADII = [1.12, 1.52, 2.08, 2.78, 3.66, 4.78, 6.18, 7.85, 9.8];

export class Simulation {
  constructor(world) {
    this.world = world;
    this.grid = new Map();
    this.active = [];
    this.count = 0;
    this.time = 0;
    this.level = 1;
    this.hole = { x: 0, z: 20.4, radius: 1.12 };
    world.blocks.forEach((b, i) => {
      b.ox = b.x; b.oy = b.y; b.oz = b.z; b.state = 0;
      b.vx = 0; b.vy = 0; b.vz = 0; b.rx = 0; b.rz = 0; b.sinking = false;
      const key = `${Math.floor(b.x * 2)},${Math.floor(b.z * 2)}`;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(i);
    });
    for (const e of world.entities) { e.collapsing = false; e.released = 0; }
  }
  release(i, delay = 0) {
    const b = this.world.blocks[i];
    if (b.state) return;
    b.state = 1; b.releaseAt = this.time + delay;
    b.vx = Math.sin(i * 31.7) * .5; b.vz = Math.cos(i * 27.3) * .5;
    b.spin = Math.sin(i * 12.3) * 2.6;
    this.active.push(i);
    this.world.entities[b.entity].released++;
  }
  tick(dt, onChange, onConsume) {
    this.time += dt;
    const {x: hx, z: hz, radius: r} = this.hole;
    const r2 = r * r;
    // A spatial index releases the columns touching the aperture, bottom first.
    for(let gx=Math.floor((hx-r)*2);gx<=Math.floor((hx+r)*2);gx++) for(let gz=Math.floor((hz-r)*2);gz<=Math.floor((hz+r)*2);gz++) {
      const ids=this.grid.get(`${gx},${gz}`); if(!ids)continue;
      let hasIdle=false;
      for(const i of ids){const b=this.world.blocks[i];if(b.state)continue;hasIdle=true;const d2=(b.x-hx)**2+(b.z-hz)**2;
        if(d2<r2*.93)this.release(i,.025+Math.max(0,b.y-.3)*.07+((i*7)%13)*.007);
      }
      if(!hasIdle)this.grid.delete(`${gx},${gz}`);
    }
    // Unsupported structures progressively collapse; loose pieces remain physical.
    for(const e of this.world.entities){
      if(e.collapsing||e.released<Math.max(2,e.ids.length*.14))continue;
      e.collapsing=true;
      for(const i of e.ids){const b=this.world.blocks[i];this.release(i,.12+Math.hypot(b.ox-hx,b.oz-hz)*.1+Math.max(0,b.oy)*.045);}
    }
    for(let k=this.active.length-1;k>=0;k--){
      const i=this.active[k], b=this.world.blocks[i];
      if(this.time<b.releaseAt)continue;
      b.state=2;
      const dx=hx-b.x,dz=hz-b.z,d=Math.hypot(dx,dz),inside=d<r*.99||b.sinking;
      const influence=Math.max(0,1-d/(r+2.5));
      if(!inside&&influence===0&&b.y<=b.sy*.48+.131&&Math.abs(b.vx)+Math.abs(b.vy)+Math.abs(b.vz)<.03)continue;
      if(inside || influence>0){const accel=inside?10:12*influence;b.vx+=(dx/(d+.12)*accel-b.vx*2.3)*dt;b.vz+=(dz/(d+.12)*accel-b.vz*2.3)*dt;}
      else {b.vx*=Math.exp(-dt*5);b.vz*=Math.exp(-dt*5);}
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
    this.active.length=0;this.count=0;this.time=0;this.level=1;
    this.hole.x=0;this.hole.z=20.4;this.hole.radius=1.12;
    this.grid.clear();
    this.world.blocks.forEach((b,i)=>{b.x=b.ox;b.y=b.oy;b.z=b.oz;b.vx=b.vy=b.vz=b.rx=b.rz=0;b.state=0;b.sinking=false;const key=`${Math.floor(b.x*2)},${Math.floor(b.z*2)}`;if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(i);onChange?.(i,b);});
    for(const e of this.world.entities){e.collapsing=false;e.released=0;}
  }
}
