/**
 * Asset Loader
 * Handles loading and caching of game assets
 */

import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export interface AssetManifest {
  models?: Record<string, string>;
  textures?: Record<string, string>;
  audio?: Record<string, string>;
}

export class AssetLoader {
  private loadingManager: THREE.LoadingManager;
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private audioLoader: THREE.AudioLoader;

  private models: Map<string, GLTF> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private audio: Map<string, AudioBuffer> = new Map();

  private progressCallback?: (percent: number) => void;

  constructor() {
    this.loadingManager = new THREE.LoadingManager();
    this.setupManager();

    // Initialize loaders
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    this.audioLoader = new THREE.AudioLoader(this.loadingManager);

    // Setup GLTF loader with DRACO
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    this.gltfLoader = new GLTFLoader(this.loadingManager);
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }

  onProgress(callback: (percent: number) => void): void {
    this.progressCallback = callback;
  }

  async loadAll(manifest: AssetManifest): Promise<void> {
    const promises: Promise<any>[] = [];

    if (manifest.models) {
      for (const [key, url] of Object.entries(manifest.models)) {
        promises.push(this.loadModel(url, key));
      }
    }

    if (manifest.textures) {
      for (const [key, url] of Object.entries(manifest.textures)) {
        promises.push(this.loadTexture(url, key));
      }
    }

    if (manifest.audio) {
      for (const [key, url] of Object.entries(manifest.audio)) {
        promises.push(this.loadAudio(url, key));
      }
    }

    await Promise.all(promises);
  }

  async loadModel(url: string, key: string): Promise<GLTF> {
    if (this.models.has(key)) {
      return this.models.get(key)!;
    }
    const gltf = await this.gltfLoader.loadAsync(url);
    this.models.set(key, gltf);
    return gltf;
  }

  async loadTexture(url: string, key: string): Promise<THREE.Texture> {
    if (this.textures.has(key)) {
      return this.textures.get(key)!;
    }
    const texture = await this.textureLoader.loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(key, texture);
    return texture;
  }

  async loadAudio(url: string, key: string): Promise<AudioBuffer> {
    if (this.audio.has(key)) {
      return this.audio.get(key)!;
    }
    const buffer = await this.audioLoader.loadAsync(url);
    this.audio.set(key, buffer);
    return buffer;
  }

  getModel(key: string): GLTF | undefined {
    return this.models.get(key);
  }

  getTexture(key: string): THREE.Texture | undefined {
    return this.textures.get(key);
  }

  getAudio(key: string): AudioBuffer | undefined {
    return this.audio.get(key);
  }

  dispose(): void {
    for (const gltf of this.models.values()) {
      gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    this.models.clear();

    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    this.textures.clear();

    this.audio.clear();
  }

  private setupManager(): void {
    this.loadingManager.onProgress = (_url, loaded, total) => {
      const percent = (loaded / total) * 100;
      this.progressCallback?.(percent);
    };

    this.loadingManager.onError = (url) => {
      console.error(`Failed to load: ${url}`);
    };
  }
}
