/**
 * Math Utilities
 * Common math operations for game development.
 * All functions are pure and avoid allocations.
 */

import * as THREE from 'three';

// ============================================================================
// Number Operations
// ============================================================================

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between a and b
 * @param t - Interpolation factor (0-1)
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Inverse linear interpolation - find t given value between a and b
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

/**
 * Remap a value from one range to another
 */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const t = inverseLerp(inMin, inMax, value);
  return lerp(outMin, outMax, t);
}

/**
 * Smoothstep interpolation (ease in-out)
 */
export function smoothstep(a: number, b: number, t: number): number {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Smoother step interpolation (Ken Perlin's version)
 */
export function smootherstep(a: number, b: number, t: number): number {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// ============================================================================
// Angle Operations
// ============================================================================

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Normalize angle to -PI to PI range
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/**
 * Lerp between two angles, handling wrap-around
 */
export function lerpAngle(a: number, b: number, t: number): number {
  let delta = normalizeAngle(b - a);
  return a + delta * t;
}

// ============================================================================
// Random Operations
// ============================================================================

/**
 * Random float between min (inclusive) and max (exclusive)
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Random integer between min (inclusive) and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

/**
 * Random element from array
 */
export function randomElement<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[randomInt(0, array.length - 1)];
}

/**
 * Random boolean with optional probability
 * @param probability - Chance of true (0-1), default 0.5
 */
export function randomBool(probability = 0.5): boolean {
  return Math.random() < probability;
}

// ============================================================================
// Vector Operations (using pre-allocated temps to avoid GC)
// ============================================================================

// Pre-allocated temporary vectors for internal use
const _tempVec3A = new THREE.Vector3();

/**
 * Distance between two Vector3
 */
export function vec3Distance(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.distanceTo(b);
}

/**
 * Squared distance between two Vector3 (faster, no sqrt)
 */
export function vec3DistanceSq(a: THREE.Vector3, b: THREE.Vector3): number {
  return a.distanceToSquared(b);
}

/**
 * Lerp between two vectors, storing result in out
 */
export function vec3Lerp(
  out: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number
): THREE.Vector3 {
  out.x = lerp(a.x, b.x, t);
  out.y = lerp(a.y, b.y, t);
  out.z = lerp(a.z, b.z, t);
  return out;
}

/**
 * Move towards target position at given speed
 */
export function vec3MoveTowards(
  out: THREE.Vector3,
  current: THREE.Vector3,
  target: THREE.Vector3,
  maxDelta: number
): THREE.Vector3 {
  _tempVec3A.copy(target).sub(current);
  const dist = _tempVec3A.length();

  if (dist <= maxDelta || dist === 0) {
    out.copy(target);
  } else {
    out.copy(current).add(_tempVec3A.multiplyScalar(maxDelta / dist));
  }
  return out;
}

/**
 * Damp (smooth) movement towards target
 * Use this for smooth camera following, etc.
 * @param lambda - Smoothing factor (higher = faster)
 * @param deltaTime - Frame delta time
 */
export function vec3Damp(
  out: THREE.Vector3,
  current: THREE.Vector3,
  target: THREE.Vector3,
  lambda: number,
  deltaTime: number
): THREE.Vector3 {
  const t = 1 - Math.exp(-lambda * deltaTime);
  return vec3Lerp(out, current, target, t);
}

// ============================================================================
// Easing Functions
// ============================================================================

export const Easing = {
  linear: (t: number) => t,

  // Quad
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Elastic
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  // Bounce
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
} as const;
