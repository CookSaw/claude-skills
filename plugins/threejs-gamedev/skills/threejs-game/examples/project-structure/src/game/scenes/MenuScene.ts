/**
 * Menu Scene
 * Main menu with animated title and start prompt.
 */

import * as THREE from 'three';
import { BaseScene } from './BaseScene';
import type { InputManager } from '../../engine/InputManager';
import type { SceneManager } from '../SceneManager';

/**
 * Main menu scene.
 * Shows a rotating title and "Press Enter to Start" prompt.
 */
export class MenuScene extends BaseScene {
  private inputManager: InputManager;
  private sceneManager: SceneManager;

  // Visual elements
  private titleMesh?: THREE.Mesh;
  private titleGroup?: THREE.Group;

  // Animation state
  private elapsedTime = 0;

  constructor(inputManager: InputManager, sceneManager: SceneManager) {
    super('menu');
    this.inputManager = inputManager;
    this.sceneManager = sceneManager;

    // Darker background for menu
    this.setBackgroundColor(0x0a0a1a);
  }

  async onEnter(): Promise<void> {
    await super.onEnter();

    this.setupLighting(0.3, 0.6);
    this.createTitle();
    this.createStartPrompt();

    // Position camera
    this.camera.position.set(0, 2, 6);
    this.camera.lookAt(0, 0.5, 0);

    this.elapsedTime = 0;
  }

  async onExit(): Promise<void> {
    await super.onExit();
  }

  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    // Animate title
    if (this.titleGroup) {
      this.titleGroup.rotation.y = Math.sin(this.elapsedTime * 0.5) * 0.3;
      this.titleGroup.position.y = 1 + Math.sin(this.elapsedTime * 2) * 0.1;
    }

    // Check for start input
    if (this.inputManager.isKeyJustPressed('Enter') ||
        this.inputManager.isKeyJustPressed('Space')) {
      this.startGame();
    }
  }

  private createTitle(): void {
    this.titleGroup = new THREE.Group();

    // Create a stylized "3D" title using cubes
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      roughness: 0.3,
      metalness: 0.7,
      emissive: 0x003322,
    });

    // Main cube (represents the game)
    const mainGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    this.titleMesh = new THREE.Mesh(mainGeometry, material);
    this.titleMesh.castShadow = true;
    this.titleGroup.add(this.titleMesh);

    // Decorative smaller cubes
    const smallMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      roughness: 0.3,
      metalness: 0.7,
      emissive: 0x002233,
    });

    const positions = [
      [-1.5, 0, 0],
      [1.5, 0, 0],
      [0, 0, 1.5],
      [0, 0, -1.5],
    ];

    for (const [x, y, z] of positions) {
      const smallGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const smallCube = new THREE.Mesh(smallGeometry, smallMaterial);
      smallCube.position.set(x ?? 0, y ?? 0, z ?? 0);
      smallCube.castShadow = true;
      this.titleGroup.add(smallCube);
    }

    this.titleGroup.position.y = 1;
    this.scene.add(this.titleGroup);

    // Add a ground plane for shadows
    this.addGroundPlane(20, 0x111122);
  }

  private createStartPrompt(): void {
    // Create a simple pulsing indicator below the title
    const geometry = new THREE.RingGeometry(0.3, 0.4, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    ring.name = 'startPrompt';
    this.scene.add(ring);
  }

  private startGame(): void {
    this.sceneManager.load('game');
  }
}
