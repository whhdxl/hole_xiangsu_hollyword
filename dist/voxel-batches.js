import * as THREE from './vendor/three.module.js';
import {MAX_FALLING} from './physics.js';

// XYZ Euler transform written directly into the packed GPU buffer, without per-piece objects.
export function writeVoxelMatrix(a,o,b){
  const x=b.rx||0,y=b.rotation||0,z=b.rz||0,ax=Math.cos(x),bx=Math.sin(x),cy=Math.cos(y),dy=Math.sin(y),ez=Math.cos(z),fz=Math.sin(z);
  a[o]=cy*ez*b.sx;a[o+1]=(ax*fz+bx*ez*dy)*b.sx;a[o+2]=(bx*fz-ax*ez*dy)*b.sx;a[o+3]=0;
  a[o+4]=-cy*fz*b.sy;a[o+5]=(ax*ez-bx*fz*dy)*b.sy;a[o+6]=(bx*ez+ax*fz*dy)*b.sy;a[o+7]=0;
  a[o+8]=dy*b.sz;a[o+9]=-bx*cy*b.sz;a[o+10]=ax*cy*b.sz;a[o+11]=0;
  a[o+12]=b.x;a[o+13]=b.y;a[o+14]=b.z;a[o+15]=1;
}

function queueRange(attribute,start,count){
  let end=start+count;
  // Keep dirty ranges until Three uploads them, including batches currently outside the view.
  for(let i=attribute.updateRanges.length-1;i>=0;i--){const r=attribute.updateRanges[i];if(start<=r.start+r.count&&end>=r.start){start=Math.min(start,r.start);end=Math.max(end,r.start+r.count);attribute.updateRanges.splice(i,1);i=attribute.updateRanges.length;}}
  attribute.addUpdateRange(start,end-start);
}

export class VoxelBatches{
  constructor(scene,world,geometry,material){
    this.world=world;this.batches=[];this.dirty=new Set();this.batchOf=new Uint16Array(world.blocks.length);this.slotOf=new Uint32Array(world.blocks.length);this.movingSlot=new Int32Array(world.blocks.length).fill(-1);
    this.colors=new Float32Array(world.blocks.length*3);
    const buckets=new Map(),color=new THREE.Color();
    world.blocks.forEach((b,i)=>{const key=`${Math.floor(b.x/6)},${Math.floor(b.z/6)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);color.set(b.color).multiplyScalar(b.shade);color.toArray(this.colors,i*3);});
    const makeBatch=(ids,capacity,shadows)=>{
      const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage);mesh.count=ids.length;mesh.castShadow=shadows;mesh.receiveShadow=true;
      const batch={mesh,ids:new Uint32Array(capacity),changed:new Uint8Array(Math.ceil(capacity/64))};batch.ids.set(ids);scene.add(mesh);return batch;
    };
    for(const ids of buckets.values()){
      const batch=makeBatch(ids,ids.length,false),index=this.batches.length;this.batches.push(batch);
      ids.forEach((id,slot)=>{this.batchOf[id]=index;this.slotOf[id]=slot;writeVoxelMatrix(batch.mesh.instanceMatrix.array,slot*16,world.blocks[id]);batch.mesh.instanceColor.array.set(this.colors.subarray(id*3,id*3+3),slot*3);});
      batch.mesh.computeBoundingSphere();batch.mesh.boundingSphere.radius+=1;batch.baseSphere=batch.mesh.boundingSphere.clone();
    }
    this.moving=makeBatch([],MAX_FALLING,true);this.moving.mesh.frustumCulled=false;
    // Coarse occupancy preserves architectural shadow silhouettes without redrawing every tiny cube.
    this.shadowOf=new Int32Array(world.blocks.length).fill(-1);this.shadowRemoved=new Uint8Array(world.blocks.length);
    const cells=new Map(),proxies=[];
    world.blocks.forEach((b,i)=>{
      if(b.y<.35)return;
      const key=`${Math.floor(b.x/.55)},${Math.floor(b.y/.55)},${Math.floor(b.z/.55)}`;
      let n=cells.get(key);if(n===undefined){n=proxies.length;cells.set(key,n);proxies.push({minX:Infinity,minY:Infinity,minZ:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:-Infinity,count:0});}
      this.shadowOf[i]=n;const p=proxies[n],co=Math.abs(Math.cos(b.rotation||0)),si=Math.abs(Math.sin(b.rotation||0)),ex=(b.sx*co+b.sz*si)/2,ez=(b.sz*co+b.sx*si)/2;
      p.minX=Math.min(p.minX,b.x-ex);p.maxX=Math.max(p.maxX,b.x+ex);p.minY=Math.min(p.minY,b.y-b.sy/2);p.maxY=Math.max(p.maxY,b.y+b.sy/2);p.minZ=Math.min(p.minZ,b.z-ez);p.maxZ=Math.max(p.maxZ,b.z+ez);p.count++;
    });
    this.shadow=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}),proxies.length);this.shadow.castShadow=true;this.shadow.frustumCulled=false;this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadowRemaining=Int32Array.from(proxies,p=>p.count);this.shadowTotals=this.shadowRemaining.slice();this.shadowDirty=new Set();
    proxies.forEach((p,i)=>writeVoxelMatrix(this.shadow.instanceMatrix.array,i*16,{x:(p.minX+p.maxX)/2,y:(p.minY+p.maxY)/2,z:(p.minZ+p.maxZ)/2,sx:p.maxX-p.minX,sy:p.maxY-p.minY,sz:p.maxZ-p.minZ}));
    this.shadowOriginal=this.shadow.instanceMatrix.array.slice();scene.add(this.shadow);
  }
  mark(batch,slot){batch.changed[slot>>6]=1;this.dirty.add(batch);}
  remove(batch,slot,dynamic){
    const last=--batch.mesh.count;this.dirty.add(batch);
    if(slot!==last){const id=batch.ids[last];batch.ids[slot]=id;(dynamic?this.movingSlot:this.slotOf)[id]=slot;batch.mesh.instanceMatrix.array.copyWithin(slot*16,last*16,last*16+16);batch.mesh.instanceColor.array.copyWithin(slot*3,last*3,last*3+3);this.mark(batch,slot);}
  }
  transform=(i,b)=>{
    const origin=this.batches[this.batchOf[i]];let slot=this.movingSlot[i],batch=origin;
    if(b.state===3){if(slot>=0){this.remove(this.moving,slot,true);this.movingSlot[i]=-1;}return;}
    if(b.state===2){
      if(slot<0){this.remove(origin,this.slotOf[i],false);slot=this.moving.mesh.count++;this.moving.ids[slot]=i;this.movingSlot[i]=slot;
        this.moving.mesh.instanceColor.array.set(this.colors.subarray(i*3,i*3+3),slot*3);
      }
      batch=this.moving;
    }else{
      if(slot>=0){this.remove(this.moving,slot,true);this.movingSlot[i]=-1;this.slotOf[i]=origin.mesh.count++;origin.ids[this.slotOf[i]]=i;origin.mesh.instanceColor.array.set(this.colors.subarray(i*3,i*3+3),this.slotOf[i]*3);}
      slot=this.slotOf[i];
    }
    if(b.state!==0&&!this.shadowRemoved[i]){this.shadowRemoved[i]=1;const n=this.shadowOf[i];if(n>=0&&--this.shadowRemaining[n]===0){this.shadow.instanceMatrix.array.fill(0,n*16,n*16+16);this.shadowDirty.add(n>>6);}}
    writeVoxelMatrix(batch.mesh.instanceMatrix.array,slot*16,b);this.mark(batch,slot);
    const sphere=batch.mesh.boundingSphere;if(sphere&&batch!==this.moving){const d2=(b.x-sphere.center.x)**2+(b.y-sphere.center.y)**2+(b.z-sphere.center.z)**2;if(d2>(sphere.radius-.5)**2)sphere.radius=Math.sqrt(d2)+1;}
  };
  flush(){
    for(const batch of this.dirty){
      const matrix=batch.mesh.instanceMatrix,colors=batch.mesh.instanceColor;
      for(let i=0;i<batch.changed.length;i++){if(!batch.changed[i])continue;const start=i;while(i+1<batch.changed.length&&batch.changed[i+1])batch.changed[++i]=0;batch.changed[start]=0;
        const count=Math.min((i+1)*64,batch.mesh.count)-start*64;if(count>0){queueRange(matrix,start*64*16,count*16);queueRange(colors,start*64*3,count*3);}
      }
      if(matrix.updateRanges.length)matrix.needsUpdate=true;if(colors.updateRanges.length)colors.needsUpdate=true;
    }
    this.dirty.clear();
    if(this.shadowDirty.size){const m=this.shadow.instanceMatrix;for(const n of this.shadowDirty)queueRange(m,n*64*16,Math.min(64,this.shadow.count-n*64)*16);m.needsUpdate=true;this.shadowDirty.clear();}
  }
  reset(){
    this.moving.mesh.count=0;this.movingSlot.fill(-1);for(const batch of this.batches){batch.mesh.count=0;batch.mesh.boundingSphere.copy(batch.baseSphere);}
    this.world.blocks.forEach((b,i)=>{const batch=this.batches[this.batchOf[i]],slot=batch.mesh.count++;batch.ids[slot]=i;this.slotOf[i]=slot;writeVoxelMatrix(batch.mesh.instanceMatrix.array,slot*16,b);batch.mesh.instanceColor.array.set(this.colors.subarray(i*3,i*3+3),slot*3);this.mark(batch,slot);});
    this.shadowRemoved.fill(0);this.shadowRemaining.set(this.shadowTotals);this.shadow.instanceMatrix.array.set(this.shadowOriginal);this.shadow.instanceMatrix.clearUpdateRanges();this.shadow.instanceMatrix.needsUpdate=true;this.flush();
  }
}
