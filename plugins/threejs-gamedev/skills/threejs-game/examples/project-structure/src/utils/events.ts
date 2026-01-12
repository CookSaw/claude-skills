/**
 * Event System
 * Type-safe event emitter for decoupled communication.
 */

/**
 * Callback type for event listeners
 */
export type EventCallback<T = unknown> = (data: T) => void;

/**
 * Type-safe event emitter.
 *
 * @example
 * ```typescript
 * // Define event types
 * interface GameEvents {
 *   'player:death': { playerId: string; position: THREE.Vector3 };
 *   'enemy:spawn': { enemyType: string };
 *   'score:change': number;
 * }
 *
 * const events = new EventEmitter<GameEvents>();
 *
 * // Subscribe (type-safe!)
 * events.on('player:death', (data) => {
 *   console.log(data.playerId); // TypeScript knows this is string
 * });
 *
 * // Emit (type-safe!)
 * events.emit('player:death', { playerId: 'p1', position: new THREE.Vector3() });
 * ```
 */
export class EventEmitter<
  Events extends Record<string, unknown> = Record<string, unknown> & { [key: string]: unknown }
> {
  private listeners: Map<keyof Events, Set<EventCallback<any>>> = new Map();

  /**
   * Subscribe to an event.
   * @returns Unsubscribe function
   */
  on<K extends keyof Events>(
    event: K,
    callback: EventCallback<Events[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   */
  off<K extends keyof Events>(
    event: K,
    callback: EventCallback<Events[K]>
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit an event to all listeners.
   */
  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${String(event)}":`, error);
        }
      }
    }
  }

  /**
   * Subscribe to an event for a single emission.
   * Automatically unsubscribes after first call.
   */
  once<K extends keyof Events>(
    event: K,
    callback: EventCallback<Events[K]>
  ): () => void {
    const wrapper = (data: Events[K]) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Check if event has any listeners.
   */
  hasListeners<K extends keyof Events>(event: K): boolean {
    const callbacks = this.listeners.get(event);
    return callbacks !== undefined && callbacks.size > 0;
  }

  /**
   * Get listener count for an event.
   */
  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Remove all listeners for a specific event.
   */
  removeAllListeners<K extends keyof Events>(event: K): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners for all events.
   */
  clear(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// Global Game Events
// ============================================================================

/**
 * Common game event types.
 * Extend this interface in your game for type safety.
 */
export interface GameEventTypes {
  // Game state
  'game:start': void;
  'game:pause': void;
  'game:resume': void;
  'game:over': { score: number };

  // Player events
  'player:spawn': { id: string };
  'player:death': { id: string };
  'player:damage': { id: string; amount: number; remaining: number };

  // Scene events
  'scene:change': { from: string; to: string };
  'scene:loaded': { name: string };

  // Generic
  [key: string]: unknown;
}

/**
 * Global game event bus.
 * Use for cross-system communication.
 *
 * @example
 * ```typescript
 * // In player health system
 * gameEvents.emit('player:death', { id: 'player1' });
 *
 * // In UI system
 * gameEvents.on('player:death', (data) => {
 *   showGameOverScreen();
 * });
 * ```
 */
export const gameEvents = new EventEmitter<GameEventTypes>();
