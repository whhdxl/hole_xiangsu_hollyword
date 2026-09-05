export const CAMERA_FOV = 35;
export const CAMERA_PITCH = 35.5 * Math.PI / 180;
export const CAMERA_SPANS = [18, 21, 25, 30, 36, 42, 48, 56, 67];

// The hole sits at 72% of screen height, with space to see the next target.
export function followPose(x, z, span) {
  const tan = Math.tan(CAMERA_FOV * Math.PI / 360);
  const distance = span / (2 * tan);
  const forward = .44 * distance * tan / (Math.sin(CAMERA_PITCH) + .44 * Math.cos(CAMERA_PITCH) * tan);
  const target = [x, 0, z - forward];
  return {target,position:[x,Math.sin(CAMERA_PITCH)*distance,target[2]+Math.cos(CAMERA_PITCH)*distance]};
}
