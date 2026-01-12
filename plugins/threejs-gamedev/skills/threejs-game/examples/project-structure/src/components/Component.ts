/**
 * Base Component Interface
 * All game components implement this interface for the ECS pattern.
 */

import type { Entity } from '../entities/Entity';

/**
 * Component interface for the Entity-Component-System pattern.
 * Components are pure data + behavior that can be attached to entities.
 */
export interface Component {
  /**
   * Reference to the entity this component is attached to.
   * Set automatically when added to an entity via Entity.addComponent()
   */
  entity: Entity;

  /**
   * Called every frame with delta time in seconds.
   * Implement to add per-frame behavior.
   */
  update?(deltaTime: number): void;

  /**
   * Called when the component is removed or entity is disposed.
   * Implement to clean up resources (geometries, materials, event listeners, etc.)
   */
  dispose?(): void;

  /**
   * Called after the component is added to an entity.
   * Useful for initialization that requires access to the entity.
   */
  onAttach?(): void;

  /**
   * Called before the component is removed from an entity.
   * Useful for cleanup that requires access to the entity.
   */
  onDetach?(): void;
}
