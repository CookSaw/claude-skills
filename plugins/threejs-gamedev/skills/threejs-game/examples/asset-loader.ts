/**
 * Three.js Asset Loader Example
 *
 * Production-ready asset loading with:
 * - Caching to avoid duplicate loads
 * - Progress tracking with callbacks
 * - Error handling with retries
 * - Support for models, textures, audio, environments
 * - Batch loading from manifests
 * - Proper resource disposal
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ============================================================================
// Types
// ============================================================================

export interface LoadedAssets {
  models: Map<string, GLTF>;
  textures: Map<string, THREE.Texture>;
  audio: Map<string, AudioBuffer>;
  environments: Map<string, THREE.Texture>;
}

export interface AssetManifest {
  models?: Record<string, string>;
  textures?: Record<string, string>;
  audio?: Record<string, string>;
  environments?: Record<string, string>;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  percent: number;
  currentUrl: string;
}

export interface AssetLoaderOptions {
  /** Path to Draco decoder files */
  dracoDecoderPath?: string;
  /** Number of retry attempts for failed loads */
  maxRetries?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
}

// ============================================================================
// Asset Loader Class
// ============================================================================

export class AssetLoader {
  private loadingManager: THREE.LoadingManager;
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private audioLoader: THREE.AudioLoader;
  private rgbeLoader: RGBELoader;
  private dracoLoader: DRACOLoader;

  private cache: LoadedAssets = {
    models: new Map(),
    textures: new Map(),
    audio: new Map(),
    environments: new Map()
  };

  private options: Required<AssetLoaderOptions>;
  private onProgressCallback?: (progress: LoadProgress) => void;
  private onErrorCallback?: (url: string, error: Error) => void;

  constructor(options: AssetLoaderOptions = {}) {
    this.options = {
      dracoDecoderPath: options.dracoDecoderPath ?? '/draco/',
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000
    };

    this.loadingManager = new THREE.LoadingManager();
    this.setupLoadingManager();
    this.initLoaders();
  }

  // --------------------------------------------------------------------------
  // Setup
  // --------------------------------------------------------------------------

  private setupLoadingManager(): void {
    this.loadingManager.onProgress = (url, loaded, total) => {
      this.onProgressCallback?.({
        loaded,
        total,
        percent: (loaded / total) * 100,
        currentUrl: url
      });
    };

    this.loadingManager.onError = (url) => {
      console.error(`Failed to load: ${url}`);
    };
  }

  private initLoaders(): void {
    // Texture loader
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);

    // Audio loader
    this.audioLoader = new THREE.AudioLoader(this.loadingManager);

    // DRACO loader for compressed geometry
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(this.options.dracoDecoderPath);

    // GLTF loader with DRACO support
    this.gltfLoader = new GLTFLoader(this.loadingManager);
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    // HDR environment loader
    this.rgbeLoader = new RGBELoader(this.loadingManager);
  }

  // --------------------------------------------------------------------------
  // Public API - Callbacks
  // --------------------------------------------------------------------------

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: LoadProgress) => void): this {
    this.onProgressCallback = callback;
    return this;
  }

  /**
   * Set error callback
   */
  onError(callback: (url: string, error: Error) => void): this {
    this.onErrorCallback = callback;
    return this;
  }

  // --------------------------------------------------------------------------
  // Public API - Individual Loading
  // --------------------------------------------------------------------------

  /**
   * Load a 3D model (GLTF/GLB)
   */
  async loadModel(url: string, cacheKey?: string): Promise<GLTF> {
    const key = cacheKey ?? url;

    // Return cached if available
    if (this.cache.models.has(key)) {
      return this.cache.models.get(key)!;
    }

    const gltf = await this.loadWithRetry(() =>
      this.gltfLoader.loadAsync(url)
    );

    this.cache.models.set(key, gltf);
    return gltf;
  }

  /**
   * Load a texture
   */
  async loadTexture(
    url: string,
    cacheKey?: string,
    options?: {
      colorSpace?: THREE.ColorSpace;
      flipY?: boolean;
      wrapS?: THREE.Wrapping;
      wrapT?: THREE.Wrapping;
    }
  ): Promise<THREE.Texture> {
    const key = cacheKey ?? url;

    if (this.cache.textures.has(key)) {
      return this.cache.textures.get(key)!;
    }

    const texture = await this.loadWithRetry(() =>
      this.textureLoader.loadAsync(url)
    );

    // Apply options
    texture.colorSpace = options?.colorSpace ?? THREE.SRGBColorSpace;
    if (options?.flipY !== undefined) texture.flipY = options.flipY;
    if (options?.wrapS) texture.wrapS = options.wrapS;
    if (options?.wrapT) texture.wrapT = options.wrapT;

    this.cache.textures.set(key, texture);
    return texture;
  }

  /**
   * Load an audio buffer
   */
  async loadAudio(url: string, cacheKey?: string): Promise<AudioBuffer> {
    const key = cacheKey ?? url;

    if (this.cache.audio.has(key)) {
      return this.cache.audio.get(key)!;
    }

    const buffer = await this.loadWithRetry(() =>
      this.audioLoader.loadAsync(url)
    );

    this.cache.audio.set(key, buffer);
    return buffer;
  }

  /**
   * Load an HDR environment map
   */
  async loadEnvironment(url: string, cacheKey?: string): Promise<THREE.Texture> {
    const key = cacheKey ?? url;

    if (this.cache.environments.has(key)) {
      return this.cache.environments.get(key)!;
    }

    const texture = await this.loadWithRetry(() =>
      this.rgbeLoader.loadAsync(url)
    );

    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.cache.environments.set(key, texture);
    return texture;
  }

  // --------------------------------------------------------------------------
  // Public API - Batch Loading
  // --------------------------------------------------------------------------

  /**
   * Load multiple assets from a manifest
   */
  async loadAll(manifest: AssetManifest): Promise<LoadedAssets> {
    const promises: Promise<any>[] = [];

    // Models
    if (manifest.models) {
      for (const [key, url] of Object.entries(manifest.models)) {
        promises.push(
          this.loadModel(url, key).catch((error) => {
            this.onErrorCallback?.(url, error);
            return null;
          })
        );
      }
    }

    // Textures
    if (manifest.textures) {
      for (const [key, url] of Object.entries(manifest.textures)) {
        promises.push(
          this.loadTexture(url, key).catch((error) => {
            this.onErrorCallback?.(url, error);
            return null;
          })
        );
      }
    }

    // Audio
    if (manifest.audio) {
      for (const [key, url] of Object.entries(manifest.audio)) {
        promises.push(
          this.loadAudio(url, key).catch((error) => {
            this.onErrorCallback?.(url, error);
            return null;
          })
        );
      }
    }

    // Environments
    if (manifest.environments) {
      for (const [key, url] of Object.entries(manifest.environments)) {
        promises.push(
          this.loadEnvironment(url, key).catch((error) => {
            this.onErrorCallback?.(url, error);
            return null;
          })
        );
      }
    }

    await Promise.all(promises);
    return this.cache;
  }

  // --------------------------------------------------------------------------
  // Public API - Cache Access
  // --------------------------------------------------------------------------

  /**
   * Get a cached model
   */
  getModel(key: string): GLTF | undefined {
    return this.cache.models.get(key);
  }

  /**
   * Get a cached texture
   */
  getTexture(key: string): THREE.Texture | undefined {
    return this.cache.textures.get(key);
  }

  /**
   * Get cached audio
   */
  getAudio(key: string): AudioBuffer | undefined {
    return this.cache.audio.get(key);
  }

  /**
   * Get cached environment
   */
  getEnvironment(key: string): THREE.Texture | undefined {
    return this.cache.environments.get(key);
  }

  /**
   * Check if an asset is cached
   */
  isCached(type: keyof LoadedAssets, key: string): boolean {
    return this.cache[type].has(key);
  }

  // --------------------------------------------------------------------------
  // Public API - Disposal
  // --------------------------------------------------------------------------

  /**
   * Dispose a specific model
   */
  disposeModel(key: string): void {
    const gltf = this.cache.models.get(key);
    if (gltf) {
      this.disposeObject3D(gltf.scene);
      this.cache.models.delete(key);
    }
  }

  /**
   * Dispose a specific texture
   */
  disposeTexture(key: string): void {
    const texture = this.cache.textures.get(key);
    if (texture) {
      texture.dispose();
      this.cache.textures.delete(key);
    }
  }

  /**
   * Dispose a specific environment
   */
  disposeEnvironment(key: string): void {
    const texture = this.cache.environments.get(key);
    if (texture) {
      texture.dispose();
      this.cache.environments.delete(key);
    }
  }

  /**
   * Dispose all cached assets
   */
  dispose(): void {
    // Dispose models
    for (const gltf of this.cache.models.values()) {
      this.disposeObject3D(gltf.scene);
    }
    this.cache.models.clear();

    // Dispose textures
    for (const texture of this.cache.textures.values()) {
      texture.dispose();
    }
    this.cache.textures.clear();

    // Dispose environments
    for (const texture of this.cache.environments.values()) {
      texture.dispose();
    }
    this.cache.environments.clear();

    // Clear audio (no disposal needed for AudioBuffer)
    this.cache.audio.clear();

    // Dispose loaders
    this.dracoLoader.dispose();
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async loadWithRetry<T>(
    loadFn: () => Promise<T>
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        return await loadFn();
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Load attempt ${attempt + 1}/${this.options.maxRetries} failed:`,
          error
        );

        if (attempt < this.options.maxRetries - 1) {
          await this.delay(this.options.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private disposeObject3D(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        for (const material of materials) {
          this.disposeMaterial(material);
        }
      }
    });
  }

  private disposeMaterial(material: THREE.Material): void {
    const textureProps = [
      'map',
      'lightMap',
      'bumpMap',
      'normalMap',
      'specularMap',
      'envMap',
      'alphaMap',
      'aoMap',
      'displacementMap',
      'emissiveMap',
      'metalnessMap',
      'roughnessMap'
    ];

    for (const prop of textureProps) {
      const texture = (material as any)[prop];
      if (texture instanceof THREE.Texture) {
        texture.dispose();
      }
    }

    material.dispose();
  }
}

// ============================================================================
// Usage Example
// ============================================================================

async function exampleUsage(): Promise<void> {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  // Create loader
  const loader = new AssetLoader({
    dracoDecoderPath: '/draco/',
    maxRetries: 3,
    retryDelay: 1000
  });

  // Setup progress tracking
  loader.onProgress((progress) => {
    console.log(`Loading: ${progress.percent.toFixed(0)}% - ${progress.currentUrl}`);
    // Update loading bar UI
    // loadingBar.style.width = `${progress.percent}%`;
  });

  loader.onError((url, error) => {
    console.error(`Failed to load ${url}:`, error);
  });

  // Method 1: Load individual assets
  try {
    const playerModel = await loader.loadModel('/models/player.glb', 'player');
    scene.add(playerModel.scene);
  } catch (error) {
    console.error('Failed to load player model');
  }

  // Method 2: Batch load from manifest
  const manifest: AssetManifest = {
    models: {
      enemy: '/models/enemy.glb',
      level: '/models/level.glb'
    },
    textures: {
      grass: '/textures/grass.png',
      rock: '/textures/rock.png'
    },
    audio: {
      bgm: '/audio/background.mp3',
      jump: '/audio/jump.ogg'
    },
    environments: {
      sky: '/hdri/sky.hdr'
    }
  };

  const assets = await loader.loadAll(manifest);
  console.log('All assets loaded:', assets);

  // Access cached assets later
  const enemyModel = loader.getModel('enemy');
  if (enemyModel) {
    scene.add(enemyModel.scene.clone());
  }

  // Set environment
  const skyEnv = loader.getEnvironment('sky');
  if (skyEnv) {
    scene.environment = skyEnv;
    scene.background = skyEnv;
  }

  // Add lighting
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 10, 5);
  scene.add(light);

  // Render loop
  function animate(): void {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // Cleanup on unload
  window.addEventListener('beforeunload', () => {
    loader.dispose();
    renderer.dispose();
  });
}

export { exampleUsage };
