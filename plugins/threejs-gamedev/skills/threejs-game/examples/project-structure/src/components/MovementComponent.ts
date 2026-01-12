/**
 * Movement Component
 * Adds velocity-based movement to an entity.
 */

import * as THREE from 'three';
import type { Component } from './Component';
import type { Entity } from '../entities/Entity';

/**
 * Component that adds physics-like movement (velocity, acceleration, friction).
 * Updates entity position each frame based on velocity.
 *
 * @example
 * ```typescript
 * const movement = new MovementComponent();
 * movement.maxSpeed = 10;
 * movement.friction = 0.95;
 *
 * entity.addComponent('movement', movement);
 *
 * // Apply movement
 * movement.addForce(new THREE.Vector3(1, 0, 0));
 *
 * // Or set velocity directly
 * movement.velocity.set(5, 0, 0);
 * ```
 */
export class MovementComponent implements Component {
  entity!: Entity;

  /** Current velocity (units per second) */
  public velocity = new THREE.Vector3();

  /** Current acceleration (units per second squared) */
  public acceleration = new THREE.Vector3();

  /** Friction/drag coefficient (0-1, applied each frame) */
  public friction = 0.98;

  /** Maximum speed (velocity magnitude clamp) */
  public maxSpeed = Infinity;

  /** Whether to apply gravity */
  public useGravity = false;

  /** Gravity strength (units per second squared) */
  public gravity = -9.81;

  /** Whether entity is grounded (for gravity) */
  public isGrounded = false;

  /** Ground Y position for simple ground check */
  public groundY = 0;

  // Pre-allocated temps to avoid GC
  private _tempVec = new THREE.Vector3();
  private _tempAccel = new THREE.Vector3();

  /**
   * Update position based on velocity and acceleration.
   */
  update(deltaTime: number): void {
    // Apply gravity if enabled
    if (this.useGravity && !this.isGrounded) {
      this.acceleration.y += this.gravity;
    }

    // Apply acceleration to velocity
    this._tempAccel.copy(this.acceleration).multiplyScalar(deltaTime);
    this.velocity.add(this._tempAccel);

    // Apply friction
    this.velocity.multiplyScalar(this.friction);

    // Clamp to max speed
    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.multiplyScalar(this.maxSpeed / speed);
    }

    // Apply velocity to position
    this._tempVec.copy(this.velocity).multiplyScalar(deltaTime);
    this.entity.object3D.position.add(this._tempVec);

    // Simple ground check
    if (this.useGravity) {
      if (this.entity.object3D.position.y <= this.groundY) {
        this.entity.object3D.position.y = this.groundY;
        this.velocity.y = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    }

    // Clear acceleration (forces must be re-applied each frame)
    this.acceleration.set(0, 0, 0);
  }

  /**
   * Add a force to acceleration.
   * Forces are cleared after each update, so call every frame.
   */
  addForce(force: THREE.Vector3): void {
    this.acceleration.add(force);
  }

  /**
   * Apply an instant impulse to velocity.
   */
  applyImpulse(impulse: THREE.Vector3): void {
    this.velocity.add(impulse);
  }

  /**
   * Set velocity directly.
   */
  setVelocity(x: number, y: number, z: number): void {
    this.velocity.set(x, y, z);
  }

  /**
   * Move in a direction at given speed.
   * Useful for input-driven movement.
   */
  moveInDirection(direction: THREE.Vector3, speed: number): void {
    this._tempVec.copy(direction).normalize().multiplyScalar(speed);
    this.velocity.x = this._tempVec.x;
    this.velocity.z = this._tempVec.z;
    // Preserve Y velocity for gravity
  }

  /**
   * Stop all movement.
   */
  stop(): void {
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
  }

  /**
   * Jump (if grounded and using gravity).
   */
  jump(force: number): boolean {
    if (this.useGravity && this.isGrounded) {
      this.velocity.y = force;
      this.isGrounded = false;
      return true;
    }
    return false;
  }

  /**
   * Get current speed (velocity magnitude).
   */
  getSpeed(): number {
    return this.velocity.length();
  }

  /**
   * Get horizontal speed (XZ plane).
   */
  getHorizontalSpeed(): number {
    return Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
  }

  /**
   * Check if moving (speed above threshold).
   */
  isMoving(threshold = 0.01): boolean {
    return this.getSpeed() > threshold;
  }
}

/**
 * Options for creating a character-style movement component.
 */
export interface CharacterMovementOptions {
  maxSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  jumpForce?: number;
  gravity?: number;
}

/**
 * Factory for common movement configurations.
 */
export const MovementFactory = {
  /**
   * Create a simple movement component with basic settings.
   */
  simple(maxSpeed = 5, friction = 0.9): MovementComponent {
    const comp = new MovementComponent();
    comp.maxSpeed = maxSpeed;
    comp.friction = friction;
    return comp;
  },

  /**
   * Create a character controller style movement.
   */
  character(options: CharacterMovementOptions = {}): MovementComponent {
    const comp = new MovementComponent();
    comp.maxSpeed = options.maxSpeed ?? 8;
    comp.friction = 0.85;
    comp.useGravity = true;
    comp.gravity = options.gravity ?? -20;
    return comp;
  },

  /**
   * Create a floating/flying movement (no gravity).
   */
  flying(maxSpeed = 10): MovementComponent {
    const comp = new MovementComponent();
    comp.maxSpeed = maxSpeed;
    comp.friction = 0.95;
    comp.useGravity = false;
    return comp;
  },
} as const;
