---
name: Three.js Game Development
description: This skill should be used when the user asks to "create a Three.js game", "build a 3D game", "develop WebGL game", "optimize Three.js performance", "fix Three.js errors", "set up Three.js project", "create 3D scene", "implement game loop", "load 3D models", "add physics to Three.js", "Three.js animations", "AnimationMixer", "Three.js particles", "particle system", "Three.js audio", "spatial audio", "Three.js shaders", "custom shaders", "Three.js post-processing", "bloom effect", "SSAO", "mobile Three.js", "responsive 3D", "WebXR", "VR game", "AR game", "Three.js lighting", "Three.js materials", or mentions Three.js game development, WebGL games, 3D browser games, or r3f/react-three-fiber.
version: 0.2.0
---

# Three.js Game Development Skill

Build high-quality Three.js games with TypeScript. This skill covers performance optimization, error prevention, scalable architecture, physics, audio, and visual effects.

## Quick Start: Project Setup

```bash
npm create vite@latest my-game -- --template vanilla-ts
cd my-game
npm install three @types/three
npm install stats.js lil-gui  # Debug tools
```

### Essential Packages

| Package | Purpose |
|---------|---------|
| `three` | Core 3D library (use latest stable) |
| `@types/three` | TypeScript definitions |
| `stats.js` | FPS/memory monitoring |
| `lil-gui` | Debug UI panels |
| `cannon-es` | Physics (lightweight) |
| `@pmndrs/postprocessing` | Post-processing effects |

## Core Architecture

```typescript
import * as THREE from 'three';

// Scene - Container for all 3D objects
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera - Viewpoint (FOV, aspect, near, far)
const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 1000
);

// Renderer - Draws the scene
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for performance
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
```

## Game Loop (CRITICAL)

**Always use delta time for frame-rate independent animations.**

```typescript
const clock = new THREE.Clock();

function gameLoop(): void {
  const delta = clock.getDelta(); // Seconds since last frame

  // Update with delta time
  update(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

function update(delta: number): void {
  // Scale ALL movements by delta
  player.position.x += speed * delta;
  mixer?.update(delta); // Animations
  world?.step(1/60, delta); // Physics
}
```

## Materials System

| Material | Use Case | Performance |
|----------|----------|-------------|
| `MeshBasicMaterial` | Unlit, UI, mobile | Fastest |
| `MeshLambertMaterial` | Diffuse lighting only | Fast |
| `MeshPhongMaterial` | Specular highlights | Medium |
| `MeshStandardMaterial` | PBR, realistic | Slower |
| `MeshPhysicalMaterial` | Glass, clearcoat | Slowest |

```typescript
// Standard PBR material
const material = new THREE.MeshStandardMaterial({
  map: diffuseTexture,
  normalMap: normalTexture,
  roughness: 0.5,
  metalness: 0.0
});
```

## Lighting Types

| Light | Description | Shadows |
|-------|-------------|---------|
| `AmbientLight` | Global fill, no direction | No |
| `DirectionalLight` | Sun-like, parallel rays | Yes |
| `PointLight` | Omnidirectional (bulb) | Yes |
| `SpotLight` | Cone-shaped beam | Yes |
| `HemisphereLight` | Sky + ground colors | No |
| `RectAreaLight` | Rectangular soft light | No |

```typescript
// Basic 3-point lighting setup
const ambient = new THREE.AmbientLight(0x404040, 0.5);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(ambient, sun);
```

## Animation System

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let mixer: THREE.AnimationMixer;
const actions: Map<string, THREE.AnimationAction> = new Map();

// Load animated model
const gltf = await new GLTFLoader().loadAsync('/model.glb');
mixer = new THREE.AnimationMixer(gltf.scene);

// Setup actions
gltf.animations.forEach(clip => {
  actions.set(clip.name, mixer.clipAction(clip));
});

// Play animation
actions.get('walk')?.play();

// Crossfade between animations
function crossFade(from: string, to: string, duration = 0.3): void {
  const fromAction = actions.get(from);
  const toAction = actions.get(to);
  fromAction?.fadeOut(duration);
  toAction?.reset().fadeIn(duration).play();
}

// Update in game loop
mixer.update(delta);
```

## Critical Rules

### 1. Never Create Objects in Render Loop

```typescript
// BAD - Creates garbage every frame
function update() {
  const dir = new THREE.Vector3(); // Memory leak!
}

// GOOD - Reuse pre-allocated objects
const _dir = new THREE.Vector3();
function update() {
  _dir.set(1, 0, 0);
}
```

### 2. Complete Resource Disposal

```typescript
const TEXTURE_PROPS = [
  'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
  'envMap', 'alphaMap', 'aoMap', 'displacementMap', 'emissiveMap',
  'metalnessMap', 'roughnessMap', 'clearcoatMap', 'clearcoatNormalMap'
] as const;

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();

  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach(mat => {
    TEXTURE_PROPS.forEach(prop => {
      const texture = (mat as any)[prop];
      texture?.dispose();
    });
    mat.dispose();
  });
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse(child => {
    if (child instanceof THREE.Mesh) disposeMesh(child);
  });
  object.parent?.remove(object);
}
```

### 3. Handle Resize with Throttle

```typescript
let resizeTimeout: number;
const onResize = (): void => {
  clearTimeout(resizeTimeout);
  resizeTimeout = window.setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, 100);
};
window.addEventListener('resize', onResize);
```

## Performance Guidelines

### Draw Call Targets (2024+)

| Platform | Target | Max |
|----------|--------|-----|
| Mobile low-end | <50 | 100 |
| Mobile mid-range | <150 | 300 |
| Mobile high-end | <300 | 500 |
| Desktop | <500 | 1000 |

```typescript
// Monitor in dev
console.log('Draw calls:', renderer.info.render.calls);
console.log('Triangles:', renderer.info.render.triangles);
console.log('Textures:', renderer.info.memory.textures);
```

### Optimization Techniques

| Technique | Impact | When |
|-----------|--------|------|
| InstancedMesh | Very High | 50+ identical objects |
| LOD | High | Large scenes |
| Object Pooling | Medium | Spawn/destroy objects |
| Frustum Culling | Medium | Many objects |
| glTF + Draco | High | Always for models |
| KTX2 Textures | High | Large textures |

## WebGL Context Loss

```typescript
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  pauseGame();
  showMessage('Graphics context lost. Please wait...');
});

renderer.domElement.addEventListener('webglcontextrestored', () => {
  reinitializeResources();
  resumeGame();
});
```

## Project Structure

```
src/
\u251c\u2500\u2500 main.ts              # Entry point
\u251c\u2500\u2500 game/
\u2502   \u251c\u2500\u2500 Game.ts          # Main game class
\u2502   \u251c\u2500\u2500 GameLoop.ts      # Update/render loop
\u2502   \u2514\u2500\u2500 scenes/          # Game scenes/levels
\u251c\u2500\u2500 engine/
\u2502   \u251c\u2500\u2500 Renderer.ts      # WebGL setup
\u2502   \u251c\u2500\u2500 AssetLoader.ts   # Asset management
\u2502   \u251c\u2500\u2500 InputManager.ts  # Keyboard/mouse/touch/gamepad
\u2502   \u251c\u2500\u2500 AudioManager.ts  # Sound system
\u2502   \u2514\u2500\u2500 PhysicsWorld.ts  # Physics integration
\u251c\u2500\u2500 entities/            # Game objects
\u251c\u2500\u2500 components/          # ECS components
\u2514\u2500\u2500 utils/
    \u251c\u2500\u2500 pool.ts          # Object pooling
    \u2514\u2500\u2500 math.ts          # Math helpers
```

## Debug Tools

```typescript
import Stats from 'stats.js';
import GUI from 'lil-gui';

// FPS monitor
const stats = new Stats();
document.body.appendChild(stats.dom);

// Debug panel
const gui = new GUI();
gui.add(settings, 'wireframe').onChange(updateMaterials);
gui.add(settings, 'shadows').onChange(toggleShadows);
gui.addColor(settings, 'ambientColor');

// In game loop
stats.begin();
// ... game logic
stats.end();
```

## Additional Resources

### Reference Files

- **`references/performance.md`** - LOD, instancing, profiling, mobile optimization
- **`references/common-errors.md`** - Errors with solutions, debugging strategies
- **`references/architecture.md`** - MVC, ECS patterns, input handling
- **`references/asset-management.md`** - Loading, caching, memory management
- **`references/physics.md`** - Cannon-es/Rapier integration
- **`references/audio.md`** - Spatial audio, music, sound effects
- **`references/post-processing.md`** - Bloom, SSAO, color grading
- **`references/shaders.md`** - Custom shaders, GLSL, TSL

### Example Files

- **`examples/game-loop.ts`** - Production game loop
- **`examples/scene-manager.ts`** - Scene transitions
- **`examples/asset-loader.ts`** - Asset loading with progress
- **`examples/physics-integration.ts`** - Physics setup
- **`examples/audio-manager.ts`** - Audio system
- **`examples/post-processing-setup.ts`** - Visual effects
- **`examples/project-structure/`** - Starter template

### External Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Three.js Examples](https://threejs.org/examples/)
- [Three.js Journey](https://threejs-journey.com/) - Comprehensive course
- [Discover Three.js](https://discoverthreejs.com/) - Free book
- [The Book of Shaders](https://thebookofshaders.com/) - GLSL learning

## Quick Debugging Checklist

1. **Black screen?** Check camera position, add lights, verify renderer attached
2. **Objects invisible?** Check material side, normals, frustum culling
3. **Poor FPS?** Check draw calls, reduce shadows, use LOD
4. **Memory leak?** Verify dispose() calls, check `renderer.info.memory`
5. **Colors wrong?** Set `texture.colorSpace = THREE.SRGBColorSpace`
6. **Animations broken?** Verify mixer.update(delta) called every frame
