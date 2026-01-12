/**
 * Renderer
 * Manages Three.js WebGL renderer, scene, and camera
 */

import * as THREE from 'three';

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  constructor() {
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // Handle resize
    window.addEventListener('resize', this.onResize);

    // Handle context loss
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.onContextLost
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.onContextRestored
    );
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.onContextLost
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.onContextRestored
    );

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    console.warn('WebGL context lost');
  };

  private onContextRestored = (): void => {
    console.log('WebGL context restored');
  };
}
