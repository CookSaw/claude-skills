/**
 * Three.js Scene Manager Example
 *
 * Production-ready scene management with:
 * - Scene registration and switching
 * - Transition effects
 * - Resource cleanup
 * - Event system for scene lifecycle
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

/**
 * Base interface for game scenes
 */
export interface GameScene {
  /** Unique scene identifier */
  readonly name: string;

  /** Three.js scene object */
  readonly scene: THREE.Scene;

  /** Scene camera */
  readonly camera: THREE.Camera;

  /** Called when scene becomes active */
  onEnter(): void | Promise<void>;

  /** Called when scene is about to be deactivated */
  onExit(): void | Promise<void>;

  /** Called every frame when scene is active */
  update(deltaTime: number): void;

  /** Called to render the scene */
  render(renderer: THREE.WebGLRenderer): void;

  /** Called when scene is removed from manager */
  dispose(): void;

  /** Optional: Called when window resizes */
  onResize?(width: number, height: number): void;
}

/**
 * Transition types between scenes
 */
export type TransitionType = 'none' | 'fade' | 'slide';

export interface TransitionOptions {
  type: TransitionType;
  duration: number; // seconds
  color?: THREE.Color;
}

export interface TransitionEventData {
  from: string | null;
  to: string;
}

export interface SceneManagerEvents {
  sceneEnter: string;
  sceneExit: string;
  transitionStart: TransitionEventData;
  transitionEnd: TransitionEventData;
}

// ============================================================================
// Event Emitter
// ============================================================================

type EventCallback<T = any> = (data: T) => void;

class EventEmitter<Events extends Record<string, any>> {
  private events: Map<keyof Events, Set<EventCallback>> = new Map();

  on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  off<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): void {
    this.events.get(event)?.delete(callback);
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    this.events.get(event)?.forEach((callback) => callback(data));
  }

  clear(): void {
    this.events.clear();
  }
}

// ============================================================================
// Scene Manager
// ============================================================================

export class SceneManager extends EventEmitter<SceneManagerEvents> {
  private renderer: THREE.WebGLRenderer;
  private scenes: Map<string, GameScene> = new Map();
  private currentScene: GameScene | null = null;
  private isTransitioning = false;

  // Transition overlay
  private transitionScene: THREE.Scene;
  private transitionCamera: THREE.OrthographicCamera;
  private transitionMesh: THREE.Mesh;
  private transitionMaterial: THREE.MeshBasicMaterial;

  constructor(renderer: THREE.WebGLRenderer) {
    super();
    this.renderer = renderer;
    this.setupTransitionOverlay();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Register a scene with the manager
   */
  registerScene(scene: GameScene): void {
    if (this.scenes.has(scene.name)) {
      console.warn(`Scene "${scene.name}" already registered, replacing`);
      this.scenes.get(scene.name)?.dispose();
    }
    this.scenes.set(scene.name, scene);
  }

  /**
   * Unregister and dispose a scene
   */
  unregisterScene(name: string): void {
    const scene = this.scenes.get(name);
    if (scene) {
      if (this.currentScene === scene) {
        this.currentScene = null;
      }
      scene.dispose();
      this.scenes.delete(name);
    }
  }

  /**
   * Switch to a different scene
   */
  async loadScene(
    name: string,
    transition: TransitionOptions = { type: 'none', duration: 0 }
  ): Promise<void> {
    if (this.isTransitioning) {
      console.warn('Already transitioning, ignoring loadScene call');
      return;
    }

    const newScene = this.scenes.get(name);
    if (!newScene) {
      console.error(`Scene "${name}" not found`);
      return;
    }

    const previousScene = this.currentScene;
    const previousName = previousScene?.name ?? null;

    this.emit('transitionStart', { from: previousName, to: name });

    // Perform transition
    if (transition.type !== 'none' && transition.duration > 0) {
      await this.performTransition(previousScene, newScene, transition);
    } else {
      // Instant switch
      if (previousScene) {
        await previousScene.onExit();
        this.emit('sceneExit', previousName!);
      }

      this.currentScene = newScene;
      await newScene.onEnter();
      this.emit('sceneEnter', name);
    }

    this.emit('transitionEnd', { from: previousName, to: name });
  }

  /**
   * Get the current active scene
   */
  getCurrentScene(): GameScene | null {
    return this.currentScene;
  }

  /**
   * Get a registered scene by name
   */
  getScene(name: string): GameScene | undefined {
    return this.scenes.get(name);
  }

  /**
   * Check if currently transitioning
   */
  getIsTransitioning(): boolean {
    return this.isTransitioning;
  }

  /**
   * Update the current scene
   */
  update(deltaTime: number): void {
    if (!this.isTransitioning && this.currentScene) {
      this.currentScene.update(deltaTime);
    }
  }

  /**
   * Render the current scene
   */
  render(): void {
    if (this.currentScene) {
      this.currentScene.render(this.renderer);
    }
  }

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    this.currentScene?.onResize?.(width, height);
  }

  /**
   * Clean up all scenes
   */
  dispose(): void {
    for (const scene of this.scenes.values()) {
      scene.dispose();
    }
    this.scenes.clear();
    this.currentScene = null;
    this.clear(); // Clear event listeners

    // Dispose transition resources
    this.transitionScene.remove(this.transitionMesh);
    this.transitionMesh.geometry.dispose();
    this.transitionMaterial.dispose();
    this.transitionScene.clear();
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private setupTransitionOverlay(): void {
    this.transitionScene = new THREE.Scene();
    this.transitionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.transitionMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0
    });
    this.transitionMesh = new THREE.Mesh(geometry, this.transitionMaterial);
    this.transitionScene.add(this.transitionMesh);
  }

  private async performTransition(
    from: GameScene | null,
    to: GameScene,
    options: TransitionOptions
  ): Promise<void> {
    this.isTransitioning = true;

    if (options.color) {
      this.transitionMaterial.color.copy(options.color);
    }

    switch (options.type) {
      case 'fade':
        await this.fadeTransition(from, to, options.duration);
        break;
      case 'slide':
        await this.slideTransition(from, to, options.duration);
        break;
      default:
        // Instant
        if (from) await from.onExit();
        this.currentScene = to;
        await to.onEnter();
    }

    this.isTransitioning = false;
  }

  private async fadeTransition(
    from: GameScene | null,
    to: GameScene,
    duration: number
  ): Promise<void> {
    const halfDuration = duration / 2;

    // Fade out
    await this.animateOpacity(0, 1, halfDuration, () => {
      if (from) {
        from.render(this.renderer);
      }
      this.renderer.autoClear = false;
      this.renderer.render(this.transitionScene, this.transitionCamera);
      this.renderer.autoClear = true;
    });

    // Switch scenes
    if (from) {
      await from.onExit();
      this.emit('sceneExit', from.name);
    }

    this.currentScene = to;
    await to.onEnter();
    this.emit('sceneEnter', to.name);

    // Fade in
    await this.animateOpacity(1, 0, halfDuration, () => {
      to.render(this.renderer);
      this.renderer.autoClear = false;
      this.renderer.render(this.transitionScene, this.transitionCamera);
      this.renderer.autoClear = true;
    });
  }

  private async slideTransition(
    from: GameScene | null,
    to: GameScene,
    duration: number
  ): Promise<void> {
    // For slide, we'd need render-to-texture
    // Simplified: just do a fade
    await this.fadeTransition(from, to, duration);
  }

  private animateOpacity(
    startOpacity: number,
    endOpacity: number,
    duration: number,
    renderCallback: () => void
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const durationMs = duration * 1000;

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / durationMs, 1);

        // Ease in-out
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        this.transitionMaterial.opacity =
          startOpacity + (endOpacity - startOpacity) * eased;

        renderCallback();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }
}

// ============================================================================
// Example Scene Implementation
// ============================================================================

/**
 * Base class for game scenes with common functionality
 */
export abstract class BaseScene implements GameScene {
  abstract readonly name: string;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
  }

  abstract onEnter(): void | Promise<void>;
  abstract onExit(): void | Promise<void>;
  abstract update(deltaTime: number): void;

  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    // Override in subclass to dispose scene-specific resources
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((m) => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.scene.clear();
  }
}

/**
 * Example: Menu Scene
 */
export class MenuScene extends BaseScene {
  readonly name = 'menu';
  private title: THREE.Mesh | null = null;

  async onEnter(): Promise<void> {
    console.log('Entering menu scene');

    // Create a simple title
    const geometry = new THREE.BoxGeometry(3, 1, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    this.title = new THREE.Mesh(geometry, material);
    this.scene.add(this.title);

    // Add lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x404040));

    this.camera.position.z = 5;
  }

  async onExit(): Promise<void> {
    console.log('Exiting menu scene');
  }

  update(deltaTime: number): void {
    if (this.title) {
      this.title.rotation.y += 0.5 * deltaTime;
    }
  }
}

/**
 * Example: Game Scene
 */
export class PlayScene extends BaseScene {
  readonly name = 'play';
  private player: THREE.Mesh | null = null;

  async onEnter(): Promise<void> {
    console.log('Entering play scene');

    // Create player
    const geometry = new THREE.CapsuleGeometry(0.5, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.player = new THREE.Mesh(geometry, material);
    this.scene.add(this.player);

    // Add floor
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    this.scene.add(floor);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 10, 5);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x404040));

    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
  }

  async onExit(): Promise<void> {
    console.log('Exiting play scene');
  }

  update(deltaTime: number): void {
    if (this.player) {
      // Simple bounce animation
      this.player.position.y = Math.sin(performance.now() * 0.003) * 0.5;
    }
  }
}

// ============================================================================
// Usage Example
// ============================================================================

function exampleUsage(): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const sceneManager = new SceneManager(renderer);

  // Register scenes
  sceneManager.registerScene(new MenuScene());
  sceneManager.registerScene(new PlayScene());

  // Listen to events
  sceneManager.on('sceneEnter', (name) => {
    console.log(`Entered scene: ${name}`);
  });

  // Load initial scene
  sceneManager.loadScene('menu');

  // Switch scenes with keyboard
  window.addEventListener('keydown', async (event) => {
    if (event.code === 'Enter') {
      const current = sceneManager.getCurrentScene()?.name;
      const next = current === 'menu' ? 'play' : 'menu';

      await sceneManager.loadScene(next, {
        type: 'fade',
        duration: 1,
        color: new THREE.Color(0x000000)
      });
    }
  });

  // Game loop
  const clock = new THREE.Clock();
  function animate(): void {
    const delta = clock.getDelta();
    sceneManager.update(delta);
    sceneManager.render();
    requestAnimationFrame(animate);
  }
  animate();

  // Handle resize
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    sceneManager.onResize(width, height);
  });
}

export { exampleUsage };
