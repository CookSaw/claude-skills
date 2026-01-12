/**
 * Entity Class
 * Container for components in the Entity-Component-System pattern.
 */

import * as THREE from 'three';
import type { Component } from '../components/Component';

/**
 * Entity is a container for components.
 * It provides a Three.js Object3D for scene graph integration.
 *
 * @example
 * ```typescript
 * const player = new Entity('player');
 * player.addComponent('mesh', new MeshComponent(geometry, material));
 * player.addComponent('movement', new MovementComponent());
 * player.addComponent('health', new HealthComponent(100));
 *
 * scene.add(player.object3D);
 *
 * // In game loop
 * player.update(deltaTime);
 *
 * // Access components
 * const health = player.getComponent<HealthComponent>('health');
 * health?.takeDamage(10);
 * ```
 */
export class Entity {
  /** Unique identifier for this entity */
  public readonly id: string;

  /** Three.js container for this entity's visual representation */
  public readonly object3D: THREE.Object3D;

  /** Parent entity (if any) */
  public parent: Entity | null = null;

  /** Whether this entity is active (receives updates) */
  public active = true;

  /** Custom tags for filtering/querying entities */
  public readonly tags: Set<string> = new Set();

  private components: Map<string, Component> = new Map();
  private children: Entity[] = [];

  /**
   * @param id - Optional unique identifier (auto-generated if not provided)
   */
  constructor(id?: string) {
    this.id = id ?? `entity_${Math.random().toString(36).substr(2, 9)}`;
    this.object3D = new THREE.Object3D();
    this.object3D.name = this.id;
  }

  // ===========================================================================
  // Component Management
  // ===========================================================================

  /**
   * Add a component to this entity.
   * @param name - Unique name for the component
   * @param component - The component instance
   * @returns The added component for chaining
   */
  addComponent<T extends Component>(name: string, component: T): T {
    if (this.components.has(name)) {
      console.warn(`Entity "${this.id}": Replacing existing component "${name}"`);
      this.removeComponent(name);
    }

    component.entity = this;
    this.components.set(name, component);
    component.onAttach?.();

    return component;
  }

  /**
   * Get a component by name.
   * @returns The component or undefined if not found
   */
  getComponent<T extends Component>(name: string): T | undefined {
    return this.components.get(name) as T | undefined;
  }

  /**
   * Check if entity has a component.
   */
  hasComponent(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Remove a component by name.
   */
  removeComponent(name: string): void {
    const component = this.components.get(name);
    if (component) {
      component.onDetach?.();
      component.dispose?.();
      this.components.delete(name);
    }
  }

  /**
   * Get all component names.
   */
  getComponentNames(): string[] {
    return Array.from(this.components.keys());
  }

  // ===========================================================================
  // Child Entity Management
  // ===========================================================================

  /**
   * Add a child entity.
   * Child entities are updated and disposed with the parent.
   */
  addChild(child: Entity): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }

    child.parent = this;
    this.children.push(child);
    this.object3D.add(child.object3D);
  }

  /**
   * Remove a child entity.
   */
  removeChild(child: Entity): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      this.object3D.remove(child.object3D);
      child.parent = null;
    }
  }

  /**
   * Get all direct children.
   */
  getChildren(): readonly Entity[] {
    return this.children;
  }

  /**
   * Find a child by id (recursive).
   */
  findChild(id: string): Entity | undefined {
    for (const child of this.children) {
      if (child.id === id) return child;
      const found = child.findChild(id);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Find children by tag.
   */
  findByTag(tag: string): Entity[] {
    const results: Entity[] = [];
    if (this.tags.has(tag)) {
      results.push(this);
    }
    for (const child of this.children) {
      results.push(...child.findByTag(tag));
    }
    return results;
  }

  // ===========================================================================
  // Transform Helpers
  // ===========================================================================

  /** Position in world space */
  get position(): THREE.Vector3 {
    return this.object3D.position;
  }

  /** Rotation in world space (Euler angles) */
  get rotation(): THREE.Euler {
    return this.object3D.rotation;
  }

  /** Quaternion rotation */
  get quaternion(): THREE.Quaternion {
    return this.object3D.quaternion;
  }

  /** Scale */
  get scale(): THREE.Vector3 {
    return this.object3D.scale;
  }

  /**
   * Get world position (accounting for parent transforms).
   */
  getWorldPosition(target: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    return this.object3D.getWorldPosition(target);
  }

  /**
   * Look at a target position.
   */
  lookAt(target: THREE.Vector3): void {
    this.object3D.lookAt(target);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Update this entity and all its components and children.
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!this.active) return;

    // Update components
    for (const component of this.components.values()) {
      component.update?.(deltaTime);
    }

    // Update children
    for (const child of this.children) {
      child.update(deltaTime);
    }
  }

  /**
   * Dispose this entity, all components, and all children.
   * Removes from parent and scene.
   */
  dispose(): void {
    // Dispose children first
    for (const child of this.children) {
      child.dispose();
    }
    this.children.length = 0;

    // Dispose components
    for (const component of this.components.values()) {
      component.onDetach?.();
      component.dispose?.();
    }
    this.components.clear();

    // Remove from parent
    if (this.parent) {
      this.parent.removeChild(this);
    }

    // Remove from scene
    this.object3D.parent?.remove(this.object3D);
  }
}
