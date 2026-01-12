/**
 * Main Game Class
 * Orchestrates all game systems and manages the game lifecycle.
 */

import { Renderer } from '../engine/Renderer';
import { AssetLoader } from '../engine/AssetLoader';
import { InputManager } from '../engine/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { GameLoop } from './GameLoop';
import { SceneManager } from './SceneManager';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

/**
 * Main Game class that coordinates all game systems.
 *
 * @example
 * ```typescript
 * const game = new Game();
 * await game.init();
 * game.start();
 *
 * // Cleanup on page unload
 * window.addEventListener('beforeunload', () => game.dispose());
 * ```
 */
export class Game {
  // Core systems
  private renderer: Renderer;
  private assetLoader: AssetLoader;
  private inputManager: InputManager;
  private audioManager: AudioManager;
  private sceneManager: SceneManager;
  private gameLoop: GameLoop;

  // State
  private isInitialized = false;

  constructor() {
    // Initialize core systems
    this.renderer = new Renderer();
    this.assetLoader = new AssetLoader();
    this.inputManager = new InputManager();
    this.audioManager = new AudioManager();
    this.sceneManager = new SceneManager(this.renderer);

    // Initialize game loop with update and render callbacks
    this.gameLoop = new GameLoop(
      this.update.bind(this),
      this.render.bind(this)
    );

    // Setup WebGL context loss handling
    this.setupContextHandling();
  }

  /**
   * Initialize the game.
   * Loads assets and sets up scenes.
   */
  async init(): Promise<void> {
    // Setup loading UI progress
    this.assetLoader.onProgress((progress) => {
      this.updateLoadingUI(progress);
    });

    // Load initial assets
    await this.loadAssets();

    // Register scenes
    this.registerScenes();

    // Hide loading screen
    this.hideLoadingUI();

    // Load initial scene
    await this.sceneManager.load('menu');

    this.isInitialized = true;
  }

  /**
   * Start the game loop.
   */
  start(): void {
    if (!this.isInitialized) {
      console.error('Game not initialized. Call init() first.');
      return;
    }
    this.gameLoop.start();
  }

  /**
   * Pause the game.
   */
  pause(): void {
    this.gameLoop.pause();
    this.audioManager.pauseMusic();
  }

  /**
   * Resume the game.
   */
  resume(): void {
    this.gameLoop.resume();
    this.audioManager.resumeMusic();
  }

  /**
   * Check if game is paused.
   */
  isPaused(): boolean {
    return this.gameLoop.isPaused();
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.gameLoop.stop();
    this.sceneManager.dispose();
    this.audioManager.dispose();
    this.inputManager.dispose();
    this.assetLoader.dispose();
    this.renderer.dispose();
  }

  // ===========================================================================
  // Getters for subsystems (for advanced use)
  // ===========================================================================

  getRenderer(): Renderer {
    return this.renderer;
  }

  getAssetLoader(): AssetLoader {
    return this.assetLoader;
  }

  getInputManager(): InputManager {
    return this.inputManager;
  }

  getAudioManager(): AudioManager {
    return this.audioManager;
  }

  getSceneManager(): SceneManager {
    return this.sceneManager;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Load initial game assets.
   */
  private async loadAssets(): Promise<void> {
    // Load your game assets here
    // Example:
    // await this.assetLoader.loadAll({
    //   models: {
    //     player: '/models/player.glb',
    //     enemy: '/models/enemy.glb',
    //   },
    //   textures: {
    //     ground: '/textures/ground.png',
    //     sky: '/textures/sky.hdr',
    //   },
    //   audio: {
    //     music: '/audio/music.mp3',
    //     jump: '/audio/jump.wav',
    //   }
    // });

    // For now, simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Register game scenes with the scene manager.
   */
  private registerScenes(): void {
    // Create and register scenes
    const menuScene = new MenuScene(this.inputManager, this.sceneManager);
    const gameScene = new GameScene(this.inputManager, this.sceneManager);

    this.sceneManager.register(menuScene);
    this.sceneManager.register(gameScene);

    // Listen for scene events
    this.sceneManager.events.on('scene:change', ({ from, to }) => {
      console.log(`Scene changed: ${from ?? 'none'} -> ${to}`);
    });
  }

  /**
   * Main update loop callback.
   */
  private update(deltaTime: number): void {
    // Update input first (clears just-pressed states)
    this.inputManager.update();

    // Update current scene
    this.sceneManager.update(deltaTime);
  }

  /**
   * Main render loop callback.
   */
  private render(): void {
    this.sceneManager.render();
  }

  /**
   * Setup WebGL context loss/restore handling.
   */
  private setupContextHandling(): void {
    const canvas = this.renderer.getRenderer().domElement;

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('WebGL context lost');
      this.pause();
      this.showContextLostMessage();
    });

    canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
      this.hideContextLostMessage();
      this.resume();
    });
  }

  /**
   * Show context lost message to user.
   */
  private showContextLostMessage(): void {
    let overlay = document.getElementById('context-lost-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'context-lost-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: sans-serif;
        font-size: 1.5rem;
        z-index: 10000;
      `;
      overlay.textContent = 'Graphics context lost. Attempting to restore...';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }

  /**
   * Hide context lost message.
   */
  private hideContextLostMessage(): void {
    const overlay = document.getElementById('context-lost-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * Update loading UI progress.
   */
  private updateLoadingUI(progress: number): void {
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');

    if (loadingBar) {
      loadingBar.style.width = `${progress}%`;
    }
    if (loadingText) {
      loadingText.textContent = `Loading... ${Math.round(progress)}%`;
    }
  }

  /**
   * Hide loading UI.
   */
  private hideLoadingUI(): void {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('hidden');
      setTimeout(() => {
        loading.remove();
      }, 500);
    }
  }
}
