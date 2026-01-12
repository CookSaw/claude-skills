/**
 * Mesh Component
 * Adds a Three.js Mesh to an entity.
 */

import * as THREE from 'three';
import type { Component } from './Component';
import type { Entity } from '../entities/Entity';

/**
 * Component that adds a visual mesh to an entity.
 *
 * @example
 * ```typescript
 * const geometry = new THREE.BoxGeometry(1, 1, 1);
 * const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
 * const meshComp = new MeshComponent(geometry, material);
 *
 * entity.addComponent('mesh', meshComp);
 * ```
 */
export class MeshComponent implements Component {
  entity!: Entity;

  private mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.Material | THREE.Material[];

  /**
   * @param geometry - The geometry for the mesh
   * @param material - The material(s) for the mesh
   */
  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[]
  ) {
    this.geometry = geometry;
    this.material = material;
    this.mesh = new THREE.Mesh(geometry, material);
  }

  /**
   * Called when added to an entity - attaches mesh to entity's object3D.
   */
  onAttach(): void {
    this.entity.object3D.add(this.mesh);
  }

  /**
   * Called when removed from entity - detaches mesh.
   */
  onDetach(): void {
    this.entity.object3D.remove(this.mesh);
  }

  /**
   * Get the underlying Three.js Mesh.
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * Get the mesh's geometry.
   */
  getGeometry(): THREE.BufferGeometry {
    return this.geometry;
  }

  /**
   * Get the mesh's material(s).
   */
  getMaterial(): THREE.Material | THREE.Material[] {
    return this.material;
  }

  /**
   * Set mesh visibility.
   */
  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  /**
   * Check if mesh is visible.
   */
  isVisible(): boolean {
    return this.mesh.visible;
  }

  /**
   * Set whether this mesh casts shadows.
   */
  setCastShadow(cast: boolean): void {
    this.mesh.castShadow = cast;
  }

  /**
   * Set whether this mesh receives shadows.
   */
  setReceiveShadow(receive: boolean): void {
    this.mesh.receiveShadow = receive;
  }

  /**
   * Set mesh color (if material supports it).
   */
  setColor(color: THREE.ColorRepresentation): void {
    const materials = Array.isArray(this.material) ? this.material : [this.material];
    for (const mat of materials) {
      if ('color' in mat) {
        (mat as THREE.MeshStandardMaterial).color.set(color);
      }
    }
  }

  /**
   * Set mesh opacity (if material supports it).
   */
  setOpacity(opacity: number): void {
    const materials = Array.isArray(this.material) ? this.material : [this.material];
    for (const mat of materials) {
      mat.transparent = opacity < 1;
      mat.opacity = opacity;
    }
  }

  /**
   * Set render order for transparency sorting.
   */
  setRenderOrder(order: number): void {
    this.mesh.renderOrder = order;
  }

  /**
   * Dispose geometry and materials.
   */
  dispose(): void {
    this.geometry.dispose();

    const materials = Array.isArray(this.material) ? this.material : [this.material];
    for (const mat of materials) {
      // Dispose textures
      const texProps = [
        'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
        'envMap', 'alphaMap', 'aoMap', 'displacementMap', 'emissiveMap',
        'metalnessMap', 'roughnessMap', 'clearcoatMap', 'clearcoatNormalMap'
      ] as const;

      for (const prop of texProps) {
        const texture = (mat as any)[prop] as THREE.Texture | undefined;
        texture?.dispose();
      }

      mat.dispose();
    }
  }
}

/**
 * Factory functions for common mesh types.
 */
export const MeshFactory = {
  /**
   * Create a box mesh component.
   */
  box(
    width = 1,
    height = 1,
    depth = 1,
    material?: THREE.Material
  ): MeshComponent {
    return new MeshComponent(
      new THREE.BoxGeometry(width, height, depth),
      material ?? new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
  },

  /**
   * Create a sphere mesh component.
   */
  sphere(
    radius = 0.5,
    widthSegments = 32,
    heightSegments = 16,
    material?: THREE.Material
  ): MeshComponent {
    return new MeshComponent(
      new THREE.SphereGeometry(radius, widthSegments, heightSegments),
      material ?? new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
  },

  /**
   * Create a capsule mesh component.
   */
  capsule(
    radius = 0.5,
    length = 1,
    capSegments = 8,
    radialSegments = 16,
    material?: THREE.Material
  ): MeshComponent {
    return new MeshComponent(
      new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments),
      material ?? new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
  },

  /**
   * Create a plane mesh component.
   */
  plane(
    width = 1,
    height = 1,
    material?: THREE.Material
  ): MeshComponent {
    return new MeshComponent(
      new THREE.PlaneGeometry(width, height),
      material ?? new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
  },
} as const;
