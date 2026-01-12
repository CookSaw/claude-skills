/**
 * HealthComponent Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { HealthComponent } from '../../components/HealthComponent';

describe('HealthComponent', () => {
  describe('initialization', () => {
    it('should initialize with max health', () => {
      const health = new HealthComponent(100);
      expect(health.currentHealth).toBe(100);
      expect(health.maxHealth).toBe(100);
    });

    it('should allow starting at 0 health', () => {
      const health = new HealthComponent(100, false);
      expect(health.currentHealth).toBe(0);
      expect(health.maxHealth).toBe(100);
    });
  });

  describe('takeDamage', () => {
    it('should reduce health correctly', () => {
      const health = new HealthComponent(100);
      health.takeDamage(30);
      expect(health.currentHealth).toBe(70);
    });

    it('should not go below zero', () => {
      const health = new HealthComponent(50);
      health.takeDamage(100);
      expect(health.currentHealth).toBe(0);
    });

    it('should return actual damage taken', () => {
      const health = new HealthComponent(30);
      const damage = health.takeDamage(50);
      expect(damage).toBe(30); // Only 30 health available
    });

    it('should trigger onDamage callback', () => {
      const onDamage = vi.fn();
      const health = new HealthComponent(100);
      health.onDamage = onDamage;

      health.takeDamage(25);
      expect(onDamage).toHaveBeenCalledWith(25, undefined);
    });

    it('should trigger onDeath callback when health reaches 0', () => {
      const onDeath = vi.fn();
      const health = new HealthComponent(50);
      health.onDeath = onDeath;

      health.takeDamage(50);
      expect(onDeath).toHaveBeenCalled();
    });

    it('should not take damage when invulnerable', () => {
      const health = new HealthComponent(100);
      health.invulnerable = true;

      const damage = health.takeDamage(50);
      expect(damage).toBe(0);
      expect(health.currentHealth).toBe(100);
    });

    it('should trigger onHealthChange callback', () => {
      const onChange = vi.fn();
      const health = new HealthComponent(100);
      health.onHealthChange = onChange;

      health.takeDamage(20);
      expect(onChange).toHaveBeenCalledWith(80, 100);
    });
  });

  describe('heal', () => {
    it('should increase health correctly', () => {
      const health = new HealthComponent(100);
      health.takeDamage(50);
      health.heal(20);
      expect(health.currentHealth).toBe(70);
    });

    it('should not exceed max health', () => {
      const health = new HealthComponent(100);
      health.takeDamage(20);
      health.heal(50);
      expect(health.currentHealth).toBe(100);
    });

    it('should return actual amount healed', () => {
      const health = new HealthComponent(100);
      health.takeDamage(10);
      const healed = health.heal(50);
      expect(healed).toBe(10); // Only 10 HP was missing
    });

    it('should not heal when dead', () => {
      const health = new HealthComponent(100);
      health.kill();
      const healed = health.heal(50);
      expect(healed).toBe(0);
      expect(health.currentHealth).toBe(0);
    });

    it('should trigger onHeal callback', () => {
      const onHeal = vi.fn();
      const health = new HealthComponent(100);
      health.onHeal = onHeal;
      health.takeDamage(50);

      health.heal(20);
      expect(onHeal).toHaveBeenCalledWith(20);
    });
  });

  describe('state checks', () => {
    it('should correctly report isDead', () => {
      const health = new HealthComponent(100);
      expect(health.isDead()).toBe(false);

      health.takeDamage(100);
      expect(health.isDead()).toBe(true);
    });

    it('should correctly report isAlive', () => {
      const health = new HealthComponent(100);
      expect(health.isAlive()).toBe(true);

      health.takeDamage(100);
      expect(health.isAlive()).toBe(false);
    });

    it('should correctly calculate health percent', () => {
      const health = new HealthComponent(100);
      expect(health.getHealthPercent()).toBe(1);

      health.takeDamage(25);
      expect(health.getHealthPercent()).toBe(0.75);

      health.takeDamage(75);
      expect(health.getHealthPercent()).toBe(0);
    });

    it('should correctly report isFullHealth', () => {
      const health = new HealthComponent(100);
      expect(health.isFullHealth()).toBe(true);

      health.takeDamage(1);
      expect(health.isFullHealth()).toBe(false);

      health.heal(1);
      expect(health.isFullHealth()).toBe(true);
    });

    it('should correctly report isLowHealth', () => {
      const health = new HealthComponent(100);
      expect(health.isLowHealth()).toBe(false); // Default threshold 25%

      health.takeDamage(80);
      expect(health.isLowHealth()).toBe(true);
    });
  });

  describe('special actions', () => {
    it('should kill instantly', () => {
      const onDeath = vi.fn();
      const health = new HealthComponent(100);
      health.onDeath = onDeath;

      health.kill();
      expect(health.currentHealth).toBe(0);
      expect(onDeath).toHaveBeenCalled();
    });

    it('should fullHeal to max', () => {
      const health = new HealthComponent(100);
      health.takeDamage(80);

      health.fullHeal();
      expect(health.currentHealth).toBe(100);
    });

    it('should revive from death', () => {
      const health = new HealthComponent(100);
      health.kill();

      health.revive(0.5);
      expect(health.currentHealth).toBe(50);
    });

    it('should handle invulnerability timer', () => {
      const health = new HealthComponent(100);
      health.makeInvulnerable(1);

      expect(health.invulnerable).toBe(true);
      expect(health.invulnerabilityTime).toBe(1);

      // Simulate time passing
      health.update(0.5);
      expect(health.invulnerable).toBe(true);

      health.update(0.6);
      expect(health.invulnerable).toBe(false);
    });
  });

  describe('setMaxHealth', () => {
    it('should update max health', () => {
      const health = new HealthComponent(100);
      health.setMaxHealth(150);
      expect(health.maxHealth).toBe(150);
    });

    it('should optionally heal to new max', () => {
      const health = new HealthComponent(100);
      health.takeDamage(50);
      health.setMaxHealth(200, true);
      expect(health.currentHealth).toBe(200);
    });

    it('should clamp current health to new max', () => {
      const health = new HealthComponent(100);
      health.setMaxHealth(50);
      expect(health.currentHealth).toBe(50);
    });
  });
});
