/**
 * Collider Component
 * Wrapper for physics body integration with Cannon-es.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { Component } from './Component';
import type { Entity } from '../entities/Entity';
import type { PhysicsWorld } from '../physics/PhysicsWorld';

/**
 * Collider shape types.
 */
export type ColliderShape = 'box' | 'sphere' | 'capsule' | 'cylinder';

/**
 * Options for creating a collider.
 */
export interface ColliderOptions {
  /** Shape type */
  shape: ColliderShape;

  /** Size (interpretation depends on shape) */
  size?: THREE.Vector3;

  /** Radius for sphere/capsule/cylinder */
  radius?: number;

  /** Height for capsule/cylinder */
  height?: number;

  /** Mass (0 = static) */
  mass?: number;

  /** Physics material name */
  material?: string;

  /** Whether to sync position from physics to mesh */
  syncToMesh?: boolean;

  /** Collision group (for filtering) */
  collisionGroup?: number;

  /** Collision mask (what to collide with) */
  collisionMask?: number;

  /** Offset from entity position */
  offset?: THREE.Vector3;

  /** Is this a trigger (no physical response) */
  isTrigger?: boolean;
}

/**
 * Component that adds physics collision to an entity.
 * Integrates with PhysicsWorld for Cannon-es physics.
 *
 * @example
 * ```typescript
 * const collider = new ColliderComponent(physicsWorld, {
 *   shape: 'box',
 *   size: new THREE.Vector3(1, 2, 1),
 *   mass: 1,
 * });
 *
 * entity.addComponent('collider', collider);
 *
 * // Apply force
 * collider.applyImpulse(new THREE.Vector3(0, 10, 0));
 * ```
 */
export class ColliderComponent implements Component {
  entity!: Entity;

  /** The Cannon-es physics body */
  public body: CANNON.Body;

  /** Reference to the physics world */
  private physicsWorld: PhysicsWorld;

  /** Whether to sync body position to entity */
  private syncToMesh: boolean;

  /** Offset from entity position */
  private offset: THREE.Vector3;

  /** Collision callbacks */
  public onCollisionEnter?: (other: CANNON.Body) => void;
  public onCollisionExit?: (other: CANNON.Body) => void;

  // Track collisions for enter/exit detection
  private activeCollisions: Set<CANNON.Body> = new Set();

  // Pre-allocated temps (unused, for future use)
  // private _tempVec = new THREE.Vector3();

  constructor(physicsWorld: PhysicsWorld, options: ColliderOptions) {
    this.physicsWorld = physicsWorld;
    this.syncToMesh = options.syncToMesh ?? true;
    this.offset = options.offset?.clone() ?? new THREE.Vector3();

    // Create shape based on type
    const shape = this.createShape(options);

    // Create body
    this.body = new CANNON.Body({
      mass: options.mass ?? 1,
      shape,
      collisionFilterGroup: options.collisionGroup,
      collisionFilterMask: options.collisionMask,
      isTrigger: options.isTrigger ?? false,
    });

    // Apply material if specified
    if (options.material) {
      const mat = physicsWorld.getMaterial(options.material);
      if (mat) {
        this.body.material = mat;
      }
    }

    // Setup collision events
    this.body.addEventListener('collide', this.handleCollision.bind(this));
  }

  /**
   * Create Cannon shape from options.
   */
  private createShape(options: ColliderOptions): CANNON.Shape {
    switch (options.shape) {
      case 'box': {
        const size = options.size ?? new THREE.Vector3(1, 1, 1);
        return new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
      }

      case 'sphere': {
        return new CANNON.Sphere(options.radius ?? 0.5);
      }

      case 'capsule': {
        // Cannon-es doesn't have native capsule, use cylinder + spheres
        const radius = options.radius ?? 0.5;
        const height = options.height ?? 1;

        // For simplicity, use a cylinder (or implement compound shape)
        return new CANNON.Cylinder(radius, radius, height, 8);
      }

      case 'cylinder': {
        const radius = options.radius ?? 0.5;
        const height = options.height ?? 1;
        return new CANNON.Cylinder(radius, radius, height, 16);
      }

      default:
        throw new Error(`Unknown collider shape: ${options.shape}`);
    }
  }

  /**
   * Handle collision events.
   */
  private handleCollision(event: { body: CANNON.Body }): void {
    const otherBody = event.body;

    if (!this.activeCollisions.has(otherBody)) {
      this.activeCollisions.add(otherBody);
      this.onCollisionEnter?.(otherBody);
    }
  }

  /**
   * Called when added to entity.
   */
  onAttach(): void {
    // Set initial position from entity
    const pos = this.entity.object3D.position;
    this.body.position.set(
      pos.x + this.offset.x,
      pos.y + this.offset.y,
      pos.z + this.offset.z
    );

    // Set initial rotation
    const quat = this.entity.object3D.quaternion;
    this.body.quaternion.set(quat.x, quat.y, quat.z, quat.w);

    // Add to physics world
    this.physicsWorld.world.addBody(this.body);
  }

  /**
   * Update: sync physics body position to entity.
   */
  update(_deltaTime: number): void {
    if (this.syncToMesh) {
      // Sync position
      this.entity.object3D.position.set(
        this.body.position.x - this.offset.x,
        this.body.position.y - this.offset.y,
        this.body.position.z - this.offset.z
      );

      // Sync rotation
      this.entity.object3D.quaternion.set(
        this.body.quaternion.x,
        this.body.quaternion.y,
        this.body.quaternion.z,
        this.body.quaternion.w
      );
    }

    // Check for collision exits
    for (const body of this.activeCollisions) {
      // Simple check: if bodies are far apart, consider collision ended
      const dist = this.body.position.distanceTo(body.position);
      if (dist > 5) { // Threshold
        this.activeCollisions.delete(body);
        this.onCollisionExit?.(body);
      }
    }
  }

  /**
   * Apply an impulse (instant force).
   */
  applyImpulse(impulse: THREE.Vector3, worldPoint?: THREE.Vector3): void {
    const cannonImpulse = new CANNON.Vec3(impulse.x, impulse.y, impulse.z);
    const point = worldPoint
      ? new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z)
      : this.body.position;

    this.body.applyImpulse(cannonImpulse, point);
  }

  /**
   * Apply a force (continuous, use in update loop).
   */
  applyForce(force: THREE.Vector3, worldPoint?: THREE.Vector3): void {
    const cannonForce = new CANNON.Vec3(force.x, force.y, force.z);
    const point = worldPoint
      ? new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z)
      : this.body.position;

    this.body.applyForce(cannonForce, point);
  }

  /**
   * Set velocity directly.
   */
  setVelocity(velocity: THREE.Vector3): void {
    this.body.velocity.set(velocity.x, velocity.y, velocity.z);
  }

  /**
   * Get current velocity.
   */
  getVelocity(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return target.set(
      this.body.velocity.x,
      this.body.velocity.y,
      this.body.velocity.z
    );
  }

  /**
   * Set position directly (teleport).
   */
  setPosition(position: THREE.Vector3): void {
    this.body.position.set(
      position.x + this.offset.x,
      position.y + this.offset.y,
      position.z + this.offset.z
    );
    this.body.velocity.setZero();
    this.body.angularVelocity.setZero();
  }

  /**
   * Set whether body is kinematic (moved by code, not physics).
   */
  setKinematic(kinematic: boolean): void {
    this.body.type = kinematic ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC;
  }

  /**
   * Freeze rotation on specific axes.
   */
  freezeRotation(x = true, y = true, z = true): void {
    this.body.angularFactor.set(
      x ? 0 : 1,
      y ? 0 : 1,
      z ? 0 : 1
    );
  }

  /**
   * Wake up sleeping body.
   */
  wakeUp(): void {
    this.body.wakeUp();
  }

  /**
   * Put body to sleep.
   */
  sleep(): void {
    this.body.sleep();
  }

  /**
   * Dispose: remove from physics world.
   */
  dispose(): void {
    this.physicsWorld.world.removeBody(this.body);
    this.activeCollisions.clear();
  }
}
