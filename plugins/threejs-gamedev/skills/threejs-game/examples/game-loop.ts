/**
 * Three.js Game Loop Example
 *
 * Production-ready game loop implementation with:
 * - Delta time for frame-rate independent updates
 * - Fixed timestep for physics (optional)
 * - Performance monitoring
 * - Pause/resume functionality
 * - Proper cleanup
 */

import * as THREE from 'three';
import Stats from 'stats.js';

// ============================================================================
// Types
// ============================================================================

interface GameLoopCallbacks {
  /** Called every frame with delta time in seconds */
  update: (deltaTime: number) => void;
  /** Called every frame to render the scene */
  render: () => void;
  /** Optional: Called at fixed intervals for physics */
  fixedUpdate?: (fixedDeltaTime: number) => void;
}

interface GameLoopOptions {
  /** Target FPS (default: 60) */
  targetFPS?: number;
  /** Fixed timestep for physics in seconds (default: 1/60) */
  fixedTimestep?: number;
  /** Maximum delta time to prevent spiral of death (default: 0.1) */
  maxDeltaTime?: number;
  /** Enable Stats.js performance panel (default: false) */
  showStats?: boolean;
}

// ============================================================================
// GameLoop Class
// ============================================================================

export class GameLoop {
  private callbacks: GameLoopCallbacks;
  private options: Required<GameLoopOptions>;

  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private isPaused = false;

  // Fixed timestep accumulator
  private accumulator = 0;

  // Performance monitoring
  private stats: Stats | null = null;

  // Frame timing
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsUpdateInterval = 1000; // ms
  private lastFpsUpdate = 0;
  private currentFPS = 0;

  constructor(callbacks: GameLoopCallbacks, options: GameLoopOptions = {}) {
    this.callbacks = callbacks;
    this.options = {
      targetFPS: options.targetFPS ?? 60,
      fixedTimestep: options.fixedTimestep ?? 1 / 60,
      maxDeltaTime: options.maxDeltaTime ?? 0.1,
      showStats: options.showStats ?? false
    };

    this.clock = new THREE.Clock(false); // Don't auto-start

    if (this.options.showStats) {
      this.initStats();
    }
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;
    this.clock.start();
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = this.lastFrameTime;

    this.tick();
  }

  /**
   * Stop the game loop completely
   */
  stop(): void {
    this.isRunning = false;
    this.clock.stop();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Pause the game loop (rendering continues, updates stop)
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (this.isPaused) {
      this.isPaused = false;
      // Reset delta to avoid large jump
      this.clock.getDelta();
    }
  }

  /**
   * Toggle pause state
   */
  togglePause(): void {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Check if loop is running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Check if loop is paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.currentFPS;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();

    if (this.stats) {
      this.stats.dom.remove();
      this.stats = null;
    }
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private initStats(): void {
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb

    // Style and position
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.left = '0px';
    this.stats.dom.style.top = '0px';

    document.body.appendChild(this.stats.dom);
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    this.stats?.begin();

    // Calculate delta time
    let deltaTime = this.clock.getDelta();

    // Clamp delta time to prevent spiral of death
    deltaTime = Math.min(deltaTime, this.options.maxDeltaTime);

    // Update FPS counter
    this.updateFPSCounter();

    // Only update game logic if not paused
    if (!this.isPaused) {
      // Fixed timestep updates (for physics)
      if (this.callbacks.fixedUpdate) {
        this.accumulator += deltaTime;

        while (this.accumulator >= this.options.fixedTimestep) {
          this.callbacks.fixedUpdate(this.options.fixedTimestep);
          this.accumulator -= this.options.fixedTimestep;
        }
      }

      // Variable timestep update (for gameplay)
      this.callbacks.update(deltaTime);
    }

    // Always render (even when paused, for UI updates)
    this.callbacks.render();

    this.stats?.end();

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private updateFPSCounter(): void {
    const now = performance.now();
    this.frameCount++;

    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.currentFPS = Math.round(
        (this.frameCount * 1000) / (now - this.lastFpsUpdate)
      );
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }
}

// ============================================================================
// Usage Example
// ============================================================================

/**
 * Example usage of the GameLoop class
 */
function exampleUsage(): void {
  // Setup Three.js basics
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  // Create a test object
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // Add light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 5, 5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  // Game state
  let rotationSpeed = 1;
  let physicsAccumulator = 0;

  // Create game loop
  const gameLoop = new GameLoop(
    {
      update(deltaTime) {
        // Smooth rotation based on delta time
        cube.rotation.x += rotationSpeed * deltaTime;
        cube.rotation.y += rotationSpeed * 0.5 * deltaTime;
      },

      render() {
        renderer.render(scene, camera);
      },

      fixedUpdate(fixedDelta) {
        // Physics updates at fixed rate
        // Example: Apply gravity, resolve collisions, etc.
        physicsAccumulator += fixedDelta;
      }
    },
    {
      showStats: true,
      fixedTimestep: 1 / 60,
      maxDeltaTime: 0.1
    }
  );

  // Start the loop
  gameLoop.start();

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Handle pause with spacebar
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      gameLoop.togglePause();
      console.log(gameLoop.getIsPaused() ? 'Paused' : 'Resumed');
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    gameLoop.dispose();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  });
}

// Export for use in other files
export { exampleUsage };
