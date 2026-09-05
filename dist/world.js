// Original voxel geometry. All interactive pieces have independent transforms.
export function createWorld() {
  const blocks = [], terrain = [], signs = [], entities = [];
  let seed = 1742, current = -1;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const P = { cream: '#f5e9c6', trim: '#fff8e3', sand: '#dfc797', road: '#818b90', walk: '#e7d5b1', green: '#7baf27', lime: '#aad039', darkGreen: '#3d762c', trunk: '#976137', blue: '#378bd0', glass: '#559bc3', pool: '#26cfe1', orange: '#d76f39', pink: '#ed9fb0', mint: '#8fceb4', yellow: '#f2c75c', purple: '#a3a0d1' };
  function entity(name, x, z) { current = entities.length; entities.push({ name, x, z, ids: [], released: 0, signIds: [] }); return current; }
  function block(x, y, z, sx, sy, sz, color, fixed = false, rotation = 0) {
    const b = { x, y, z, sx, sy, sz, color, rotation, shade: .93 + random() * .12, entity: current };
    if (fixed) terrain.push(b); else { if (current < 0) entity('街景', x, z); entities[current].ids.push(blocks.length); blocks.push(b); }
  }
  function box(x, y, z, w, h, d, color, step = .32, shell = false, fixed = false) {
    const nx = Math.max(1, Math.round(w / step)), ny = Math.max(1, Math.round(h / step)), nz = Math.max(1, Math.round(d / step));
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
      if (shell && ix > 0 && ix < nx - 1 && iz > 0 && iz < nz - 1 && iy > 0 && iy < ny - 1) continue;
      block(x - w / 2 + (ix + .5) * w / nx, y + (iy + .5) * h / ny, z - d / 2 + (iz + .5) * d / nz, w / nx * .975, h / ny * .975, d / nz * .975, color, fixed);
    }
  }
  function label(text, x, y, z, w, h, fg = '#fff9e5', bg = '#21633c', fixed = false) {
    const i = signs.length; signs.push({ text, x, y, z, w, h, fg, bg, entity: fixed ? -1 : current });
    if (!fixed) entities[current].signIds.push(i);
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
    block(x, h + base, z, .58, .44, .58, '#648d20');
    for (let j = 0; j < 7; j++) {
      const angle = j / 7 * Math.PI * 2 + .15;
      const length = .78 + random() * .4;
      for (let k = 0; k < 4; k++) {
        const r = (k + .4) * length / 3;
        block(x + Math.cos(angle) * r, base + h + .25 - k * k * .065, z + Math.sin(angle) * r, .38, .24, .38, ['#86b922', '#a5ce32', '#6ea222', '#afd535'][(j + k) % 4]);
      }
    }
    block(x + .12, h - .14 + base, z + .2, .23, .24, .23, '#906735');
  }
  function bush(x, z, size = .7, flowers = false, y = .1) {
    entity(flowers ? '花坛' : '绿篱', x, z);
    box(x, y, z, size, .5, size, '#538b37', .26);
    for (let i = 0; i < 6; i++) {
      const px = x + (random() - .5) * size, pz = z + (random() - .5) * size;
      block(px, y + .55, pz, .26, .24, .26, flowers ? ['#f04ca3', '#ff9ab7', '#fff0ce', '#f6bd37'][i % 4] : '#8ebb30');
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
    label(name, x, h - .25, z + d / 2 + .095, w * .83, .7, '#493c2c', color);
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
  // Sandstone city base and the central boulevard.
  block(0, -.6, 0, 58, 1.1, 53, '#d9c59d', true);
  block(0, -.045, 0, 56, .08, 51, P.walk, true);
  road(0, 24, 0, -17, 4.05);
  for (const z of [16, 7.0, -3.5, -10.7]) road(-27, z, 27, z, 2.4);
  for (const x of [-21, -12.1, 12.1, 21]) road(x, -12, x, 24, 2.0);
  for (const z of [15.6, 7, -3.5]) for (const x of [-1.7, 1.7]) for (let i = 0; i < 5; i++) block(x, .101, z - .62 + i * .28, .6, .017, .14, '#fff8e5', true);
  // Hollywood's terraced hills, with warmer exposed sandstone faces.
  for (let ix = -29; ix <= 29; ix++) for (let iz = 0; iz < 17; iz++) {
    const x = ix * .84, z = -13.3 - iz * .75;
    const hill = Math.max(0, 4.3 * Math.exp(-(((x + 1) / 13) ** 2) - ((z + 21) / 9) ** 2) + 1.6 * Math.exp(-(((x - 20) / 6) ** 2)) - .6 + random() * .6);
    const h = Math.round(hill / .55) * .55;
    if (h > 0) { block(x, h / 2, z, .835, h, .746, random() < .24 ? '#c5ad58' : '#91ae30', true); block(x, h + .15, z, .82, .3, .73, ['#83ae29','#9ebc30','#b4ca35','#6b9829'][Math.floor(random()*4)], true); }
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
  // HOLLYWOOD is actual voxel lettering, standing on the hillside.
  const font={H:['10001','10001','10001','11111','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],L:['10000','10000','10000','10000','10000','10000','11111'],Y:['10001','10001','01010','00100','00100','00100','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],D:['11110','10001','10001','10001','10001','10001','11110']};
  entity('HOLLYWOOD',-10,-21);for(let c=0;c<9;c++){const rows=font['HOLLYWOOD'[c]];for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(rows[y][x]==='1')block(-14.9+(c*6+x)*.14,4.2+(6-y)*.17,-20.7,.142,.172,.21,'#fffbe6');}
  for(let i=0;i<30;i++){const x=-24+random()*48,z=-15-random()*10; if(Math.abs(x)<5)continue;palm(x,z,2.2+random(), Math.max(.4,3.5*Math.exp(-(((x+1)/14)**2)-((z+21)/10)**2)));}
  // A small distant skyline, kept behind the playable city.
  for(let i=0;i<22;i++){const x=-30+i*1.25,h=1.4+random()*4;block(x,h/2+.3,-28-random()*3,.6+random()*.65,h,.8,'#86b5cd',true);for(let y=1;y<h;y+=.7)block(x,y,-27.5,.66,.12,.06,'#b6d8df',true);}
  // Downtown cluster flanking the open city axis.
  tower(-4.5,-9.1,2.05,2.1,7.3,'#348dcc','glass');
  tower(-7.5,-7.9,2.3,2.35,5.2,'#ded0b2');
  tower(4.55,-9.0,2.0,2.1,6.7,'#5ca8d3','glass');
  tower(7.6,-7.9,2.2,2.3,5.7,'#dde1d6');
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
  filmCamera(-8.1,.05);filmCamera(7.6,.3);
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
  shop(24,2.3,3.3,3.4,2.7,'ALFRED COFFEE','#384640','#f6ead1');
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
  shop(-16.4,19.8,3.6,3.6,2.9,'RODEO DRIVE','#f2e0b9','#f3dfb7');
  shop(24,19.8,3.3,3.7,2.8,'LOS ANGELES','#6db6ca','#ede5d0');
  fountain(-20,23.1,.9);
  // Purple liberty mascot, created entirely from cubes, facing the player.
  entity('自由女神主题雕塑',0,2.1);
  box(0,.1,2.1,2.5,.35,2.4,'#ccc9bc',.31);box(0,.45,2.1,2.0,.5,1.9,'#f3e4cb',.28);box(0,.95,2.1,1.7,.27,1.6,'#aab9bc',.25);
  ellipsoid(0,2.44,2.1,1.0,1.27,.68,'#8044bd',.23);
  ellipsoid(0,3.74,2.18,1.07,.85,.73,'#9950d0',.23);
  for(const side of [-1,1]){ellipsoid(side*.92,2.65,2.1,.42,.69,.39,'#8741bd',.22);box(side*.44,1.2,2.28,.48,.4,.62,'#9155c8',.22);}
  // Draped turquoise robe as stepped diagonal bands.
  for(let j=0;j<9;j++)for(let i=0;i<8;i++){const x=-.89+i*.235,y=1.63+j*.185+i*.065;if(y<3.5)block(x,y,2.73,.237,.175,.14,(j%3===0)?'#42c89c':'#68d5ae');}
  for(const side of [-1,1]){box(side*.4,3.83,2.85,.46,.3,.1,'#fff7e5',.14);box(side*.39,3.83,2.93,.18,.23,.08,'#2c2047',.09);box(side*.41,4.14,2.92,.51,.12,.12,'#5c289a',.12);}
  box(0,3.36,2.88,.81,.24,.08,'#45205e',.15);for(let i=0;i<4;i++)block(-.3+i*.2,3.4,2.95,.13,.16,.08,'#fff5da');
  for(let i=-4;i<=4;i++){block(i*.22,4.4,2.16,.22,.22,.94,'#53c6af');const spike= .8-Math.abs(i)*.095;for(let j=0;j<4;j++)block(i*.24*(1+j*.12),4.53+j*spike/4,2.15,.14,.21,.2,'#64dbbf');}
  // Raised torch and flame.
  box(-1.12,2.9,2.08,.32,1.48,.34,'#9951cf',.2);box(-1.14,4.26,2.09,.29,.85,.28,'#77d6c0',.18);box(-1.14,5.06,2.09,.59,.22,.55,'#55b99e',.2);ellipsoid(-1.14,5.58,2.09,.3,.45,.28,'#ffbd39',.15);block(-1.14,5.92,2.09,.2,.32,.21,'#ff783e');
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;bush(Math.cos(a)*1.65,2.1+Math.sin(a)*1.6,.45,true);}
  // The starting plaza and its circular flower border.
  for(let i=0;i<42;i++){const a=i/42*Math.PI*2;block(Math.cos(a)*2.8,.14,20.4+Math.sin(a)*2.8,.45,.26,.45,'#f4e4bf',true);if(i%3===0)bush(Math.cos(a)*2.46,20.4+Math.sin(a)*2.46,.46,true);}
  // Street life: cameras, luggage, drinks, surfboards and benches.
  for(let side of [-1,1])for(let z=-1;z<22;z+=4.15){palm(side*3.07,z,2.8+random()*.9);if(z>7)bench(side*3.6,z+1.6);}
  for(let x=-25;x<=25;x+=3.9)for(const z of [-2.05,14.55]){if(Math.abs(x)<4||Math.abs(x-12)<1.5||Math.abs(x+12)<1.5)continue;palm(x,z,2.8+random());}
  for(const [x,z] of [[-10.3,21.6],[10.1,22.2],[-10.2,12.5],[10.3,12.5],[-19.6,9],[20,9],[20.1,22.8],[-5.1,18.8],[5.1,18.8]])planter(x,z);
  for(const [x,z,c,a] of [[-7,16,'#ed4639',0],[11,7,'#f0c331',0],[-9,-3.5,'#ea6041',0],[.9,11,'#f14638',Math.PI/2],[-21,11,'#2e72c8',Math.PI/2],[22,23,'#e64b3a',0],[12,19,'#f2e8cf',Math.PI/2],[-12,4,'#f0e9d6',Math.PI/2],[21,-1,'#f6d34a',Math.PI/2]])car(x,z,c,a);
  streetSign(-10.5,17.3,'SUNSET BLVD',3.0);streetSign(11.1,16.8,'MELROSE AVE',3);streetSign(19.6,23.3,'LA BREA AVE',3);
  streetSign(-5.4,7.5,'BEVERLY HILLS',2.3);
  entity('彩色行李箱',3.9,17.0);for(let j=0;j<3;j++){box(3.9+j*.6,.13,17+j*.42,.48,.66+j*.17,.42,['#f5c741','#df6896','#5081c6'][j],.2);block(3.9+j*.6,.88+j*.17,17+j*.42,.25,.22,.1,'#835f3d');}
  for(let i=0;i<3;i++){entity('冲浪板',-4.6-i*.45,23.1);box(-4.6-i*.45,.2,23.1,.33,1.76-i*.1,.2,['#e886ae','#70c4d1','#f2db94'][i],.19);block(-4.6-i*.45,2.01-i*.1,23.1,.19,.25,.2,['#e886ae','#70c4d1','#f2db94'][i]);}
  for(const [x,z] of [[-3.4,18],[3.3,22.3],[3.7,20.2]]){entity('相机',x,z);box(x,.16,z,.73,.5,.42,'#41433a',.19);box(x,.34,z+.29,.3,.29,.23,'#242e2c',.15);block(x-.2,.76,z,.25,.17,.3,'#41463d');}
  for(const [x,z] of [[-3.3,22.5],[-3.6,20.1],[3.5,18.8]]){entity('礼物',x,z);box(x,.1,z,.56,.6,.57,'#ee9668',.19);box(x,.1,z+.296,.09,.61,.06,'#fff3d6',.1);block(x,.74,z,.64,.12,.63,'#f3d8aa');}
  // Low garden borders add depth without blocking the city's roads.
  for(let x=-25;x<26;x+=1.1)for(const z of [8.55,17.5]){if(Math.abs(x)<4.5||Math.abs(x-12.1)<1.4||Math.abs(x+12.1)<1.4||Math.abs(x-21)<1.4||Math.abs(x+21)<1.4)continue;bush(x,z,.7,false);}
  return { blocks, terrain, signs, entities, palette: P };
}
