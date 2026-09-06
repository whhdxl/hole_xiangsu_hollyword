// Original distant Los Angeles districts. Static exposed voxels only; no gameplay objects.
export function createBackgroundCity(){
  const districts=[];
  const schemes=[
    {name:'Palm Court',cx:-72,cz:-44,w:38,d:28,kind:0},
    {name:'Downtown',cx:6,cz:-69,w:43,d:29,kind:1},
    {name:'Marina Quarter',cx:68,cz:-31,w:36,d:32,kind:2},
  ];
  const facades=['#e2ddc5','#d7cfbd','#bed1cd','#d5c6bb','#c8d1b9','#d6deda'];
  const glass=['#78a5b2','#6b98a7','#83b0b8','#729da9'];
  for(const cfg of schemes){
    const {cx,cz,w,d,kind}=cfg,boxes=[];
    const add=(x,y,z,sx,sy,sz,color)=>boxes.push({x:cx+x,y,z:cz+z,sx,sy,sz,color});
    const slab=(x,b,z,sx,sy,sz,color)=>add(x,b+sy/2,z,sx,sy,sz,color);
    const hash=(n)=>{const q=Math.sin(n*127.1+kind*311.7)*43758.5453;return q-Math.floor(q);};
    // Layered, stepped sandstone plinths, with a thin curb and tiled turf.
    slab(0,-3.7,0,w-1.0,.45,d-1.0,'#ac9975');
    slab(0,-3.25,0,w-.45,1.72,d-.45,'#c6b58c');
    slab(0,-1.53,0,w,.25,d,'#ddcca0');
    const nx=Math.ceil(w/1.2),nz=Math.ceil(d/1.2),tx=w/nx,tz=d/nz;
    const vx=[-w*.263,0,w*.263],hz=[-d*.19,d*.19];
    const road=(x,z)=>vx.some(v=>Math.abs(x-v)<1.19)||hz.some(v=>Math.abs(z-v)<1.19);
    for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
      const x=-w/2+(ix+.5)*tx,z=-d/2+(iz+.5)*tz;
      const grass=['#a6bda0','#adc5a4','#b7cba8','#9eb79a'];
      slab(x,-1.28,z,tx,.13,tz,road(x,z)?'#a7b7b7':grass[(ix*7+iz*3+kind)%4]);
    }
    // Continuous street ribbons remove the chunky tile aliasing at junctions.
    for(const x of vx){
      slab(x,-1.146,0,2.14,.025,d-.35,'#a7b7b7');
      for(const side of [-1,1])for(let z=-d/2+.6;z<d/2-.55;z+=1.16){
        if(hz.some(v=>Math.abs(z-v)<1.55))continue;
        slab(x+side*1.19,-1.13,z,.32,.085,1.10,'#dddccb');
      }
      for(let z=-d/2+1.2;z<d/2-1;z+=1.8)if(!hz.some(v=>Math.abs(z-v)<1.7))slab(x,-1.113,z,.08,.018,.7,'#e6e5d7');
    }
    for(const z of hz){
      slab(0,-1.115,z,w-.35,.021,2.14,'#a7b7b7');
      for(const side of [-1,1])for(let x=-w/2+.7;x<w/2-.55;x+=1.16){
        if(vx.some(v=>Math.abs(x-v)<1.55))continue;
        slab(x,-1.09,z+side*1.19,1.10,.085,.32,'#dddccb');
      }
      for(let x=-w/2+1.2;x<w/2-1;x+=1.8)if(!vx.some(v=>Math.abs(x-v)<1.7))slab(x,-1.086,z,.7,.018,.08,'#e6e5d7');
      for(const x of vx)for(const side of [-1,1])for(let k=-2;k<=2;k++){
        slab(x+k*.34,-1.081,z+side*1.50,.19,.018,.61,'#ece9d7');
        slab(x+side*1.50,-1.081,z+k*.34,.61,.018,.19,'#ece9d7');
      }
    }
    const tree=(x,z,height=2.1)=>{
      const trunk=.24,step=.34,n=Math.round(height/step);
      for(let j=0;j<n;j++)slab(x,-1.1+j*step,z,trunk,step,trunk,j%2?'#baac87':'#a99675');
      const y=-1.1+n*step;
      for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)slab(x+dx*.35,y,z+dz*.35,.36,.32,.36,'#9caf82');
      slab(x,y+.32,z,.38,.25,.38,'#b7c398');
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(let k=2;k<=3;k++){
        slab(x+dx*k*.33,y-(k-1)*.16,z+dz*k*.33,.36,.28,.36,k===3?'#aabf91':'#91a87c');
        if(k===2)slab(x+dx*k*.33+dz*.30,y-.24,z+dz*k*.33+dx*.30,.32,.24,.32,'#a1b788');
      }
    };
    const building=(x,z,nx,nz,ny,seed,style)=>{
      const u=.50,base=-1.07,facade=facades[seed%facades.length],window=glass[seed%glass.length];
      const occupied=new Set(),coords=[];
      const key=(a,b,c)=>`${a},${b},${c}`;
      // Upper storeys step inward: all interior cells are discarded before output.
      for(let y=0;y<ny;y++){
        const inset=style===1?(y>=ny-3?1:0):style===2?(y>=ny-5?1:0):0;
        for(let iz=inset;iz<nz-inset;iz++)for(let ix=inset;ix<nx-inset;ix++){
          occupied.add(key(ix,y,iz));coords.push([ix,y,iz]);
        }
      }
      for(const [ix,iy,iz] of coords){
        const ns=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
        if(ns.every(([a,b,c])=>occupied.has(key(ix+a,iy+b,iz+c))))continue;
        // Hidden ground-facing interior floor cells are omitted too.
        if(iy===0&&ix>0&&ix<nx-1&&iz>0&&iz<nz-1)continue;
        const roof=!occupied.has(key(ix,iy+1,iz));
        const front=!occupied.has(key(ix,iy,iz+1))||!occupied.has(key(ix,iy,iz-1));
        const side=!occupied.has(key(ix+1,iy,iz))||!occupied.has(key(ix-1,iy,iz));
        let c=facade;
        if(roof)c='#e6e4d3';
        else if(iy===ny-2||iy%5===4)c='#dfdfd0';
        else if(iy>0&&((front&&ix%3!==0)||(side&&iz%3!==0)))c=window;
        if(iy===0&&((front&&ix===Math.floor(nx/2))||(side&&iz===Math.floor(nz/2))))c='#779b9e';
        add(x+(ix-(nx-1)/2)*u,base+(iy+.5)*u,z+(iz-(nz-1)/2)*u,u*.985,u*.985,u*.985,c);
      }
      const top=base+ny*u;
      // Small roof plant is visible against the light, stepped roof planes.
      slab(x-.25,top,z-.16,.7,.35,.65,'#b0bfb8');
      slab(x-.25,top+.35,z-.16,.76,.09,.70,'#d1d8cb');
      if(seed%3===0){
        for(const dx of [-.3,.3])for(const dz of [-.3,.3])slab(x+dx,top,z+dz,.11,.28,.11,'#a9b4a6');
        slab(x,top+.28,z,.8,.50,.8,'#b9b9a1');
        slab(x,top+.78,z,.6,.16,.6,'#d1cfb5');
      }
      // Residential roof caps and frontage awnings give the low-rise districts an LA silhouette.
      if(style===3){
        const h=.22;
        for(let k=0;k<3;k++)slab(x,top+k*h,z,nx*u+.15-k*.36,h,nz*u+.15-k*.36,k%2?'#c7a48d':'#c09a82');
      }
      if(ny<11)for(let j=0;j<Math.max(3,nx-1);j++)slab(x+(j-(nx-2)/2)*u,base+.9,z+nz*u/2+.2,.49,.14,.43,j%2?'#e0ded0':(kind===2?'#9ebac0':'#a9b79a'));
    };
    const xblocks=[(-w/2+vx[0])/2,(vx[0]+vx[1])/2,(vx[1]+vx[2])/2,(vx[2]+w/2)/2];
    const zblocks=[(-d/2+hz[0])/2,(hz[0]+hz[1])/2,(hz[1]+d/2)/2];
    let count=0;
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const bx=xblocks[col],bz=zblocks[row],seed=row*13+col*5+kind*23;
      // One open, planted plaza per district breaks up the built blocks.
      if((kind===1&&row===2&&col===1)||(kind===0&&row===1&&col===2)||(kind===2&&row===2&&col===3)){
        const pw=kind===1?6.2:5.4,pd=kind===2?7.5:6.0;
        slab(bx,-1.12,bz,pw,.10,pd,'#b7c8a6');
        slab(bx,-1.01,bz,pw,.06,.68,'#ded9bd');
        slab(bx,-1.00,bz,.68,.05,pd,'#ded9bd');
        slab(bx,-.95,bz,2.1,.18,1.75,'#e0dac3');
        slab(bx,-.75,bz,1.7,.07,1.35,'#8dc2c5');
        slab(bx,-.68,bz,.4,.38,.4,'#dce6dc');
        for(const dx of [-1,1])for(const dz of [-1,1])tree(bx+dx*(pw/2-.8),bz+dz*(pd/2-.8),2.0);
        continue;
      }
      for(let b=0;b<2;b++){
        const seed2=seed+b*7;
        const x=bx+(b?1.65:-1.65),z=bz+(hash(seed2)-.5)*.85;
        let ny=kind===0?5+seed2%4:kind===2?6+seed2%6:7+seed2%7;
        if(kind===1&&row===0&&(col===1||col===2))ny=b===1?24+col:15+col;
        if(kind===0&&row===0&&col===0&&b===0)ny=12;
        let cellsX=5+(seed2%2),cellsZ=5+(seed2%3);
        if(kind===1&&ny>19){cellsX=6;cellsZ=7;}
        let style=ny>13?2:seed2%5===0?1:kind===0&&ny<8?3:0;
        building(x,z,cellsX,cellsZ,ny,seed2,style);count++;
      }
      // Tiny front gardens and one palm mark each block without hiding façades.
      const tz=bz+Math.min(3.1,d*.095);
      tree(bx,tz,1.7+(seed%3)*.24);
      for(let k=-1;k<=1;k++)slab(bx+k*.4,-1.07,tz+.95,.38,.28,.42,k===0?'#a1b38c':'#aaba93');
    }
    // A short seafront promenade and pools belong to the marina district only.
    if(kind===2){
      const z=d/2-1.1;
      slab(0,-1.10,z,w-1,.09,1.22,'#ddd4bb');
      for(let x=-w/2+1.5;x<w/2-1;x+=2.1){
        slab(x,-1.01,z+.45,.13,.58,.13,'#e8e4d5');
        slab(x,-.48,z+.45,2.1,.1,.10,'#d6d9cd');
      }
      for(const x of [-11,3,12])tree(x,z-.55,2.35);
    }
    const car=(x,z,along,seed)=>{
      const c=['#d3b6a0','#bed0c7','#e2d7b8','#9cb8c2'][seed%4];
      const part=(dx,y,dz,sx,sy,sz,col)=>along?slab(x+dz,y,z+dx,sz,sy,sx,col):slab(x+dx,y,z+dz,sx,sy,sz,col);
      part(0,-1.02,0,.62,.25,1.2,c);part(0,-.77,-.06,.54,.24,.59,'#cadbd7');
      part(0,-.755,.27,.48,.21,.08,'#779fac');part(0,-.75,-.4,.48,.19,.08,'#84aab2');
      for(const dx of [-.34,.34])for(const dz of [-.36,.36])part(dx,-1.02,dz,.12,.25,.22,'#8c9998');
      part(0,-.9,.6,.51,.08,.06,'#e5e0cc');
    };
    for(let k=0;k<8;k++){
      const z=hz[Math.floor(k/4)]+(k%2?.47:-.47),x=-w*.39+(k%4)*w*.25;
      if(vx.some(v=>Math.abs(x-v)<1.7))continue;
      car(x,z,true,k+kind); 
    }
    for(let k=0;k<3;k++)car(vx[k]+.49,-d*.37+k*1.2,false,k+3);
    districts.push({name:cfg.name,boxes});
  }
  return districts;
}
