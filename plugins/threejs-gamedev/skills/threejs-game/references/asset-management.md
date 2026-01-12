# Three.js Asset Management Guide

This guide covers best practices for loading, managing, and optimizing assets in Three.js games.

## Asset Loading Overview

### Supported Asset Types

| Type | Loader | Recommended Format |
|------|--------|-------------------|
| 3D Models | GLTFLoader | .glb / .gltf |
| Textures | TextureLoader | .png / .jpg / .ktx2 |
| Audio | AudioLoader | .mp3 / .ogg |
| Fonts | FontLoader | .json (typeface) |
| HDR Environment | RGBELoader | .hdr |
| Cube Maps | CubeTextureLoader | .png / .jpg |

## LoadingManager Setup

### Basic Loading Manager

```typescript
import * as THREE from 'three';

const loadingManager = new THREE.LoadingManager();

loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
  console.log(`Started loading: ${url}`);
};

loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  const progress = (itemsLoaded / itemsTotal) * 100;
  updateLoadingBar(progress);
};

loadingManager.onLoad = () => {
  console.log('All assets loaded');
  hideLoadingScreen();
  startGame();
};

loadingManager.onError = (url) => {
  console.error(`Error loading: ${url}`);
  showErrorMessage(`Failed to load: ${url}`);
};
```

### Creating Loaders with Manager

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// All loaders use the same manager
const textureLoader = new THREE.TextureLoader(loadingManager);
const gltfLoader = new GLTFLoader(loadingManager);
const audioLoader = new THREE.AudioLoader(loadingManager);

// Configure DRACO for compressed glTF
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
gltfLoader.setDRACOLoader(dracoLoader);
```

## Asset Loader Class

### Complete Implementation

```typescript
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

export interface LoadedAssets {
  models: Map<string, GLTF>;
  textures: Map<string, THREE.Texture>;
  audio: Map<string, AudioBuffer>;
  environments: Map<string, THREE.Texture>;
}

export class AssetLoader {
  private loadingManager: THREE.LoadingManager;
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private audioLoader: THREE.AudioLoader;
  private rgbeLoader: RGBELoader;
  private ktx2Loader: KTX2Loader;

  private cache: LoadedAssets = {
    models: new Map(),
    textures: new Map(),
    audio: new Map(),
    environments: new Map()
  };

  private onProgressCallback?: (progress: number) => void;

  constructor(renderer?: THREE.WebGLRenderer) {
    this.loadingManager = new THREE.LoadingManager();
    this.setupLoadingManager();

    // Initialize loaders
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    this.audioLoader = new THREE.AudioLoader(this.loadingManager);

    // GLTF with DRACO support
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    this.gltfLoader = new GLTFLoader(this.loadingManager);
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // HDR environment loader
    this.rgbeLoader = new RGBELoader(this.loadingManager);

    // KTX2 compressed textures (requires renderer)
    this.ktx2Loader = new KTX2Loader(this.loadingManager);
    if (renderer) {
      this.ktx2Loader.setTranscoderPath('/basis/');
      this.ktx2Loader.detectSupport(renderer);
    }
  }

  private setupLoadingManager(): void {
    this.loadingManager.onProgress = (url, loaded, total) => {
      const progress = (loaded / total) * 100;
      this.onProgressCallback?.(progress);
    };

    this.loadingManager.onError = (url) => {
      console.error(`Failed to load: ${url}`);
    };
  }

  onProgress(callback: (progress: number) => void): void {
    this.onProgressCallback = callback;
  }

  // Model loading
  async loadModel(url: string, cacheKey?: string): Promise<GLTF> {
    const key = cacheKey ?? url;

    if (this.cache.models.has(key)) {
      return this.cache.models.get(key)!;
    }

    const gltf = await this.gltfLoader.loadAsync(url);
    this.cache.models.set(key, gltf);
    return gltf;
  }

  // Texture loading
  async loadTexture(url: string, cacheKey?: string): Promise<THREE.Texture> {
    const key = cacheKey ?? url;

    if (this.cache.textures.has(key)) {
      return this.cache.textures.get(key)!;
    }

    const texture = await this.textureLoader.loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.cache.textures.set(key, texture);
    return texture;
  }

  // Compressed texture loading (KTX2)
  async loadCompressedTexture(url: string, cacheKey?: string): Promise<THREE.Texture> {
    const key = cacheKey ?? url;

    if (this.cache.textures.has(key)) {
      return this.cache.textures.get(key)!;
    }

    const texture = await this.ktx2Loader.loadAsync(url);
    this.cache.textures.set(key, texture);
    return texture;
  }

  // Audio loading
  async loadAudio(url: string, cacheKey?: string): Promise<AudioBuffer> {
    const key = cacheKey ?? url;

    if (this.cache.audio.has(key)) {
      return this.cache.audio.get(key)!;
    }

    const buffer = await this.audioLoader.loadAsync(url);
    this.cache.audio.set(key, buffer);
    return buffer;
  }

  // HDR environment loading
  async loadEnvironment(url: string, cacheKey?: string): Promise<THREE.Texture> {
    const key = cacheKey ?? url;

    if (this.cache.environments.has(key)) {
      return this.cache.environments.get(key)!;
    }

    const texture = await this.rgbeLoader.loadAsync(url);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    this.cache.environments.set(key, texture);
    return texture;
  }

  // Batch loading
  async loadAll(manifest: AssetManifest): Promise<LoadedAssets> {
    const promises: Promise<any>[] = [];

    // Models
    for (const [key, url] of Object.entries(manifest.models ?? {})) {
      promises.push(this.loadModel(url, key));
    }

    // Textures
    for (const [key, url] of Object.entries(manifest.textures ?? {})) {
      promises.push(this.loadTexture(url, key));
    }

    // Audio
    for (const [key, url] of Object.entries(manifest.audio ?? {})) {
      promises.push(this.loadAudio(url, key));
    }

    // Environments
    for (const [key, url] of Object.entries(manifest.environments ?? {})) {
      promises.push(this.loadEnvironment(url, key));
    }

    await Promise.all(promises);
    return this.cache;
  }

  // Get cached assets
  getModel(key: string): GLTF | undefined {
    return this.cache.models.get(key);
  }

  getTexture(key: string): THREE.Texture | undefined {
    return this.cache.textures.get(key);
  }

  getAudio(key: string): AudioBuffer | undefined {
    return this.cache.audio.get(key);
  }

  getEnvironment(key: string): THREE.Texture | undefined {
    return this.cache.environments.get(key);
  }

  // Dispose specific assets
  disposeModel(key: string): void {
    const gltf = this.cache.models.get(key);
    if (gltf) {
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.cache.models.delete(key);
    }
  }

  disposeTexture(key: string): void {
    const texture = this.cache.textures.get(key);
    texture?.dispose();
    this.cache.textures.delete(key);
  }

  // Dispose all cached assets
  dispose(): void {
    for (const key of this.cache.models.keys()) {
      this.disposeModel(key);
    }
    for (const texture of this.cache.textures.values()) {
      texture.dispose();
    }
    for (const texture of this.cache.environments.values()) {
      texture.dispose();
    }
    this.cache.models.clear();
    this.cache.textures.clear();
    this.cache.audio.clear();
    this.cache.environments.clear();
  }
}

export interface AssetManifest {
  models?: Record<string, string>;
  textures?: Record<string, string>;
  audio?: Record<string, string>;
  environments?: Record<string, string>;
}
```

### Usage

```typescript
const assetLoader = new AssetLoader(renderer);

// Progress tracking
assetLoader.onProgress((progress) => {
  loadingBar.style.width = `${progress}%`;
});

// Load individual assets
const playerModel = await assetLoader.loadModel('/models/player.glb', 'player');

// Batch load from manifest
const assets = await assetLoader.loadAll({
  models: {
    player: '/models/player.glb',
    enemy: '/models/enemy.glb',
    level: '/models/level.glb'
  },
  textures: {
    grass: '/textures/grass.png',
    rock: '/textures/rock.png'
  },
  audio: {
    bgm: '/audio/background.mp3',
    shoot: '/audio/shoot.ogg'
  },
  environments: {
    sky: '/hdri/sky.hdr'
  }
});

// Access cached assets
const enemy = assetLoader.getModel('enemy');
```

## glTF Best Practices

### Why glTF?

- Industry standard for web 3D
- Efficient binary format (GLB)
- Supports animations, materials, textures
- Draco compression for geometry
- KTX2/Basis compression for textures

### Draco Compression

```bash
# Install gltf-transform CLI
npm install -g @gltf-transform/cli

# Compress a model with Draco
gltf-transform draco model.glb model-compressed.glb

# Check file size reduction
ls -lh model.glb model-compressed.glb
```

### Texture Optimization

```bash
# Convert textures to KTX2 with Basis compression
gltf-transform ktx model.glb model-ktx.glb

# Resize textures
gltf-transform resize model.glb model-resized.glb --width 1024 --height 1024

# Full optimization pipeline
gltf-transform optimize model.glb model-optimized.glb
```

### Model Export Settings (Blender)

1. Apply all transforms (Ctrl+A > All Transforms)
2. Export as glTF 2.0 (.glb)
3. Enable "Apply Modifiers"
4. Include: Normals, UVs, Vertex Colors (if used)
5. Compression: Enable Draco
6. Texture format: PNG or KTX2

## Memory Management

### Texture Memory Estimation

```typescript
function estimateTextureMemory(texture: THREE.Texture): number {
  const image = texture.image;
  if (!image) return 0;

  const width = image.width;
  const height = image.height;
  const bytesPerPixel = 4; // RGBA
  const mipmapFactor = texture.generateMipmaps ? 1.33 : 1;

  return width * height * bytesPerPixel * mipmapFactor;
}

function logTextureMemory(): void {
  let totalBytes = 0;
  for (const texture of assetLoader.cache.textures.values()) {
    totalBytes += estimateTextureMemory(texture);
  }
  console.log(`Texture memory: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
}
```

### Geometry Memory Estimation

```typescript
function estimateGeometryMemory(geometry: THREE.BufferGeometry): number {
  let bytes = 0;

  for (const attribute of Object.values(geometry.attributes)) {
    bytes += attribute.array.byteLength;
  }

  if (geometry.index) {
    bytes += geometry.index.array.byteLength;
  }

  return bytes;
}
```

### Memory Budget Guidelines

| Platform | Total VRAM Budget | Texture Budget |
|----------|------------------|----------------|
| Mobile | 256-512 MB | 128-256 MB |
| Desktop | 1-2 GB | 512 MB - 1 GB |
| High-end | 4+ GB | 2+ GB |

## Preloading Strategies

### Priority-Based Loading

```typescript
interface AssetPriority {
  url: string;
  type: 'model' | 'texture' | 'audio';
  priority: 'critical' | 'high' | 'low';
}

async function loadByPriority(assets: AssetPriority[]): Promise<void> {
  const critical = assets.filter(a => a.priority === 'critical');
  const high = assets.filter(a => a.priority === 'high');
  const low = assets.filter(a => a.priority === 'low');

  // Load critical assets first (blocking)
  await Promise.all(critical.map(loadAsset));

  // Start game while loading remaining
  startGame();

  // Load high priority
  await Promise.all(high.map(loadAsset));

  // Load low priority in background
  low.forEach(loadAsset); // Don't await
}
```

### Scene-Based Loading

```typescript
const sceneAssets: Record<string, AssetManifest> = {
  menu: {
    textures: { background: '/textures/menu-bg.png' },
    audio: { menuMusic: '/audio/menu.mp3' }
  },
  level1: {
    models: {
      player: '/models/player.glb',
      level: '/models/level1.glb'
    },
    textures: { skybox: '/textures/sky.png' }
  },
  level2: {
    models: { level: '/models/level2.glb' }
  }
};

async function preloadScene(sceneName: string): Promise<void> {
  const manifest = sceneAssets[sceneName];
  if (manifest) {
    await assetLoader.loadAll(manifest);
  }
}

// Preload next level while playing
async function onLevelStart(currentLevel: number): Promise<void> {
  const nextLevel = `level${currentLevel + 1}`;
  preloadScene(nextLevel); // Don't await - background load
}
```

## Error Handling

### Retry Logic

```typescript
async function loadWithRetry<T>(
  loadFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await loadFn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Load attempt ${attempt + 1} failed:`, error);

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

// Usage
const model = await loadWithRetry(() => assetLoader.loadModel('/models/player.glb'));
```

### Fallback Assets

```typescript
async function loadModelWithFallback(
  url: string,
  fallbackUrl: string
): Promise<GLTF> {
  try {
    return await assetLoader.loadModel(url);
  } catch (error) {
    console.warn(`Failed to load ${url}, using fallback`);
    return await assetLoader.loadModel(fallbackUrl);
  }
}

// Create placeholder geometry for failed loads
function createPlaceholderMesh(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true
  });
  return new THREE.Mesh(geometry, material);
}
```

## Disposal Checklist

When unloading assets:

- [ ] Dispose all geometries: `geometry.dispose()`
- [ ] Dispose all materials: `material.dispose()`
- [ ] Dispose all textures: `texture.dispose()`
- [ ] Remove from scene: `scene.remove(object)`
- [ ] Clear references: `cache.delete(key)`
- [ ] Dispose render targets if used
- [ ] Clear audio buffers

```typescript
function disposeCompletely(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const material of materials) {
        // Dispose all texture types
        const textureProps = [
          'map', 'lightMap', 'bumpMap', 'normalMap',
          'specularMap', 'envMap', 'alphaMap', 'aoMap',
          'displacementMap', 'emissiveMap', 'metalnessMap',
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
  });

  object.parent?.remove(object);
}
```
