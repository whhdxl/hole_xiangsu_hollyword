// Original voxel geometry. All interactive pieces have independent transforms.
export function createWorld(landmarks = []) {
  const blocks = [], terrain = [], signs = [], entities = [];
  let seed = 1742, current = -1;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const P = { cream: '#f5e9c6', trim: '#fff8e3', sand: '#dfc797', road: '#818b90', walk: '#e7d5b1', green: '#7baf27', lime: '#aad039', darkGreen: '#3d762c', trunk: '#976137', blue: '#378bd0', glass: '#559bc3', pool: '#26cfe1', orange: '#d76f39', pink: '#ed9fb0', mint: '#8fceb4', yellow: '#f2c75c', purple: '#a3a0d1' };
  function entity(name, x, z) { current = entities.length; entities.push({ name, x, z, ids: [], released: 0, signIds: [] }); return current; }
  function block(x, y, z, sx, sy, sz, color, fixed = false, rotation = 0) {
    if (fixed) {terrain.push({x,y,z,sx,sy,sz,color,rotation,shade:.96+random()*.07});return;}
    if (current < 0) entity('街景', x, z);
    // Fine independent pieces follow facades, roofs, trim, foliage and landmark silhouettes.
    const nx=Math.max(1,Math.round(sx/.145)),ny=Math.max(1,Math.round(sy/.145)),nz=Math.max(1,Math.round(sz/.145));
    const co=Math.cos(rotation),si=Math.sin(rotation);
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
      const dx=-sx/2+(ix+.5)*sx/nx,dz=-sz/2+(iz+.5)*sz/nz;
      const b={x:x+dx*co+dz*si,y:y-sy/2+(iy+.5)*sy/ny,z:z-dx*si+dz*co,sx:sx/nx*.988,sy:sy/ny*.988,sz:sz/nz*.988,color,rotation,shade:.94+random()*.11,entity:current};
      entities[current].ids.push(blocks.length);blocks.push(b);
    }
  }
  function box(x, y, z, w, h, d, color, step = .32, shell = false, fixed = false) {
    const nx = Math.max(1, Math.round(w / step)), ny = Math.max(1, Math.round(h / step)), nz = Math.max(1, Math.round(d / step));
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      if (shell && ix > 0 && ix < nx - 1 && iz > 0 && iz < nz - 1 && iy > 0 && iy < ny - 1) continue;
      block(x - w / 2 + (ix + .5) * w / nx, y + (iy + .5) * h / ny, z - d / 2 + (iz + .5) * d / nz, w / nx * .975, h / ny * .975, d / nz * .975, color, fixed);
    }
  }
  function earthBlock(x,y,z,sx,sy,sz,color){
    // Turf and hillside soil are persistent, consumable chunks, grouped by small ground patches.
    const nx=Math.max(1,Math.round(sx/.24)),ny=Math.max(1,Math.round(sy/.24)),nz=Math.max(1,Math.round(sz/.24)),shade=.96+random()*.07;
    for(let ix=0;ix<nx;ix++)for(let iy=0;iy<ny;iy++)for(let iz=0;iz<nz;iz++){
      const b={x:x-sx/2+(ix+.5)*sx/nx,y:y-sy/2+(iy+.5)*sy/ny,z:z-sz/2+(iz+.5)*sz/nz,sx:sx/nx*.982,sy:sy/ny*.982,sz:sz/nz*.982,color,rotation:0,shade:shade+.018*Math.sin(ix*13+iy*17+iz*7),entity:current};
      entities[current].ids.push(blocks.length);blocks.push(b);
    }
  }
  function label(text, x, y, z, w, h, fg = '#fff9e5', bg = '#21633c', fixed = false) {
    const i = signs.length; signs.push({ text, x, y, z, w, h, fg, bg, entity: fixed ? -1 : current });
    if (!fixed) entities[current].signIds.push(i);
  }
  function landmark(name,x,z,y=.1){
    const model=landmarks.find(m=>m.key===name);if(!model){if(landmarks.length)throw new Error(`Missing landmark asset: ${name}`);return;}
    entity(model.name,x,z);
    for(const b of model.boxes)block(x+b.x,y+b.y,z+b.z,b.sx,b.sy,b.sz,b.color,false,b.rotation||0);
    for(const s of model.signs||[]){label(s.text,x+s.x,y+s.y,z+s.z,s.w,s.h,s.fg,s.bg);signs[signs.length-1].rotation=s.rotation||0;}
  }
  function ellipsoid(x, y, z, rx, ry, rz, color, step = .26) {
    for (let a = -rx; a <= rx; a += step) for (let b = -ry; b <= ry; b += step) for (let c = -rz; c <= rz; c += step) {
      const v = (a / rx) ** 2 + (b / ry) ** 2 + (c / rz) ** 2;
      if (v <= 1 && v >= .45) block(x + a, y + b, z + c, step * .98, step * .98, step * .98, color);
    }
  }
  function palm(x, z, h = 3, base = .12) {
    entity('棕榈树', x, z);
    for (let y = base; y < h + base; y += .3) block(x + .1 * Math.sin(y), y + .15, z, .26, .285, .26, y % .6 < .3 ? '#a57243' : '#bb8b50');
    block(x, h + base, z, .58, .44, .58, '#739332');
    for (let j = 0; j < 7; j++) {
      const angle = j / 7 * Math.PI * 2 + .15;
      const length = .78 + random() * .4;
      for (let k = 0; k < 4; k++) {
        const r = (k + .4) * length / 3;
        block(x + Math.cos(angle) * r, base + h + .25 - k * k * .065, z + Math.sin(angle) * r, .38, .24, .38, ['#a7c744', '#c3d951', '#88b23d', '#cbdc63'][(j + k) % 4]);
      }
    }
    block(x + .12, h - .14 + base, z + .2, .23, .24, .23, '#906735');
  }
  function bush(x, z, size = .7, flowers = false, y = .1) {
    entity(flowers ? '花坛' : '绿篱', x, z);
    box(x, y, z, size, .38, size, '#287555', .26);
    for (let i = 0; i < 14; i++) {
      const px = x + (random() - .5) * size, pz = z + (random() - .5) * size;
      block(px, y + .43+random()*.15, pz, .16, .13, .16, flowers ? ['#f04ca3', '#ff9ab7', '#fff0ce', '#f6bd37'][i % 4] : ['#4d9e68','#73b886','#378958'][i%3]);
    }
  }
  function planter(x, z, flowers = true) {
    entity('花盆', x, z); box(x, .1, z, .7, .48, .7, '#b87949', .23);
    bush(x, z, .7, flowers, .57);
  }
  function windows(x, z, w, h, d, floors, color = P.glass, y0 = .35) {
    const count = Math.max(2, Math.floor(w / 1.0));
    for (let f = 0; f < floors; f++) {
      const y = y0 + .7 + f * (h - .5) / floors;
      for (let i = 0; i < count; i++) {
        const xx = x - w / 2 + (i + .5) * w / count;
        for (const side of [-1, 1]) {
          block(xx, y, z + side * (d / 2 + .018), .64, .88, .1, P.trim);
          block(xx, y + .015, z + side * (d / 2 + .08), .48, .64, .055, color);
          block(xx, y + .015, z + side * (d / 2 + .117), .035, .69, .02, '#dfeaf0');
          block(xx, y + .015, z + side * (d / 2 + .121), .5, .035, .02, '#e6eef2');
        }
      }
      for (let i = 0; i < Math.floor(d / 1.1); i++) for (const side of [-1, 1]) {
        const zz = z - d / 2 + (i + .5) * d / Math.floor(d / 1.1);
        block(x + side * (w / 2 + .016), y, zz, .1, .88, .64, P.trim);
        block(x + side * (w / 2 + .073), y, zz, .06, .64, .48, color);
      }
    }
  }
  function pool(x, z, w = 2.1, d = 1.3, y = .1) {
    entity('泳池', x, z);
    box(x, y, z, w + .35, .23, d + .35, '#fff6db', .3);
    box(x, y + .23, z, w, .1, d, '#29c9e0', .29);
    for (let i = 0; i < 7; i++) block(x + (random() - .5) * w * .8, y + .34, z + (random() - .5) * d * .8, .24, .012, .09, '#b6f7f5');
    for (let i = -1; i <= 1; i += 2) { block(x + w / 2 + .49, y + .25, z + i * .4, .32, .14, .68, '#fff9df'); block(x + w / 2 + .49, y + .42, z + i * .4 - .25, .32, .38, .16, '#f8f0d7'); }
  }
  function house(x, z, color, roof = P.orange, w = 3.0, d = 2.7, h = 2.35) {
    entity('Beverly Hills · 彩色别墅', x, z);
    box(x, .1, z, w + .38, .24, d + .38, P.trim, .34);
    box(x, .34, z, w, h, d, color, .32, true);
    windows(x, z, w, h, d, 2, '#447ba5', .35);
    // A stepped tile roof, with individual ridges and clay color variation.
    for (let row = 0; row < 6; row++) {
      const rw = w + .55 - row * (w + .4) / 7;
      box(x, h + .34 + row * .18, z, rw, .18, d + .45, row % 2 ? roof : roof, .3, true);
    }
    box(x + w * .25, h + .5, z - .65, .4, 1.2, .42, '#e3c7b5', .2);
    box(x, .34, z + d / 2 + .16, .5, 1.1, .2, '#f8efd7', .24);
    block(x, .86, z + d / 2 + .29, .4, .96, .04, '#487e83');
    box(x, 1.52, z + d / 2 + .41, 1.08, .16, .7, P.trim, .25);
    for (const s of [-1, 1]) box(x + s * .46, .3, z + d / 2 + .62, .12, 1.2, .12, '#fff6e1', .2);
    // Quoins, roof tiles, gutters, porch balustrades and white garden fences.
    for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2])box(x+dx,.34,z+dz,.15,h,.15,P.trim,.15);
    for(let xx=x-w/2;xx<=x+w/2;xx+=.3)for(const side of [-1,1])block(xx,h+.35,z+side*(d/2+.2),.13,.14,.13,'#f6c495');
    for(let xx=x-w/2-.25;xx<=x+w/2+.3;xx+=.28){if(Math.abs(xx-x)<.48)continue;box(xx,.13,z+d/2+2.2,.075,.66,.1,P.trim,.15);}
    for(const side of [-1,1])block(x+side*(w/4+.26),.57,z+d/2+2.2,w/2-.45,.07,.1,'#fff4de');
    pool(x + .15, z + d / 2 + 1.45, Math.min(w - .1, 2.6), 1.13);
    for (const s of [-1, 1]) { palm(x + s * (w / 2 + .62), z + .65, 2.7 + random()); bush(x + s * (w / 2 + .5), z - 1, .65, true); }
  }
  function shop(x, z, w, d, h, name, color = P.cream, awning = '#df6255') {
    entity(name, x, z); box(x, .1, z, w + .3, .2, d + .3, P.trim, .35);
    box(x, .3, z, w, h, d, color, .34, true);
    box(x, h + .28, z, w + .35, .22, d + .3, P.trim, .34, true);
    box(x, h + .5, z, w, .3, d, '#d3c29c', .35, true);
    for (const sx of [-1, 1]) {
      block(x + sx * w * .28, 1.1, z + d / 2 + .04, w * .25, 1.6, .12, '#344b4c');
      box(x + sx * w * .43, .3, z + d / 2 + .13, .24, h, .26, P.trim, .25);
      const ax = x + sx * w * .28;
      for (let i = 0; i < 6; i++) block(ax - w * .16 + i * w * .064, 1.9, z + d / 2 + .43, w * .064, .14, .85, i % 2 ? '#fff3d9' : awning);
    }
    label(name, x, h - .25, z + d / 2 + .095, w * .83, .7, name==='ALFRED COFFEE'?'#fff6db':'#493c2c', color);
    for (let i = 0; i < 2; i++) box(x - w * .25 + i * w * .5, h + .65, z, .55, .3, .62, '#b3b6aa', .24);
  }
  function tower(x, z, w, d, h, color, type = 'grid') {
    entity('Downtown LA · 高层建筑', x, z);
    box(x, .1, z, w + .65, .4, d + .5, P.cream, .38);
    const step = .36, nx = Math.round(w / step), nz = Math.round(d / step), ny = Math.round(h / step);
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
      if (ix && ix < nx - 1 && iz && iz < nz - 1 && iy < ny - 1) continue;
      let c = color;
      if (type === 'glass') c = iy % 3 === 0 ? '#a5dcf1' : ((ix + iz) % 4 === 0 ? '#398ad1' : color);
      else if (iy % 3 !== 0 && ((iz === 0 || iz === nz - 1) ? ix % 3 !== 0 : iz % 3 !== 0)) c = '#5182a2';
      block(x - w / 2 + (ix + .5) * w / nx, .5 + (iy + .5) * h / ny, z - d / 2 + (iz + .5) * d / nz, w / nx * .977, h / ny * .977, d / nz * .977, c);
    }
    box(x, h + .5, z, w + .15, .2, d + .15, '#f0efdc', .35, true);
    box(x, h + .7, z, w * .64, .3, d * .6, '#bdc9c8', .3, true);
    box(x + .25, h + 1, z - .15, .5, .26, .6, '#81999d', .25);
    palm(x - w / 2 - .45, z + d / 2 + .35, 2.5); palm(x + w / 2 + .45, z + d / 2 + .3, 2.7);
  }
  function glassTower(x,z,r,h){
    entity('Downtown LA · 圆弧玻璃塔',x,z);box(x,.1,z,r*2+.45,.34,r*2+.45,P.trim,.32);
    for(let y=.5;y<h;y+=.17)for(let a=0;a<Math.PI*2;a+=.15){const xx=Math.round(Math.cos(a)*r/.16)*.16,zz=Math.round(Math.sin(a)*r/.16)*.16;block(x+xx,y,z+zz,.16,.165,.16,Math.floor(y/.17)%5===0?'#bde5f0':(Math.floor(a/.15)%6===0?'#4486bb':'#3e9ddd'));}
    for(let yy=0;yy<3;yy++)box(x,h+yy*.17,z,r*2-yy*.28,.17,r*2-yy*.28,'#e8f2ea',.17,true);
    box(x,h+.5,z,.62,.25,.74,'#8ca8b3',.17);
  }
  function car(x, z, color = '#df4433', angle = 0) {
    entity('车辆', x, z); const start = blocks.length;
    box(x, .29, z, 1.38, .39, .72, color, .22);
    box(x - .04, .68, z, .71, .35, .66, color, .21);
    for (const s of [-1, 1]) {
      block(x, .82, z + s * .343, .62, .24, .05, '#254954');
      for (const a of [-1, 1]) {block(x + a * .44, .27, z + s * .36, .29, .3, .17, '#2c3535');block(x + a * .44, .28, z + s * .452, .12, .13, .025, '#bec8c9');}
      block(x + .695, .53, z + s * .24, .06, .12, .2, '#fff3cd');
    }
    block(x + .35, .8, z, .12, .25, .61, '#75b5c7');
    for (let i = start; i < blocks.length; i++) { const b = blocks[i], dx = b.x - x, dz = b.z - z; b.x = x + dx * Math.cos(angle) - dz * Math.sin(angle); b.z = z + dx * Math.sin(angle) + dz * Math.cos(angle); b.rotation = angle; }
  }
  function road(x1, z1, x2, z2, width = 2.8, y = .035, elevated = false) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), a = -Math.atan2(dz, dx);
    block((x1 + x2) / 2, y, (z1 + z2) / 2, len + .05, .09, width, P.road, true, a);
    for (const side of [-1, 1]) block((x1 + x2) / 2 + dz / len * side * (width / 2 + .12), y + .03, (z1 + z2) / 2 - dx / len * side * (width / 2 + .12), len, elevated ? .18 : .14, .22, '#f5e5c7', true, a);
    for (let l = .7; l < len - .2; l += 1.65) block(x1 + dx * l / len, y + .054, z1 + dz * l / len, .72, .016, .055, '#fff6e7', true, a);
  }
  function curvedRoad(points,width=2.2,y=.043){
    for(let i=0;i<points.length-1;i++){
      const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
      let last=p1;
      for(let n=1;n<=16;n++){const t=n/16,t2=t*t,t3=t2*t;const next=[0,1].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3));
        const dx=next[0]-last[0],dz=next[1]-last[1],length=Math.hypot(dx,dz),angle=-Math.atan2(dz,dx);
        block((next[0]+last[0])/2,y,(next[1]+last[1])/2,length+.065,.1,width,P.road,true,angle);
        for(const side of [-1,1])block((next[0]+last[0])/2+dz/length*side*(width/2+.1),y+.05,(next[1]+last[1])/2-dx/length*side*(width/2+.1),length+.07,.16,.18,'#f4e4c5',true,angle);
        if(n%3!==0)block((next[0]+last[0])/2,y+.057,(next[1]+last[1])/2,length,.014,.055,'#fff7e1',true,angle);
        last=next;
      }
    }
  }
  function plaza(x,z,r){
    for(let xx=-r;xx<=r;xx+=.32)for(let zz=-r;zz<=r;zz+=.32)if(xx*xx+zz*zz<r*r)block(x+xx,.114,z+zz,.315,.14,.315,(Math.round((xx+zz)/.32)%4===0)?'#dbc9a7':'#edddbc',true);
    for(let a=0;a<Math.PI*2;a+=.09)block(x+Math.cos(a)*r,.21,z+Math.sin(a)*r,.24,.28,.24,P.trim,true);
  }
  function fountain(x, z, radius = 1.1) {
    entity('喷泉', x, z);
    for (let a = 0; a < Math.PI * 2; a += .23) {block(x + Math.cos(a) * radius, .3, z + Math.sin(a) * radius, .28, .38, .28, P.cream);block(x + Math.cos(a) * radius * .7, .22, z + Math.sin(a) * radius * .7, .34, .15, .34, P.pool);}
    box(x, .2, z, .43, 1.2, .43, '#f9eac6', .22);
    for (let a = 0; a < 6; a++) block(x + Math.cos(a) * .4, .8, z + Math.sin(a) * .4, .35, .16, .35, P.cream);
    block(x, 1.65, z, .14, .76, .14, '#a2e6ed');
  }
  function streetSign(x, z, title, w = 2.5) {
    entity(title, x, z); for (const side of [-1, 1]) box(x + side * w * .37, .1, z, .12, 2.3, .12, '#71817a', .2);
    box(x, 2.3, z, w, .7, .15, '#2b684c', .24);
    label(title, x, 2.65, z + .085, w - .12, .54, '#fffce6', '#2b684c');
  }
  function bench(x, z) { entity('街边长椅', x, z); for (const s of [-1, 1]) block(x + s * .37, .26, z, .12, .47, .42, '#434c3e'); for (let i = 0; i < 3; i++) block(x, .48, z + i * .13, 1.02, .08, .1, '#b98041'); block(x, .76, z - .06, 1.05, .42, .1, '#ae793e'); }
  function umbrella(x, z, color, y = .1) {entity('露台遮阳伞', x, z);block(x,y+.9,z,.065,1.8,.065,'#d7c29b');for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++){if(Math.abs(i)+Math.abs(j)>3)continue;block(x+i*.25,y+1.9-(Math.abs(i)+Math.abs(j))*.075,z+j*.25,.25,.1,.25,(i+j)%2===0?color:'#fff6e4');}}
  // A complete city on a thick, layered sandstone display island.
  block(0,-3.05,-1,61.4,1.25,57.8,'#a9895a',true);
  block(0,-2.21,-1,60.7,.55,57.1,'#d4b884',true);
  block(0,-1.48,-1,60.1,.91,56.5,'#e6cda1',true);
  block(0,-.82,-1,59.4,.39,55.8,'#c8ae80',true);
  block(0,-.43,-1,59.7,.39,56.1,'#fff0cf',true);
  block(0,-.15,-1,58.5,.18,54.9,'#d5c49c',true);
  for(let x=-29;x<=29;x+=1.4)block(x,-2.16,27.59,.035,1.47,.035,'#ba9c6b',true);
  label('L O S   A N G E L E S',0,-1.61,27.58,8.3,.78,'#f7edcc','#997747',true);
  block(0, -.045, 0, 56, .08, 51, P.walk, true);
  road(0, 24, 0, -17, 4.05);
  for (const z of [16,-3.5,-10.7]) road(-27,z,27,z,2.3);
  for(const side of [-1,1]){
    curvedRoad([[0,12.8],[side*3.0,8.4],[side*4.1,3.2],[side*3.6,-.6],[side*6.5,-3.5]],2.45);
    curvedRoad([[side*4.3,8],[side*12.1,6.7],[side*20.5,7.2],[side*27,8.5]],2.1);
    curvedRoad([[side*21.2,26],[side*21,17],[side*20.4,8.4],[side*21.3,1],[side*21,-11]],1.9);
    curvedRoad([[side*12.1,25],[side*12.4,19],[side*11.8,13],[side*12.7,6.8],[side*12,-10]],1.8);
  }
  plaza(0,12.1,2.15);plaza(0,1.2,2.38);plaza(0,20.4,2.86);plaza(0,-7.1,1.15);
  for (const z of [15.6, 7, -3.5]) for (const x of [-1.7, 1.7]) for (let i = 0; i < 5; i++) block(x, .101, z - .62 + i * .28, .6, .017, .14, '#fff8e5', true);
  // Hollywood's terraced hills, with warmer exposed sandstone faces.
  for (let ix = -29; ix <= 29; ix++) for (let iz = 0; iz < 17; iz++) {
    const x = ix * .84, z = -13.3 - iz * .75;
    const hill = Math.max(0, 4.3 * Math.exp(-(((x + 1) / 13) ** 2) - ((z + 21) / 9) ** 2) + 1.6 * Math.exp(-(((x - 20) / 6) ** 2)) - .6 + random() * .6);
    const h = Math.round(hill / .55) * .55;
    if (h > 0) {
      entity('草地与山坡',x,z);
      for(let yy=.25;yy<=h;yy+=.5)earthBlock(x,yy,z,.835,.49,.746,random()<.32?'#dbb966':'#7f9649');
      earthBlock(x,h+.12,z,.82,.25,.73,['#84a754','#96b665','#a9c578','#718f43'][Math.floor(random()*4)]);
      if(random()<.27 && Math.abs(x)>5){entity('山坡灌木',x,z);for(let n=0;n<3;n++)block(x+(random()-.5)*.5,h+.4+random()*.25,z+(random()-.5)*.45,.27,.28,.28,['#448b60','#67a571','#9db85c'][n]);}
    }
  }
  // Curved freeway, built as short bridge spans behind Downtown.
  for (let side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const x1 = side * (8 + i * 3.2), x2 = side * (8 + (i+1)*3.2), z1 = -10.8 - Math.sin(i*.35)*2.4, z2 = -10.8 - Math.sin((i+1)*.35)*2.4;
    road(x1,z1,x2,z2,1.9,1.3,true);block(x1, .58, z1, .5, 1.3, .85, '#dfd8c2',true);
  }
  for (const x of [-16, 16]) streetSign(x, -11.3, '101  ·  Downtown LA', 3.4);
  car(-18,-12.6,'#ec4337');car(16,-12.8,'#efbf35');car(-23,-12.8,'#f5efe0');
  // Observatory: three cream pavilions, copper stepped domes, columns, stairs.
  entity('Griffith Observatory',0,-21.2);
  box(0,3.3,-21.2,9.4,.45,4.5,P.trim,.42);
  box(0,3.75,-21.7,7.8,2.1,3.0,P.cream,.35,true);
  box(0,3.75,-19.9,4.8,1.8,1.1,P.trim,.31,true);
  for(let x=-2.0;x<=2.1;x+=.66)box(x,3.9,-19.2,.23,1.8,.28,'#fffae7',.23);
  box(0,3.75,-19.1,.78,1.4,.12,'#77553d',.24);
  for(const [x,r,base] of [[0,1.64,5.7],[-3.3,.88,5.3],[3.3,.88,5.3]]){
    box(x,5.25,-21.7,r*1.8,.85,r*1.8,P.trim,.3,true);
    for(let y=0;y<r;y+=.21){const rr=Math.sqrt(Math.max(.04,r*r-y*y));for(let a=-rr;a<=rr;a+=.23)for(let b=-rr;b<=rr;b+=.23)if(a*a+b*b<=rr*rr&&a*a+b*b>Math.max(0,(rr-.36)**2))block(x+a,base+y,-21.7+b,.233,.215,.233,['#9f5735','#b96c40','#85472f'][Math.floor(y/.21)%3]);}
    block(x,base+r,-21.7,.45,.18,.45,'#a8643c');
  }
  for(let i=0;i<11;i++)block(0,3.5-i*.26,-18.65+i*.46,3.2,.24,.48,P.trim,true);
  label('GRIFFITH OBSERVATORY',0,5.46,-19.29,3.8,.36,'#876f50','#f7eed4');
  curvedRoad([[-5.2,-20.8],[-5.2,-18.4],[0,-17.5],[5.2,-18.4],[5.2,-20.8]],1.0,3.34);
  entity('天文台白色栏杆',0,-19);
  for(let i=0;i<65;i++){const a=Math.PI*.03+i/64*Math.PI*.94;block(Math.cos(a)*5.7,3.67,-21.1+Math.sin(a)*4.2,.15,.66,.15,'#f9edcf');block(Math.cos(a)*5.7,4.02,-21.1+Math.sin(a)*4.2,.24,.14,.24,'#fff4da');}
  for(const side of [-1,1])for(let i=0;i<4;i++)bush(side*(1.5+i*.68),-18.1,.48,true,3.55);
  // HOLLYWOOD is actual voxel lettering, standing on the hillside.
  const font={H:['10001','10001','10001','11111','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],L:['10000','10000','10000','10000','10000','10000','11111'],Y:['10001','10001','01010','00100','00100','00100','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],D:['11110','10001','10001','10001','10001','10001','11110']};
  entity('HOLLYWOOD · 草坡台地',0,-14.7);
  for(let layer=0;layer<7;layer++)earthBlock(0,2.28+layer*.20,-14.7,9.8-layer*.11,.20,2.15-layer*.11,layer%2?'#567b45':'#6c8950');
  earthBlock(0,3.61,-14.7,9.0,.16,1.48,'#2f6845');
  entity('HOLLYWOOD',0,-14.5);
  const letterStep=8.6/53,letterRow=2/7;
  for(let c=0;c<9;c++){
    const rows=font['HOLLYWOOD'[c]];
    for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(rows[y][x]==='1'){
      const xx=-4.3+(c*6+x+.5)*letterStep,yy=3.9+(6-y+.5)*letterRow;
      block(xx,yy,-14.5,letterStep*.99,letterRow*.99,.34,'#c7cdb7');
      block(xx,yy,-14.302,letterStep*.985,letterRow*.985,.055,'#fffef0');
    }
    block(-4.3+(c*6+2.5)*letterStep,3.78,-14.55,.085,.32,.12,'#a0b29a');
  }
  for(let i=0;i<30;i++){const x=-24+random()*48,z=-15-random()*10; if(Math.abs(x)<5)continue;palm(x,z,2.2+random(), Math.max(.4,3.5*Math.exp(-(((x+1)/14)**2)-((z+21)/10)**2)));}
  // A small distant skyline, kept behind the playable city.
  for(let i=0;i<19;i++){const x=-28+i*.91,h=1.4+random()*4;block(x,h/2+.3,-25-random()*2,.6+random()*.65,h,.8,'#86b5cd',true);for(let y=1;y<h;y+=.7)block(x,y,-24.5,.66,.12,.06,'#b6d8df',true);}
  // Downtown cluster flanking the open city axis.
  glassTower(-5.7,-9.1,1.02,7.3);
  tower(-8.4,-7.9,2.3,2.35,5.2,'#ded0b2');
  glassTower(5.75,-9,1.0,6.7);
  tower(8.5,-7.9,2.2,2.3,5.7,'#dde1d6');
  tower(-4.4,-5.4,2.1,1.7,2.4,'#cbd5c6');
  tower(4.7,-5.5,2.2,1.8,4.15,'#b96940');
  fountain(0,-7.1,.8);
  // Studio district with a water tower and film cameras.
  shop(-16.4,-6.5,5.2,3.4,2.8,'SUNSET STUDIOS','#e8c685','#282c2c');
  shop(-23.8,-6.5,3.1,3.0,3.4,'STAGE 7','#f5d78e','#e6cb88');
  entity('影棚水塔',-16.5,-6.5);
  for(const x of [-1,1])for(const z of [-1,1])box(-16.4+x*.53,3.1,-6.5+z*.5,.14,1.5,.14,'#77593a',.2);
  box(-16.4,4.5,-6.5,1.5,1.15,1.45,'#d8af62',.25,true);
  box(-16.4,5.65,-6.5,1.6,.18,1.5,'#f0d095',.25);
  function filmCamera(x,z){entity('电影摄影机',x,z);for(let a=0;a<3;a++){const theta=a/3*Math.PI*2;for(let j=0;j<6;j++)block(x+Math.cos(theta)*(.6-j*.085),.15+j*.2,z+Math.sin(theta)*(.6-j*.085),.13,.23,.13,'#333a35');}box(x,1.25,z,.86,.5,.48,'#343b36',.2);for(const s of [-1,1])ellipsoid(x+s*.28,1.94,z,.34,.34,.19,'#252e2c',.15);block(x,1.5,z+.43,.42,.35,.38,'#252e2b');for(const s of [-1,1])block(x+s*.28,1.94,z+.2,.14,.14,.045,'#9eaa9d');}
  filmCamera(-5.8,-.8);filmCamera(5.8,-.8);
  // Tennis club and shopping district.
  shop(16.3,-6.0,5.3,3.5,2.6,'LOS ANGELES CLUB','#e3c993','#cf7044');
  entity('屋顶网球场',16.3,-6);box(16.3,3.16,-6,4.7,.15,2.8,'#2f9981',.33);
  for(const sx of [-1,1])block(16.3+sx*2.1,3.25,-6,.045,.018,2.4,'#f9efca');for(const zz of [-1,0,1])block(16.3,3.26,-6+zz*1.2,4.22,.018,.045,'#f9efca');block(16.3,3.5,-6,.04,.55,2.6,'#dce8cf');
  for(const xx of [-2.55,2.55])for(let z=-7.6;z<-4.3;z+=.34)block(16.3+xx,3.45,z,.09,.64,.09,'#d4c596');
  shop(23.7,-5.7,3.2,3.0,2.7,'HOLLYWOOD','#f2ead7','#57a4ba');
  shop(16.2,2.05,5.1,3.7,3.65,'THE GROVE','#f0d4a1','#dc6352');
  windows(16.2,2.05,5.1,1.3,3.7,1,'#528185',2.4);
  fountain(16.2,5.45,.86);
  for(const x of [13.5,18.9]){palm(x,3.7,3.9);planter(x,5.5);}
  shop(24,2.3,3.3,3.4,2.7,'MELROSE FLOWERS','#e7c999','#f6ead1');
  for(let i=0;i<3;i++){umbrella(22.6+i*1.2,5.3,'#e9d6b3');bench(22.6+i*1.2,5.8);}
  // Beverly Hills hotel, with green sign and a roof garden.
  shop(-16.7,2.2,5.2,3.4,3.1,'BEVERLY HILLS HOTEL','#eca4b9','#db7ba8');
  entity('Beverly Hills Hotel',-16.7,2.2);box(-16.7,1.3,4.0,2.3,2.7,.19,'#356e51',.29);label('The Beverly Hills Hotel',-16.7,2.7,4.11,2.12,2.4,'#fff6df','#356e51');
  pool(-16.4,5.2,3.6,1.1);for(const x of [-18.4,-15,-14.6])bush(x,2.2,.8,true,3.75);
  house(-24,2.1,'#f2edda','#b9c9c6',3.3,3,2.1);
  // Foreground villas. Layout leaves a clear route through the center.
  house(-16.2,10.3,P.pink,P.orange,3.0,2.8);
  house(-7.6,10.3,'#f3adbb','#e7773e',3.4,2.6);
  house(7.6,10.3,'#9399d1','#6b65a8',3.3,2.7,2.7);
  house(16.4,10.3,'#ecc579','#cf7638',3.0,2.6);
  house(24.1,10.3,P.mint,'#829d79',3.2,2.6);
  house(-7.8,19.3,P.pink,'#d96e37',3.4,2.5,2.3);
  house(7.7,19.3,P.mint,'#637c6b',3.2,2.8,2.2);
  house(16.5,19.1,'#f5c75e','#d57036',3.3,2.7,2.3);
  shop(-24,19.8,3.3,3.6,3.1,'CHANEL','#f4e5c6','#dfd1b0');
  shop(-16.4,19.8,3.6,3.6,2.9,'GUCCI','#f2e0b9','#f3dfb7');
  shop(24,19.8,3.3,3.7,2.8,'ALFRED COFFEE','#354640','#ede5d0');
  landmark('rounded_boutique',7.9,2.7);
  landmark('beverly_shield',-5.8,8.5);
  landmark('rodeo_gateway',-21,21.2);
  landmark('luggage_trolley',3.9,13.8);
  landmark('gold_sunglasses',3.7,17.6);
  landmark('pink_swim_ring',-3.9,22.5);
  fountain(-20,23.1,.9);
  // A fully sculpted voxel character based on the supplied frontal reference.
  entity('自由女神雕像底座',0,12.1);
  box(0,.1,12.1,2.9,.35,2.5,'#ccc9bc',.31);box(0,.45,12.1,2.6,.5,2.2,'#f3e4cb',.28);box(0,.95,12.1,2.4,.27,2.1,'#aab9bc',.25);
  landmark('liberty_mascot',0,12.1,1.22);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;bush(Math.cos(a)*1.65,12.1+Math.sin(a)*1.6,.45,true);}
  landmark('grand_fountain',0,1.2,.1);
  // The starting plaza and its circular flower border.
  for(let i=0;i<42;i++){const a=i/42*Math.PI*2;block(Math.cos(a)*2.8,.14,20.4+Math.sin(a)*2.8,.45,.26,.45,'#f4e4bf',true);if(i%3===0)bush(Math.cos(a)*2.46,20.4+Math.sin(a)*2.46,.46,true);}
  // Street life: cameras, luggage, drinks, surfboards and benches.
  for(let side of [-1,1])for(let z=-1;z<22;z+=4.15){palm(side*3.07,z,2.8+random()*.9);if(z>7)bench(side*3.6,z+1.6);}
  for(let x=-25;x<=25;x+=3.9)for(const z of [-2.05,14.55]){if(Math.abs(x)<4||Math.abs(x-12)<1.5||Math.abs(x+12)<1.5)continue;palm(x,z,2.8+random());}
  for(const [x,z] of [[-10.3,21.6],[10.1,22.2],[-10.2,12.5],[10.3,12.5],[-19.6,9],[20,9],[20.1,22.8],[-5.1,18.8],[5.1,18.8]])planter(x,z);
  for(const [x,z,c,a] of [[-7,16,'#ed4639',0],[11,7,'#f0c331',0],[-9,-3.5,'#ea6041',0],[.9,8.3,'#f14638',Math.PI/2],[-21,11,'#2e72c8',Math.PI/2],[22,23,'#e64b3a',0],[12,19,'#f2e8cf',Math.PI/2],[-12,4,'#f0e9d6',Math.PI/2],[21,-1,'#f6d34a',Math.PI/2]])car(x,z,c,a);
  streetSign(-10.5,17.3,'SUNSET BLVD',3.0);streetSign(11.1,16.8,'MELROSE AVE',3);streetSign(19.6,23.3,'LA BREA AVE',3);
  plaza(-5.8,8.5,1.5);
  entity('彩色行李箱',3.9,17.0);for(let j=0;j<3;j++){box(3.9+j*.6,.13,17+j*.42,.48,.66+j*.17,.42,['#f5c741','#df6896','#5081c6'][j],.2);block(3.9+j*.6,.88+j*.17,17+j*.42,.25,.22,.1,'#835f3d');}
  for(let i=0;i<3;i++){entity('冲浪板',-4.6-i*.45,23.1);box(-4.6-i*.45,.2,23.1,.33,1.76-i*.1,.2,['#e886ae','#70c4d1','#f2db94'][i],.19);block(-4.6-i*.45,2.01-i*.1,23.1,.19,.25,.2,['#e886ae','#70c4d1','#f2db94'][i]);}
  for(const [x,z] of [[-3.4,18],[3.3,22.3],[3.7,20.2]]){entity('相机',x,z);box(x,.16,z,.73,.5,.42,'#41433a',.19);box(x,.34,z+.29,.3,.29,.23,'#242e2c',.15);block(x-.2,.76,z,.25,.17,.3,'#41463d');}
  for(const [x,z] of [[-3.3,22.5],[-3.6,20.1],[3.5,18.8]]){entity('礼物',x,z);box(x,.1,z,.56,.6,.57,'#ee9668',.19);box(x,.1,z+.296,.09,.61,.06,'#fff3d6',.1);block(x,.74,z,.64,.12,.63,'#f3d8aa');}
  // Low garden borders add depth without blocking the city's roads.
  for(let x=-25;x<26;x+=1.1)for(const z of [8.55,17.5]){if(Math.abs(x)<4.5||Math.abs(x-12.1)<1.4||Math.abs(x+12.1)<1.4||Math.abs(x-21)<1.4||Math.abs(x+21)<1.4)continue;bush(x,z,.7,false);}
  // Sidewalk pavers, flower ribbons and garden boundaries follow individual lots.
  for(const [cx,cz,w,d] of [[-16.2,10.3,5.9,6.2],[-7.6,10.3,5.5,6.2],[7.6,10.3,5.5,6.2],[16.4,10.3,5.9,6.2],[-7.8,19.3,5.7,6.0],[7.7,19.3,5.5,6.2],[16.5,19.1,5.9,6.2]]){
    for(const side of [-1,1])for(let zz=-d/2;zz<d/2;zz+=.34){block(cx+side*w/2,.1,cz+zz,.31,.11,.325,'#cfbd98',true);if(Math.floor((zz+d)*3)%3===0)bush(cx+side*(w/2-.28),cz+zz,.4,Math.floor(zz*3)%2===0);}
    for(let xx=-w/2;xx<w/2;xx+=.42)block(cx+xx,.1,cz+d/2+.17,.408,.11,.34,'#ead9b7',true);
  }
  // Low, white flat-roof villas distinguish the western residential area.
  for(const [x,z] of [[-25.3,-1.3],[-25.2,14.3]]){
    entity('白色庭院别墅',x,z);box(x,.1,z,3.7,.28,2.25,P.trim,.3);box(x,.38,z,3.3,1.9,1.9,'#f5efd9',.29,true);
    for(const dx of [-1.27,0,1.27]){box(x+dx,.45,z+1,.17,1.8,.2,P.trim,.17);block(x+dx*.69,1.37,z+.97,.65,1.1,.1,'#58a0b6');}
    box(x,2.28,z,3.7,.2,2.3,'#fff6e2',.2,true);box(x,2.48,z,3.4,.16,2.0,'#c8d6ca',.2,true);
  }
  // Hollywood hillside villa, turquoise terrace and striped radio tower.
  block(21.4,1.1,-21.9,5.45,2.2,3.95,'#cfb56d',true);
  entity('Hollywood Hills · 山顶别墅',21.4,-21.9);
  box(21.4,2.1,-21.9,5.5,.35,4.0,P.trim,.34);
  box(21.4,2.45,-22.2,4.6,1.65,2.1,P.cream,.29,true);
  for(let x=19.5;x<23.6;x+=.7){block(x,3.1,-21.06,.43,1.1,.09,'#6baab8');box(x-.27,2.46,-20.97,.16,1.65,.22,P.trim,.16);}
  box(21.4,4.1,-22.2,5,.22,2.5,'#fff8e3',.3,true);label('HOLLYWOOD',21.4,4.54,-21.1,4.2,.6,'#566f74','#fcf4db');
  pool(22.2,-19.1,3.0,1.2,2.45);for(const x of [18.8,24.1])palm(x,-20.4,2.7,2.2);
  curvedRoad([[25.5,-15],[23.4,-16.6],[19.3,-17.2],[18.4,-20.6],[20,-23.9]],.95,2.12);
  entity('Hollywood Hills · 无线电塔',16.8,-23.7);
  box(16.8,.8,-23.7,1.3,1.2,1.3,'#d7c086',.26,true);
  for(let y=0;y<5.8;y+=.18){const span=.8*(1-y/6.5);for(const side of [-1,1])for(const back of [-1,1])block(16.8+side*span/2,2+y,-23.7+back*span/2,.08,.18,.08,Math.floor(y/.5)%2?'#f1f4df':'#d85745');if(Math.floor(y/.18)%4===0){block(16.8,2+y,-23.7,span,.07,.07,'#edf4df');block(16.8,2+y,-23.7,.07,.07,span,'#d65b47');}}
  block(16.8,8.2,-23.7,.08,1.05,.08,'#f6f4e7');
  streetSign(17.3,-15.9,'Griffith Park · Trails',3.0);
  // Studio equipment, production trucks and the original clapboard prop.
  entity('影棚场记板',-12.7,-.2);box(-12.7,.18,-.2,.94,.8,.17,'#292e2c',.16);for(let i=0;i<7;i++)block(-13.1+i*.13,1.04,-.2,.125,.18,.17,i%2?'#fff4d8':'#333732');label('SCENE 07',-12.7,.66,-.102,.75,.36,'#fff1d5','#282c29');
  for(const [x,z] of [[-19.7,-3.6],[-22.7,-3.6]]){entity('电影制作车辆',x,z);box(x,.32,z,2.3,1.12,.92,'#eee6d5',.23,true);block(x+.83,.98,z+.47,.56,.5,.06,'#517b8d');for(const dx of [-.76,.76])for(const side of [-1,1])block(x+dx,.31,z+side*.48,.4,.4,.18,'#303b39');box(x+.2,1.45,z,.63,.14,.69,'#fff4d9',.2);}
  // Tennis mesh and rooftop umbrellas.
  entity('网球场围网',16.3,-6);
  for(const side of [-1,1]){for(let xx=13.9;xx<18.8;xx+=.2)block(xx,3.64,-6+side*1.48,.027,.72,.027,'#657e58');for(let yy=3.35;yy<4.0;yy+=.17)block(16.3,yy,-6+side*1.48,4.85,.023,.027,'#92a778');}
  umbrella(18.3,-5.25,'#49b9c7',3.0);
  // Outdoor cafe terraces around the Grove and Alfred.
  for(const [x,z] of [[14.4,5.3],[17.8,5.25],[23,22.8],[25,22.8],[7.3,5.4],[9,5.5]]){
    entity('露天咖啡座',x,z);box(x,.2,z,.12,.56,.12,'#a57a44',.12);box(x,.73,z,.63,.1,.63,'#fff1cc',.2);for(const s of [-1,1]){box(x+s*.5,.25,z,.32,.32,.32,'#a77a4a',.16);box(x+s*.5,.57,z-.1,.34,.39,.075,'#e2b672',.16);}
  }
  umbrella(23,22.8,'#efe0bd');umbrella(25,22.8,'#efe0bd');
  // A freestanding LA LIVE billboard with its own plinth and frame.
  entity('LA LIVE 海报',4.65,9.4);box(4.65,.12,9.4,1,.22,.55,'#c1b493',.2);box(4.65,.34,9.4,.64,2.0,.2,'#324159',.17);label('LA LIVE',4.65,1.98,9.52,.59,.37,'#fff8e6','#273296');
  for(let y=.55;y<1.7;y+=.14)for(let x=4.42;x<4.91;x+=.12)block(x,y,9.515,.12,.14,.035,(y>1.2)?'#614cdf':x<4.7?'#794bec':'#bf72dc');
  // The mural is built from colored blocks, with a separate typographic layer.
  entity('Los Angeles 壁画',26.35,19.6);
  for(let xx=25.75;xx<27.7;xx+=.15)for(let yy=.3;yy<3.4;yy+=.15){const sun=(xx-26.7)**2+(yy-2.45)**2<.64;block(xx,yy,19.8,.15,.15,.09,sun?'#f3ba43':yy<.9?'#eb6d9d':'#3f9dcd');}
  label('Los Angeles',26.72,1.4,19.86,1.66,.7,'#fff3df','#418bc7');
  // A large drink cup is one of the first satisfying small-object targets.
  entity('加州冰饮',-3.2,16.7);for(let y=.2;y<1.2;y+=.14){const r=.26+(y-.2)*.09;for(let a=0;a<Math.PI*2;a+=.4)block(-3.2+Math.cos(a)*r,y,16.7+Math.sin(a)*r,.14,.14,.14,y<.5?'#e96549':'#fff1d4');}box(-3.2,1.22,16.7,.74,.1,.72,'#fff5dc',.15);box(-3.1,1.32,16.7,.08,.75,.08,'#6cbfba',.1);
  // Fill the open lots with independently consumable lawn tiles; keep every paved footprint clear.
  const lawnStep=.42,columns=Math.floor(56/lawnStep),rows=Math.floor(51/lawnStep),occupied=new Uint8Array(columns*rows);
  function reserveGround(b){
    const co=Math.cos(b.rotation||0),si=Math.sin(b.rotation||0),hw=b.sx/2+.18,hd=b.sz/2+.18;
    const ex=Math.abs(co)*hw+Math.abs(si)*hd,ez=Math.abs(si)*hw+Math.abs(co)*hd;
    const minX=Math.max(0,Math.floor((b.x-ex+28)/lawnStep)),maxX=Math.min(columns-1,Math.ceil((b.x+ex+28)/lawnStep));
    const minZ=Math.max(0,Math.floor((b.z-ez+25.5)/lawnStep)),maxZ=Math.min(rows-1,Math.ceil((b.z+ez+25.5)/lawnStep));
    for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++){
      const dx=-28+(ix+.5)*lawnStep-b.x,dz=-25.5+(iz+.5)*lawnStep-b.z;
      if(Math.abs(dx*co-dz*si)<hw&&Math.abs(dx*si+dz*co)<hd)occupied[iz*columns+ix]=1;
    }
  }
  for(const b of terrain)if(b.y+b.sy/2>.06)reserveGround(b);
  for(const b of blocks)if(b.y-b.sy/2<.48)reserveGround(b);
  for(let pz=0;pz<rows;pz+=5)for(let px=0;px<columns;px+=5){
    let opened=false;
    for(let iz=pz;iz<Math.min(rows,pz+5);iz++)for(let ix=px;ix<Math.min(columns,px+5);ix++){
      if(occupied[iz*columns+ix])continue;
      const x=-28+(ix+.5)*lawnStep,z=-25.5+(iz+.5)*lawnStep;
      if(!opened){entity('城市草坪',x,z);opened=true;}
      earthBlock(x,.022,z,.417,.052,.417,['#4d9c32','#509f34','#4b9931'][(ix*7+iz*11)%3]);
    }
  }
  return { blocks, terrain, signs, entities, palette: P };
}
