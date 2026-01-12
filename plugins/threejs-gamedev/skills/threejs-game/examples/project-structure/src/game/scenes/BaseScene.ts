/**
 * Base Scene
 * Abstract base class providing common functionality for game scenes.
 */

import * as THREE from 'three';
import type { GameScene } from '../SceneManager';

/**
 * Abstract base class for game scenes.
 * Provides common functionality like camera setup, lighting, and resize handling.
 *
 * @example
 * ```typescript
 * class MenuScene extends BaseScene {
 *   constructor() {
 *     super('menu');
 *   }
 *
 *   async onEnter(): Promise<void> {
 *     await super.onEnter();
 *     // Setup menu UI
 *   }
 *
 *   update(deltaTime: number): void {
 *     // Update logic
 *   }
 * }
 * ```
 */
export abstract class BaseScene implements GameScene {
  public readonly name: string;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;

  /** Whether scene is currently active */
  protected isActive = false;

  /** Default background color */
  protected backgroundColor: THREE.Color = new THREE.Color(0x1a1a2e);

  /** Ambient light (created in setupLighting) */
  protected ambientLight?: THREE.AmbientLight;

  /** Main directional light (created in setupLighting) */
  protected directionalLight?: THREE.DirectionalLight;

  /**
   * @param name - Unique scene name
   * @param fov - Camera field of view (default: 75)
   * @param near - Camera near plane (default: 0.1)
   * @param far - Camera far plane (default: 1000)
   */
  constructor(name: string, fov = 75, near = 0.1, far = 1000) {
    this.name = name;
    this.scene = new THREE.Scene();
    this.scene.background = this.backgroundColor;

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 2, 5);
  }

  /**
   * Called when scene becomes active.
   * Override to add custom initialization.
   */
  async onEnter(): Promise<void> {
    this.isActive = true;
  }

  /**
   * Called when scene is about to be deactivated.
   * Override to add custom cleanup.
   */
  async onExit(): Promise<void> {
    this.isActive = false;
  }

  /**
   * Called every frame. Must be implemented by subclasses.
   */
  abstract update(deltaTime: number): void;

  /**
   * Render the scene. Override for custom rendering (e.g., post-processing).
   */
  render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize.
   */
  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Dispose scene resources. Override to add custom disposal.
   */
  dispose(): void {
    // Traverse and dispose all objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        for (const material of materials) {
          // Dispose textures
          const texProps = [
            'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
            'envMap', 'alphaMap', 'aoMap', 'displacementMap', 'emissiveMap',
            'metalnessMap', 'roughnessMap'
          ] as const;

          for (const prop of texProps) {
            const texture = (material as any)[prop] as THREE.Texture | undefined;
            texture?.dispose();
          }

          material.dispose();
        }
      }
    });

    // Clear scene
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      if (child) this.scene.remove(child);
    }
  }

  // ===========================================================================
  // Protected Helper Methods
  // ===========================================================================

  /**
   * Setup basic lighting (ambient + directional).
   * Call from onEnter() or constructor.
   */
  protected setupLighting(
    ambientIntensity = 0.4,
    directionalIntensity = 0.8
  ): void {
    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    this.scene.add(this.ambientLight);

    // Directional light (sun-like)
    this.directionalLight = new THREE.DirectionalLight(0xffffff, directionalIntensity);
    this.directionalLight.position.set(5, 10, 7.5);
    this.directionalLight.castShadow = true;

    // Shadow settings
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 50;

    const shadowSize = 10;
    this.directionalLight.shadow.camera.left = -shadowSize;
    this.directionalLight.shadow.camera.right = shadowSize;
    this.directionalLight.shadow.camera.top = shadowSize;
    this.directionalLight.shadow.camera.bottom = -shadowSize;

    this.scene.add(this.directionalLight);
  }

  /**
   * Set background color.
   */
  protected setBackgroundColor(color: THREE.ColorRepresentation): void {
    this.backgroundColor.set(color);
    this.scene.background = this.backgroundColor;
  }

  /**
   * Set fog.
   */
  protected setFog(color: THREE.ColorRepresentation, near: number, far: number): void {
    this.scene.fog = new THREE.Fog(color, near, far);
  }

  /**
   * Add a ground plane.
   */
  protected addGroundPlane(
    size = 100,
    color: THREE.ColorRepresentation = 0x808080
  ): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.2,
    });

    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'ground';

    this.scene.add(ground);
    return ground;
  }

  /**
   * Create a simple grid helper.
   */
  protected addGridHelper(size = 20, divisions = 20): THREE.GridHelper {
    const grid = new THREE.GridHelper(size, divisions, 0x444444, 0x222222);
    this.scene.add(grid);
    return grid;
  }
}
