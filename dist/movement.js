export const MAP_EDGES = {minX:-28,maxX:28,minZ:-25.5,maxZ:25.5};

export function movementScale(level) {
  return level <= 6 ? .5 : 1;
}

export function movementBounds(radius) {
  // Includes the bright rim, the 11% upgrade overshoot and an extra clear strip.
  const inset = radius * 1.21 + .65;
  return {minX:MAP_EDGES.minX+inset,maxX:MAP_EDGES.maxX-inset,minZ:MAP_EDGES.minZ+inset,maxZ:MAP_EDGES.maxZ-inset};
}

export function clampHolePosition(x,z,radius) {
  const b=movementBounds(radius);
  return {x:Math.max(b.minX,Math.min(b.maxX,x)),z:Math.max(b.minZ,Math.min(b.maxZ,z))};
}

export function moveHole(hole,targetX,targetZ,dt,level) {
  const target=clampHolePosition(targetX,targetZ,hole.radius);
  const dx=target.x-hole.x,dz=target.z-hole.z,distance=Math.hypot(dx,dz),step=Math.min(distance,dt*18*movementScale(level));
  if(distance>.0001){hole.x+=dx/distance*step;hole.z+=dz/distance*step;}
  const position=clampHolePosition(hole.x,hole.z,hole.radius);hole.x=position.x;hole.z=position.z;
  return target;
}
