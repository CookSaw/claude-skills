/**
 * Math Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  inverseLerp,
  remap,
  degToRad,
  radToDeg,
  normalizeAngle,
  randomRange,
  randomInt,
  randomElement,
  randomBool,
} from '../../utils/math';

describe('Math Utilities', () => {
  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should return min when value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should return max when value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle equal min and max', () => {
      expect(clamp(5, 5, 5)).toBe(5);
    });
  });

  describe('lerp', () => {
    it('should return a when t is 0', () => {
      expect(lerp(0, 10, 0)).toBe(0);
    });

    it('should return b when t is 1', () => {
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('should return midpoint when t is 0.5', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
    });

    it('should handle negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
    });

    it('should extrapolate when t > 1', () => {
      expect(lerp(0, 10, 2)).toBe(20);
    });
  });

  describe('inverseLerp', () => {
    it('should return 0 when value equals a', () => {
      expect(inverseLerp(0, 10, 0)).toBe(0);
    });

    it('should return 1 when value equals b', () => {
      expect(inverseLerp(0, 10, 10)).toBe(1);
    });

    it('should return 0.5 when value is midpoint', () => {
      expect(inverseLerp(0, 10, 5)).toBe(0.5);
    });

    it('should return 0 when a equals b', () => {
      expect(inverseLerp(5, 5, 5)).toBe(0);
    });
  });

  describe('remap', () => {
    it('should remap value from one range to another', () => {
      expect(remap(5, 0, 10, 0, 100)).toBe(50);
    });

    it('should handle different ranges', () => {
      expect(remap(0, -10, 10, 0, 100)).toBe(50);
    });
  });

  describe('angle conversions', () => {
    it('should convert degrees to radians', () => {
      expect(degToRad(180)).toBeCloseTo(Math.PI);
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
      expect(degToRad(0)).toBe(0);
    });

    it('should convert radians to degrees', () => {
      expect(radToDeg(Math.PI)).toBeCloseTo(180);
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
      expect(radToDeg(0)).toBe(0);
    });

    it('should normalize angles to -PI to PI', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
      expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
    });
  });

  describe('random functions', () => {
    it('should return values within range for randomRange', () => {
      for (let i = 0; i < 100; i++) {
        const value = randomRange(5, 10);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThan(10);
      }
    });

    it('should return integers within range for randomInt', () => {
      for (let i = 0; i < 100; i++) {
        const value = randomInt(1, 5);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should return element from array for randomElement', () => {
      const arr = [1, 2, 3, 4, 5];
      for (let i = 0; i < 50; i++) {
        const value = randomElement(arr);
        expect(arr).toContain(value);
      }
    });

    it('should return undefined for empty array', () => {
      expect(randomElement([])).toBeUndefined();
    });

    it('should return boolean for randomBool', () => {
      const results = new Set<boolean>();
      for (let i = 0; i < 100; i++) {
        results.add(randomBool());
      }
      // With 100 trials, we should see both true and false
      expect(results.size).toBe(2);
    });
  });
});
