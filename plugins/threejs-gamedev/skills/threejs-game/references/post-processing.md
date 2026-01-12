# Three.js Post-Processing Guide

This guide covers visual effects and post-processing in Three.js games.

## Post-Processing Options

| Library | Pros | Cons |
|---------|------|------|
| **Three.js Built-in** | No deps, official | Limited effects |
| **postprocessing** (@pmndrs) | Many effects, optimized | Extra dependency |
| **Custom Shaders** | Full control | More work |

## Three.js Built-in EffectComposer

### Setup

```typescript
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Create composer
const composer = new EffectComposer(renderer);

// Base render pass (renders scene normally)
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Add bloom effect
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,  // strength
  0.4,  // radius
  0.85  // threshold
);
composer.addPass(bloomPass);

// Output pass (required for correct color space)
const outputPass = new OutputPass();
composer.addPass(outputPass);

// Render with composer instead of renderer
function gameLoop(): void {
  // Don't use renderer.render()
  composer.render();
  requestAnimationFrame(gameLoop);
}
```

### Handle Resize

```typescript
function onResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  composer.setSize(width, height);

  // Update bloom resolution
  bloomPass.resolution.set(width, height);
}
```

## Common Effects

### Bloom (Glow)

```typescript
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,  // strength - how bright the bloom is
  0.4,  // radius - how far bloom spreads
  0.85  // threshold - minimum brightness to bloom
);
composer.addPass(bloomPass);

// Selective bloom - only bright objects glow
// Objects with emissive materials or high brightness will bloom
const glowMaterial = new THREE.MeshStandardMaterial({
  color: 0x00ff00,
  emissive: 0x00ff00,
  emissiveIntensity: 2
});
```

### Screen Space Ambient Occlusion (SSAO)

```typescript
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';

const ssaoPass = new SSAOPass(scene, camera, width, height);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);
```

### Anti-Aliasing (FXAA/SMAA)

```typescript
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// FXAA - Fast, lower quality
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
composer.addPass(fxaaPass);

// SMAA - Better quality, more expensive
const smaaPass = new SMAAPass(width, height);
composer.addPass(smaaPass);
```

### Film Grain & Scanlines

```typescript
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

const filmPass = new FilmPass(
  0.35,  // noise intensity
  false  // grayscale
);
composer.addPass(filmPass);
```

### Depth of Field (Bokeh)

```typescript
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

const bokehPass = new BokehPass(scene, camera, {
  focus: 10,      // Focus distance
  aperture: 0.025, // Aperture size
  maxblur: 0.01   // Maximum blur amount
});
composer.addPass(bokehPass);
```

### Vignette

```typescript
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
      float vig = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
      color.rgb *= mix(1.0, vig, darkness);
      gl_FragColor = color;
    }
  `
};

const vignettePass = new ShaderPass(vignetteShader);
vignettePass.uniforms['darkness'].value = 1.5;
composer.addPass(vignettePass);
```

## @pmndrs/postprocessing Library

More optimized and feature-rich:

```bash
npm install postprocessing
```

### Setup

```typescript
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode
} from 'postprocessing';

const composer = new EffectComposer(renderer);

// Render pass
composer.addPass(new RenderPass(scene, camera));

// Effects pass (combines multiple effects efficiently)
const bloomEffect = new BloomEffect({
  intensity: 1,
  luminanceThreshold: 0.9,
  luminanceSmoothing: 0.025
});

const smaaEffect = new SMAAEffect();

const toneMappingEffect = new ToneMappingEffect({
  mode: ToneMappingMode.ACES_FILMIC
});

composer.addPass(new EffectPass(
  camera,
  bloomEffect,
  smaaEffect,
  toneMappingEffect
));
```

### Advanced Effects

```typescript
import {
  SSAOEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction
} from 'postprocessing';

// SSAO
const ssaoEffect = new SSAOEffect(camera, normalPass.texture, {
  samples: 16,
  rings: 4,
  distanceThreshold: 0.5,
  distanceFalloff: 0.1,
  rangeThreshold: 0.0005,
  rangeFalloff: 0.001,
  luminanceInfluence: 0.7,
  radius: 0.05
});

// Chromatic aberration (color fringing)
const chromaticAberration = new ChromaticAberrationEffect({
  offset: new THREE.Vector2(0.002, 0.002)
});

// Vignette
const vignette = new VignetteEffect({
  offset: 0.5,
  darkness: 0.5
});

// Film grain
const noise = new NoiseEffect({
  blendFunction: BlendFunction.OVERLAY,
  premultiply: true
});
```

## Selective Post-Processing

Apply effects to specific objects only:

### Bloom Layers

```typescript
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);

// Objects that should bloom
glowingObject.layers.enable(BLOOM_LAYER);

// Create separate scenes
const bloomScene = new THREE.Scene();
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

// Custom render function
function renderBloom(): void {
  // Store original materials
  const materials: Map<THREE.Mesh, THREE.Material> = new Map();

  scene.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      if (!bloomLayer.test(obj.layers)) {
        materials.set(obj, obj.material as THREE.Material);
        obj.material = darkMaterial;
      }
    }
  });

  // Render bloom pass
  bloomComposer.render();

  // Restore materials
  materials.forEach((mat, mesh) => {
    mesh.material = mat;
  });
}
```

## Performance Optimization

### Mobile-Friendly Setup

```typescript
function createMobileComposer(): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Use FXAA instead of SMAA (faster)
  const fxaaPass = new ShaderPass(FXAAShader);
  composer.addPass(fxaaPass);

  // Skip heavy effects on mobile
  if (!isMobile()) {
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width / 2, height / 2), // Half resolution
      0.3, // Lower strength
      0.3,
      0.9  // Higher threshold
    );
    composer.addPass(bloomPass);
  }

  composer.addPass(new OutputPass());
  return composer;
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
```

### Resolution Scaling

```typescript
class ScaledComposer {
  private composer: EffectComposer;
  private renderTarget: THREE.WebGLRenderTarget;
  private scale: number;

  constructor(renderer: THREE.WebGLRenderer, scale = 0.5) {
    this.scale = scale;

    const width = Math.floor(window.innerWidth * scale);
    const height = Math.floor(window.innerHeight * scale);

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    this.composer = new EffectComposer(renderer, this.renderTarget);
  }

  setSize(width: number, height: number): void {
    const scaledWidth = Math.floor(width * this.scale);
    const scaledHeight = Math.floor(height * this.scale);
    this.composer.setSize(scaledWidth, scaledHeight);
  }
}
```

### Effect Quality Presets

```typescript
type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

function configureEffects(preset: QualityPreset): void {
  switch (preset) {
    case 'low':
      bloomPass.enabled = false;
      ssaoPass.enabled = false;
      fxaaPass.enabled = true;
      break;

    case 'medium':
      bloomPass.enabled = true;
      bloomPass.strength = 0.3;
      ssaoPass.enabled = false;
      fxaaPass.enabled = true;
      break;

    case 'high':
      bloomPass.enabled = true;
      bloomPass.strength = 0.5;
      ssaoPass.enabled = true;
      ssaoPass.kernelRadius = 8;
      smaaPass.enabled = true;
      break;

    case 'ultra':
      bloomPass.enabled = true;
      bloomPass.strength = 0.7;
      ssaoPass.enabled = true;
      ssaoPass.kernelRadius = 32;
      smaaPass.enabled = true;
      break;
  }
}
```

## Custom Post-Processing Shader

```typescript
const customShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Wave distortion
      uv.x += sin(uv.y * 10.0 + time) * 0.01 * intensity;

      vec4 color = texture2D(tDiffuse, uv);

      // Color adjustment
      color.rgb = pow(color.rgb, vec3(1.0 / 2.2)); // Gamma correction

      gl_FragColor = color;
    }
  `
};

const customPass = new ShaderPass(customShader);
composer.addPass(customPass);

// Update in game loop
function update(delta: number): void {
  customPass.uniforms['time'].value += delta;
}
```

## Common Combinations

### Stylized Look

```typescript
// Bloom + Vignette + Film grain
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(resolution, 0.4, 0.3, 0.9));
composer.addPass(vignettePass);
composer.addPass(new FilmPass(0.2, false));
composer.addPass(new OutputPass());
```

### Realistic Look

```typescript
// SSAO + Bloom + SMAA + Tone mapping
composer.addPass(new RenderPass(scene, camera));
composer.addPass(ssaoPass);
composer.addPass(new UnrealBloomPass(resolution, 0.2, 0.1, 0.95));
composer.addPass(new SMAAPass(width, height));
composer.addPass(new OutputPass());
```

### Retro Look

```typescript
// Pixelation + Dithering + Scanlines
const pixelPass = new ShaderPass(/* pixelation shader */);
composer.addPass(pixelPass);
composer.addPass(new FilmPass(0.5, true)); // Grayscale noise
```

## Cleanup

```typescript
function disposePostProcessing(): void {
  composer.passes.forEach(pass => {
    if ('dispose' in pass && typeof pass.dispose === 'function') {
      pass.dispose();
    }
  });
  composer.dispose();
}
```
