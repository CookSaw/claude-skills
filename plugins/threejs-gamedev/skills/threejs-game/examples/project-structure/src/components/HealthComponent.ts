/**
 * Health Component
 * Adds health, damage, and healing to an entity.
 */

import type { Component } from './Component';
import type { Entity } from '../entities/Entity';
import { clamp } from '../utils/math';

/**
 * Component that manages entity health.
 *
 * @example
 * ```typescript
 * const health = new HealthComponent(100);
 * health.onDeath = () => entity.dispose();
 * health.onDamage = (amount) => playSound('hit');
 *
 * entity.addComponent('health', health);
 *
 * // Take damage
 * health.takeDamage(25);
 *
 * // Heal
 * health.heal(10);
 * ```
 */
export class HealthComponent implements Component {
  entity!: Entity;

  /** Maximum health value */
  public maxHealth: number;

  /** Current health value */
  public currentHealth: number;

  /** Whether entity is invulnerable */
  public invulnerable = false;

  /** Invulnerability timer (seconds remaining) */
  public invulnerabilityTime = 0;

  // Callbacks
  /** Called when health reaches zero */
  public onDeath?: () => void;

  /** Called when taking damage (receives amount) */
  public onDamage?: (amount: number, source?: Entity) => void;

  /** Called when healing (receives amount) */
  public onHeal?: (amount: number) => void;

  /** Called when health changes (receives new health value) */
  public onHealthChange?: (health: number, maxHealth: number) => void;

  /**
   * @param maxHealth - Maximum health value
   * @param startFull - Whether to start at full health (default: true)
   */
  constructor(maxHealth: number, startFull = true) {
    this.maxHealth = maxHealth;
    this.currentHealth = startFull ? maxHealth : 0;
  }

  /**
   * Update invulnerability timer.
   */
  update(deltaTime: number): void {
    if (this.invulnerabilityTime > 0) {
      this.invulnerabilityTime -= deltaTime;
      if (this.invulnerabilityTime <= 0) {
        this.invulnerabilityTime = 0;
        this.invulnerable = false;
      }
    }
  }

  /**
   * Take damage.
   * @param amount - Damage amount
   * @param source - Optional source entity
   * @returns Actual damage taken (may be 0 if invulnerable)
   */
  takeDamage(amount: number, source?: Entity): number {
    if (this.invulnerable || this.isDead()) {
      return 0;
    }

    const actualDamage = Math.min(amount, this.currentHealth);
    this.currentHealth = Math.max(0, this.currentHealth - amount);

    this.onDamage?.(actualDamage, source);
    this.onHealthChange?.(this.currentHealth, this.maxHealth);

    if (this.isDead()) {
      this.onDeath?.();
    }

    return actualDamage;
  }

  /**
   * Heal health.
   * @param amount - Heal amount
   * @returns Actual amount healed
   */
  heal(amount: number): number {
    if (this.isDead()) {
      return 0;
    }

    const previousHealth = this.currentHealth;
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    const actualHeal = this.currentHealth - previousHealth;

    if (actualHeal > 0) {
      this.onHeal?.(actualHeal);
      this.onHealthChange?.(this.currentHealth, this.maxHealth);
    }

    return actualHeal;
  }

  /**
   * Set health directly.
   */
  setHealth(value: number): void {
    const wasDead = this.isDead();
    this.currentHealth = clamp(value, 0, this.maxHealth);
    this.onHealthChange?.(this.currentHealth, this.maxHealth);

    if (!wasDead && this.isDead()) {
      this.onDeath?.();
    }
  }

  /**
   * Set max health (optionally heal to new max).
   */
  setMaxHealth(value: number, healToMax = false): void {
    this.maxHealth = Math.max(1, value);
    if (healToMax) {
      this.currentHealth = this.maxHealth;
    } else {
      this.currentHealth = Math.min(this.currentHealth, this.maxHealth);
    }
    this.onHealthChange?.(this.currentHealth, this.maxHealth);
  }

  /**
   * Restore to full health.
   */
  fullHeal(): void {
    this.setHealth(this.maxHealth);
  }

  /**
   * Kill instantly.
   */
  kill(): void {
    if (!this.isDead()) {
      this.currentHealth = 0;
      this.onHealthChange?.(0, this.maxHealth);
      this.onDeath?.();
    }
  }

  /**
   * Revive from death.
   * @param healthPercent - Health to restore (0-1), default 1 (full)
   */
  revive(healthPercent = 1): void {
    if (this.isDead()) {
      this.currentHealth = Math.floor(this.maxHealth * clamp(healthPercent, 0, 1));
      this.onHealthChange?.(this.currentHealth, this.maxHealth);
    }
  }

  /**
   * Make invulnerable for a duration.
   * @param duration - Duration in seconds
   */
  makeInvulnerable(duration: number): void {
    this.invulnerable = true;
    this.invulnerabilityTime = duration;
  }

  /**
   * Check if dead (health <= 0).
   */
  isDead(): boolean {
    return this.currentHealth <= 0;
  }

  /**
   * Check if alive (health > 0).
   */
  isAlive(): boolean {
    return this.currentHealth > 0;
  }

  /**
   * Get health as percentage (0-1).
   */
  getHealthPercent(): number {
    return this.currentHealth / this.maxHealth;
  }

  /**
   * Get missing health amount.
   */
  getMissingHealth(): number {
    return this.maxHealth - this.currentHealth;
  }

  /**
   * Check if at full health.
   */
  isFullHealth(): boolean {
    return this.currentHealth >= this.maxHealth;
  }

  /**
   * Check if health is below a threshold.
   */
  isLowHealth(threshold = 0.25): boolean {
    return this.getHealthPercent() <= threshold;
  }
}
