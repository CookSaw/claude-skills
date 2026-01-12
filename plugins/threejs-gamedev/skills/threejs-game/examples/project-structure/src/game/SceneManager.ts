/**
 * Scene Manager
 * Handles scene registration, loading, and transitions.
 */

import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';
import { EventEmitter } from '../utils/events';

/**
 * Interface for game scenes.
 * Implement this to create custom scenes.
 */
export interface GameScene {
  /** Unique scene name */
  readonly name: string;

  /** Three.js scene */
  readonly scene: THREE.Scene;

  /** Camera for this scene */
  readonly camera: THREE.Camera;

  /**
   * Called when scene becomes active.
   * Use for setup, starting animations, etc.
   */
  onEnter(): void | Promise<void>;

  /**
   * Called when scene is about to be deactivated.
   * Use for cleanup, stopping animations, etc.
   */
  onExit(): void | Promise<void>;

  /**
   * Called every frame while scene is active.
   */
  update(deltaTime: number): void;

  /**
   * Called to render the scene.
   * Default implementation provided by BaseScene.
   */
  render(renderer: THREE.WebGLRenderer): void;

  /**
   * Called when window is resized.
   */
  onResize?(width: number, height: number): void;

  /**
   * Called when scene is disposed.
   */
  dispose(): void;
}

/**
 * Events emitted by SceneManager.
 */
export interface SceneManagerEvents extends Record<string, unknown> {
  'scene:loading': { name: string };
  'scene:loaded': { name: string };
  'scene:change': { from: string | null; to: string };
}

/**
 * Manages game scenes and transitions between them.
 *
 * @example
 * ```typescript
 * const sceneManager = new SceneManager(renderer);
 *
 * sceneManager.register(new MenuScene());
 * sceneManager.register(new GameScene());
 *
 * await sceneManager.load('menu');
 *
 * // In game loop
 * sceneManager.update(deltaTime);
 * sceneManager.render();
 * ```
 */
export class SceneManager {
  /** Event emitter for scene events */
  public readonly events = new EventEmitter<SceneManagerEvents>();

  private renderer: Renderer;
  private scenes: Map<string, GameScene> = new Map();
  private currentScene: GameScene | null = null;
  private isTransitioning = false;

  constructor(renderer: Renderer) {
    this.renderer = renderer;

    // Handle resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  /**
   * Register a scene.
   */
  register(scene: GameScene): void {
    if (this.scenes.has(scene.name)) {
      console.warn(`SceneManager: Overwriting existing scene "${scene.name}"`);
    }
    this.scenes.set(scene.name, scene);
  }

  /**
   * Unregister a scene.
   */
  unregister(name: string): void {
    const scene = this.scenes.get(name);
    if (scene) {
      if (this.currentScene === scene) {
        console.warn(`SceneManager: Cannot unregister active scene "${name}"`);
        return;
      }
      scene.dispose();
      this.scenes.delete(name);
    }
  }

  /**
   * Load and activate a scene.
   */
  async load(name: string): Promise<void> {
    if (this.isTransitioning) {
      console.warn(`SceneManager: Already transitioning, ignoring load("${name}")`);
      return;
    }

    const newScene = this.scenes.get(name);
    if (!newScene) {
      console.error(`SceneManager: Scene "${name}" not found`);
      return;
    }

    this.isTransitioning = true;
    this.events.emit('scene:loading', { name });

    const previousName = this.currentScene?.name ?? null;

    // Exit current scene
    if (this.currentScene) {
      await this.currentScene.onExit();
    }

    // Enter new scene
    this.currentScene = newScene;
    await this.currentScene.onEnter();

    // Trigger resize to ensure proper camera aspect
    this.handleResize();

    this.isTransitioning = false;
    this.events.emit('scene:loaded', { name });
    this.events.emit('scene:change', { from: previousName, to: name });
  }

  /**
   * Get current scene name.
   */
  getCurrentSceneName(): string | null {
    return this.currentScene?.name ?? null;
  }

  /**
   * Get a registered scene by name.
   */
  getScene(name: string): GameScene | undefined {
    return this.scenes.get(name);
  }

  /**
   * Check if a scene is registered.
   */
  hasScene(name: string): boolean {
    return this.scenes.has(name);
  }

  /**
   * Update current scene.
   */
  update(deltaTime: number): void {
    if (!this.isTransitioning && this.currentScene) {
      this.currentScene.update(deltaTime);
    }
  }

  /**
   * Render current scene.
   */
  render(): void {
    if (this.currentScene) {
      const webglRenderer = this.renderer.getRenderer();
      this.currentScene.render(webglRenderer);
    }
  }

  /**
   * Handle window resize.
   */
  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.currentScene?.onResize?.(width, height);
  }

  /**
   * Dispose all scenes and cleanup.
   */
  dispose(): void {
    window.removeEventListener('resize', this.handleResize.bind(this));

    for (const scene of this.scenes.values()) {
      scene.dispose();
    }
    this.scenes.clear();
    this.currentScene = null;
    this.events.clear();
  }
}
