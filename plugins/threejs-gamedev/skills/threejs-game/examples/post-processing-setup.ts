/**
 * Three.js Post-Processing Setup Example
 *
 * Production-ready post-processing with:
 * - EffectComposer setup
 * - Common effects (Bloom, SSAO, FXAA)
 * - Quality presets for different devices
 * - Custom shader passes
 * - Proper resize handling
 * - Cleanup
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// ============================================================================
// Types
// ============================================================================

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface PostProcessingConfig {
  quality?: QualityPreset;
  bloom?: boolean;
  ssao?: boolean;
  antialiasing?: 'none' | 'fxaa' | 'smaa';
  vignette?: boolean;
  chromaticAberration?: boolean;
}

export interface BloomConfig {
  strength: number;
  radius: number;
  threshold: number;
}

export interface SSAOConfig {
  kernelRadius: number;
  minDistance: number;
  maxDistance: number;
}

// ============================================================================
// Quality Presets
// ============================================================================

const QUALITY_PRESETS: Record<QualityPreset, {
  bloom: BloomConfig;
  ssao: SSAOConfig;
  enableSSAO: boolean;
  antialiasing: 'none' | 'fxaa' | 'smaa';
  renderScale: number;
}> = {
  low: {
    bloom: { strength: 0.3, radius: 0.3, threshold: 0.9 },
    ssao: { kernelRadius: 8, minDistance: 0.005, maxDistance: 0.1 },
    enableSSAO: false,
    antialiasing: 'fxaa',
    renderScale: 0.75
  },
  medium: {
    bloom: { strength: 0.5, radius: 0.4, threshold: 0.85 },
    ssao: { kernelRadius: 16, minDistance: 0.005, maxDistance: 0.1 },
    enableSSAO: false,
    antialiasing: 'fxaa',
    renderScale: 1
  },
  high: {
    bloom: { strength: 0.6, radius: 0.5, threshold: 0.8 },
    ssao: { kernelRadius: 24, minDistance: 0.005, maxDistance: 0.1 },
    enableSSAO: true,
    antialiasing: 'smaa',
    renderScale: 1
  },
  ultra: {
    bloom: { strength: 0.7, radius: 0.6, threshold: 0.75 },
    ssao: { kernelRadius: 32, minDistance: 0.003, maxDistance: 0.15 },
    enableSSAO: true,
    antialiasing: 'smaa',
    renderScale: 1
  }
};

// ============================================================================
// Custom Vignette Shader
// ============================================================================

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.0 },
    darkness: { value: 1.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
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

// ============================================================================
// Custom Chromatic Aberration Shader
// ============================================================================

const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.003 },
    angle: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float amount;
    uniform float angle;
    varying vec2 vUv;

    void main() {
      vec2 offset = amount * vec2(cos(angle), sin(angle));

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};

// ============================================================================
// Post-Processing Manager
// ============================================================================

export class PostProcessingManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private composer: EffectComposer;

  // Passes
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass | null = null;
  private ssaoPass: SSAOPass | null = null;
  private fxaaPass: ShaderPass | null = null;
  private smaaPass: SMAAPass | null = null;
  private vignettePass: ShaderPass | null = null;
  private chromaticPass: ShaderPass | null = null;
  private outputPass: OutputPass;

  // Settings
  private currentQuality: QualityPreset = 'medium';
  private config: PostProcessingConfig;
  private renderScale = 1;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: PostProcessingConfig = {}
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.config = config;

    // Create composer
    this.composer = new EffectComposer(renderer);

    // Base render pass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Output pass (for color space correction)
    this.outputPass = new OutputPass();

    // Apply quality preset or custom config
    if (config.quality) {
      this.setQuality(config.quality);
    } else {
      this.setupCustomConfig(config);
    }
  }

  // --------------------------------------------------------------------------
  // Quality Presets
  // --------------------------------------------------------------------------

  setQuality(quality: QualityPreset): void {
    this.currentQuality = quality;
    const preset = QUALITY_PRESETS[quality];
    this.renderScale = preset.renderScale;

    // Remove existing effect passes
    this.removeEffectPasses();

    // Bloom
    if (this.config.bloom !== false) {
      this.setupBloom(preset.bloom);
    }

    // SSAO
    if (preset.enableSSAO && this.config.ssao !== false) {
      this.setupSSAO(preset.ssao);
    }

    // Anti-aliasing
    this.setupAntialiasing(preset.antialiasing);

    // Vignette
    if (this.config.vignette) {
      this.setupVignette();
    }

    // Chromatic Aberration
    if (this.config.chromaticAberration) {
      this.setupChromaticAberration();
    }

    // Output pass (always last)
    this.composer.addPass(this.outputPass);

    // Apply render scale
    this.updateSize();
  }

  private setupCustomConfig(config: PostProcessingConfig): void {
    if (config.bloom) {
      this.setupBloom({ strength: 0.5, radius: 0.4, threshold: 0.85 });
    }

    if (config.ssao) {
      this.setupSSAO({ kernelRadius: 16, minDistance: 0.005, maxDistance: 0.1 });
    }

    if (config.antialiasing && config.antialiasing !== 'none') {
      this.setupAntialiasing(config.antialiasing);
    }

    if (config.vignette) {
      this.setupVignette();
    }

    if (config.chromaticAberration) {
      this.setupChromaticAberration();
    }

    this.composer.addPass(this.outputPass);
  }

  private removeEffectPasses(): void {
    // Remove all passes except render pass
    while (this.composer.passes.length > 1) {
      const pass = this.composer.passes[this.composer.passes.length - 1];
      this.composer.removePass(pass);
      if ('dispose' in pass && typeof pass.dispose === 'function') {
        pass.dispose();
      }
    }

    this.bloomPass = null;
    this.ssaoPass = null;
    this.fxaaPass = null;
    this.smaaPass = null;
    this.vignettePass = null;
    this.chromaticPass = null;
  }

  // --------------------------------------------------------------------------
  // Effect Setup
  // --------------------------------------------------------------------------

  private setupBloom(config: BloomConfig): void {
    const { width, height } = this.getScaledSize();

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      config.strength,
      config.radius,
      config.threshold
    );

    this.composer.addPass(this.bloomPass);
  }

  private setupSSAO(config: SSAOConfig): void {
    const { width, height } = this.getScaledSize();

    this.ssaoPass = new SSAOPass(this.scene, this.camera, width, height);
    this.ssaoPass.kernelRadius = config.kernelRadius;
    this.ssaoPass.minDistance = config.minDistance;
    this.ssaoPass.maxDistance = config.maxDistance;

    this.composer.addPass(this.ssaoPass);
  }

  private setupAntialiasing(type: 'none' | 'fxaa' | 'smaa'): void {
    const { width, height } = this.getScaledSize();

    if (type === 'fxaa') {
      this.fxaaPass = new ShaderPass(FXAAShader);
      this.fxaaPass.uniforms['resolution'].value.set(1 / width, 1 / height);
      this.composer.addPass(this.fxaaPass);
    } else if (type === 'smaa') {
      this.smaaPass = new SMAAPass(width, height);
      this.composer.addPass(this.smaaPass);
    }
  }

  private setupVignette(darkness = 1.0, offset = 1.0): void {
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms['darkness'].value = darkness;
    this.vignettePass.uniforms['offset'].value = offset;
    this.composer.addPass(this.vignettePass);
  }

  private setupChromaticAberration(amount = 0.003): void {
    this.chromaticPass = new ShaderPass(ChromaticAberrationShader);
    this.chromaticPass.uniforms['amount'].value = amount;
    this.composer.addPass(this.chromaticPass);
  }

  // --------------------------------------------------------------------------
  // Effect Controls
  // --------------------------------------------------------------------------

  setBloomStrength(strength: number): void {
    if (this.bloomPass) {
      this.bloomPass.strength = strength;
    }
  }

  setBloomThreshold(threshold: number): void {
    if (this.bloomPass) {
      this.bloomPass.threshold = threshold;
    }
  }

  setBloomRadius(radius: number): void {
    if (this.bloomPass) {
      this.bloomPass.radius = radius;
    }
  }

  setSSAORadius(radius: number): void {
    if (this.ssaoPass) {
      this.ssaoPass.kernelRadius = radius;
    }
  }

  setVignetteDarkness(darkness: number): void {
    if (this.vignettePass) {
      this.vignettePass.uniforms['darkness'].value = darkness;
    }
  }

  setChromaticAberrationAmount(amount: number): void {
    if (this.chromaticPass) {
      this.chromaticPass.uniforms['amount'].value = amount;
    }
  }

  enableBloom(enabled: boolean): void {
    if (this.bloomPass) {
      this.bloomPass.enabled = enabled;
    }
  }

  enableSSAO(enabled: boolean): void {
    if (this.ssaoPass) {
      this.ssaoPass.enabled = enabled;
    }
  }

  enableVignette(enabled: boolean): void {
    if (this.vignettePass) {
      this.vignettePass.enabled = enabled;
    }
  }

  enableChromaticAberration(enabled: boolean): void {
    if (this.chromaticPass) {
      this.chromaticPass.enabled = enabled;
    }
  }

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  render(): void {
    this.composer.render();
  }

  private getScaledSize(): { width: number; height: number } {
    return {
      width: Math.floor(window.innerWidth * this.renderScale),
      height: Math.floor(window.innerHeight * this.renderScale)
    };
  }

  updateSize(): void {
    const { width, height } = this.getScaledSize();
    const pixelRatio = this.renderer.getPixelRatio();

    this.composer.setSize(width, height);

    // Update bloom resolution
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }

    // Update SSAO size
    if (this.ssaoPass) {
      this.ssaoPass.setSize(width, height);
    }

    // Update FXAA resolution
    if (this.fxaaPass) {
      this.fxaaPass.uniforms['resolution'].value.set(
        1 / (width * pixelRatio),
        1 / (height * pixelRatio)
      );
    }

    // Update SMAA size
    if (this.smaaPass) {
      this.smaaPass.setSize(width, height);
    }
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  getComposer(): EffectComposer {
    return this.composer;
  }

  getCurrentQuality(): QualityPreset {
    return this.currentQuality;
  }

  addCustomPass(pass: ShaderPass): void {
    // Insert before output pass
    const outputIndex = this.composer.passes.indexOf(this.outputPass);
    if (outputIndex !== -1) {
      this.composer.insertPass(pass, outputIndex);
    } else {
      this.composer.addPass(pass);
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    // Dispose all passes
    for (const pass of this.composer.passes) {
      if ('dispose' in pass && typeof pass.dispose === 'function') {
        pass.dispose();
      }
    }

    this.composer.dispose();
  }
}

// ============================================================================
// Selective Bloom (Bloom on specific objects only)
// ============================================================================

export class SelectiveBloom {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;

  private bloomComposer: EffectComposer;
  private finalComposer: EffectComposer;

  private bloomLayer: THREE.Layers;
  private darkMaterial: THREE.MeshBasicMaterial;
  private materials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();

  static readonly BLOOM_LAYER = 1;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    bloomConfig: BloomConfig = { strength: 1, radius: 0.4, threshold: 0 }
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.bloomLayer = new THREE.Layers();
    this.bloomLayer.set(SelectiveBloom.BLOOM_LAYER);

    this.darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });

    // Bloom composer
    this.bloomComposer = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;

    const renderPass = new RenderPass(scene, camera);
    this.bloomComposer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomConfig.strength,
      bloomConfig.radius,
      bloomConfig.threshold
    );
    this.bloomComposer.addPass(bloomPass);

    // Final composer (blend bloom with scene)
    this.finalComposer = new EffectComposer(renderer);

    const finalRenderPass = new RenderPass(scene, camera);
    this.finalComposer.addPass(finalRenderPass);

    const mixShader = {
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: this.bloomComposer.renderTarget2.texture }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        varying vec2 vUv;

        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec4 bloom = texture2D(tBloom, vUv);
          gl_FragColor = base + bloom;
        }
      `
    };

    const mixPass = new ShaderPass(mixShader);
    mixPass.needsSwap = true;
    this.finalComposer.addPass(mixPass);

    const outputPass = new OutputPass();
    this.finalComposer.addPass(outputPass);
  }

  /**
   * Enable bloom on an object
   */
  enableBloom(object: THREE.Object3D): void {
    object.layers.enable(SelectiveBloom.BLOOM_LAYER);
  }

  /**
   * Disable bloom on an object
   */
  disableBloom(object: THREE.Object3D): void {
    object.layers.disable(SelectiveBloom.BLOOM_LAYER);
  }

  render(): void {
    // Store materials and darken non-bloomed objects
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        if (!this.bloomLayer.test(obj.layers)) {
          this.materials.set(obj, obj.material);
          obj.material = this.darkMaterial;
        }
      }
    });

    // Render bloom
    this.bloomComposer.render();

    // Restore materials
    this.materials.forEach((material, obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.material = material as THREE.Material;
      }
    });
    this.materials.clear();

    // Render final scene with bloom overlay
    this.finalComposer.render();
  }

  updateSize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.bloomComposer.setSize(width, height);
    this.finalComposer.setSize(width, height);
  }

  dispose(): void {
    this.darkMaterial.dispose();
    this.bloomComposer.dispose();
    this.finalComposer.dispose();
  }
}

// ============================================================================
// Usage Example
// ============================================================================

export function createPostProcessingDemo(): {
  postProcessing: PostProcessingManager;
  render: () => void;
  resize: () => void;
  dispose: () => void;
} {
  // Setup Three.js
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111122);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: false }); // Disable built-in AA
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0x404040, 0.5);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 10, 5);
  sun.castShadow = true;
  scene.add(ambient, sun);

  // Add some objects
  const geometry = new THREE.TorusKnotGeometry(1, 0.3, 128, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.2,
    metalness: 0.8,
    roughness: 0.2
  });
  const torusKnot = new THREE.Mesh(geometry, material);
  scene.add(torusKnot);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.9
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  scene.add(ground);

  // Post-processing with quality preset
  const postProcessing = new PostProcessingManager(renderer, scene, camera, {
    quality: 'high',
    bloom: true,
    ssao: true,
    vignette: true
  });

  // Handle resize
  function resize(): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    postProcessing.updateSize();
  }

  window.addEventListener('resize', resize);

  // Animation loop
  const clock = new THREE.Clock();

  function render(): void {
    const elapsed = clock.getElapsedTime();

    // Animate
    torusKnot.rotation.x = elapsed * 0.5;
    torusKnot.rotation.y = elapsed * 0.3;

    // Render with post-processing
    postProcessing.render();
  }

  function animate(): void {
    requestAnimationFrame(animate);
    render();
  }
  animate();

  return {
    postProcessing,
    render,
    resize,
    dispose: () => {
      window.removeEventListener('resize', resize);
      postProcessing.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      document.body.removeChild(renderer.domElement);
    }
  };
}

// ============================================================================
// Mobile Detection and Auto Quality
// ============================================================================

export function detectOptimalQuality(): QualityPreset {
  // Check for mobile
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Check device pixel ratio for high-end phones
    if (window.devicePixelRatio >= 3) {
      return 'medium'; // High-end mobile
    }
    return 'low'; // Low/mid-range mobile
  }

  // Desktop - check GPU capabilities
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

  if (!gl) {
    return 'low';
  }

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (debugInfo) {
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const lowerRenderer = renderer.toLowerCase();

    // Check for integrated graphics
    if (lowerRenderer.includes('intel') || lowerRenderer.includes('integrated')) {
      return 'medium';
    }

    // Check for high-end GPUs
    if (
      lowerRenderer.includes('rtx') ||
      lowerRenderer.includes('radeon rx') ||
      lowerRenderer.includes('geforce gtx 10') ||
      lowerRenderer.includes('geforce gtx 16') ||
      lowerRenderer.includes('geforce rtx')
    ) {
      return 'ultra';
    }
  }

  return 'high'; // Default for unknown desktop GPUs
}
