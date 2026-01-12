/**
 * Game Scene
 * Main gameplay scene with a controllable player.
 */

import * as THREE from 'three';
import { BaseScene } from './BaseScene';
import type { InputManager } from '../../engine/InputManager';
import type { SceneManager } from '../SceneManager';
import { Entity } from '../../entities/Entity';
import { MeshFactory } from '../../components/MeshComponent';
import { MovementComponent, MovementFactory } from '../../components/MovementComponent';
import { HealthComponent } from '../../components/HealthComponent';

/**
 * Main game scene with player controls.
 */
export class GameScene extends BaseScene {
  private inputManager: InputManager;
  private sceneManager: SceneManager;

  // Player
  private player?: Entity;
  private playerMovement?: MovementComponent;
  private playerSpeed = 8;

  // Game state
  private isPaused = false;

  // Pre-allocated vectors for input
  private _moveDirection = new THREE.Vector3();

  constructor(inputManager: InputManager, sceneManager: SceneManager) {
    super('game');
    this.inputManager = inputManager;
    this.sceneManager = sceneManager;

    this.setBackgroundColor(0x87ceeb); // Sky blue
  }

  async onEnter(): Promise<void> {
    await super.onEnter();

    this.setupLighting(0.5, 1);
    this.createEnvironment();
    this.createPlayer();

    // Position camera
    this.camera.position.set(0, 10, 10);
    this.camera.lookAt(0, 0, 0);

    this.isPaused = false;
  }

  async onExit(): Promise<void> {
    // Cleanup player
    this.player?.dispose();
    this.player = undefined;
    this.playerMovement = undefined;

    await super.onExit();
  }

  update(deltaTime: number): void {
    // Check for pause/menu
    if (this.inputManager.isKeyJustPressed('Escape')) {
      this.sceneManager.load('menu');
      return;
    }

    if (this.isPaused) return;

    // Handle player input
    this.handleInput(deltaTime);

    // Update player
    this.player?.update(deltaTime);

    // Update camera to follow player
    this.updateCamera();
  }

  private createEnvironment(): void {
    // Ground
    this.addGroundPlane(50, 0x228b22);

    // Add some decorative elements
    const boxMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.8,
    });

    // Scattered obstacles
    const obstacles = [
      { pos: [5, 0.5, 3], size: [1, 1, 1] },
      { pos: [-4, 0.75, -2], size: [1.5, 1.5, 1.5] },
      { pos: [3, 0.5, -5], size: [1, 1, 1] },
      { pos: [-6, 1, 4], size: [2, 2, 2] },
      { pos: [8, 0.4, -3], size: [0.8, 0.8, 0.8] },
    ];

    for (const { pos, size } of obstacles) {
      const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const mesh = new THREE.Mesh(geometry, boxMaterial);
      mesh.position.set(pos[0]!, pos[1]!, pos[2]!);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    // Add grid for visual reference
    this.addGridHelper(50, 50);
  }

  private createPlayer(): void {
    this.player = new Entity('player');

    // Add mesh (capsule shape)
    const meshComp = MeshFactory.capsule(
      0.4,
      0.8,
      8,
      16,
      new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        roughness: 0.5,
        metalness: 0.3,
      })
    );
    meshComp.setCastShadow(true);
    this.player.addComponent('mesh', meshComp);

    // Add movement
    this.playerMovement = MovementFactory.character({
      maxSpeed: this.playerSpeed,
      gravity: -25,
    });
    this.player.addComponent('movement', this.playerMovement);

    // Add health
    const health = new HealthComponent(100);
    health.onDeath = () => {
      console.log('Player died!');
      this.sceneManager.load('menu');
    };
    this.player.addComponent('health', health);

    // Position player
    this.player.position.set(0, 1, 0);

    // Add to scene
    this.scene.add(this.player.object3D);
  }

  private handleInput(_deltaTime: number): void {
    if (!this.playerMovement) return;

    // Reset move direction
    this._moveDirection.set(0, 0, 0);

    // WASD / Arrow keys
    if (this.inputManager.isKeyDown('KeyW') || this.inputManager.isKeyDown('ArrowUp')) {
      this._moveDirection.z -= 1;
    }
    if (this.inputManager.isKeyDown('KeyS') || this.inputManager.isKeyDown('ArrowDown')) {
      this._moveDirection.z += 1;
    }
    if (this.inputManager.isKeyDown('KeyA') || this.inputManager.isKeyDown('ArrowLeft')) {
      this._moveDirection.x -= 1;
    }
    if (this.inputManager.isKeyDown('KeyD') || this.inputManager.isKeyDown('ArrowRight')) {
      this._moveDirection.x += 1;
    }

    // Normalize and apply movement
    if (this._moveDirection.lengthSq() > 0) {
      this._moveDirection.normalize();
      this.playerMovement.moveInDirection(this._moveDirection, this.playerSpeed);
    } else {
      // Slow down when no input
      this.playerMovement.velocity.x *= 0.9;
      this.playerMovement.velocity.z *= 0.9;
    }

    // Jump
    if (this.inputManager.isKeyJustPressed('Space')) {
      this.playerMovement.jump(12);
    }

    // Gamepad support
    const leftX = this.inputManager.getGamepadAxis(0, 0, 0.15);
    const leftY = this.inputManager.getGamepadAxis(0, 1, 0.15);

    if (Math.abs(leftX) > 0 || Math.abs(leftY) > 0) {
      this._moveDirection.set(leftX, 0, leftY);
      this.playerMovement.moveInDirection(this._moveDirection, this.playerSpeed);
    }

    // Gamepad jump (A button)
    if (this.inputManager.isGamepadButtonDown(0, 0)) {
      this.playerMovement.jump(12);
    }
  }

  private updateCamera(): void {
    if (!this.player) return;

    // Simple top-down follow camera
    const playerPos = this.player.position;
    this.camera.position.x = playerPos.x;
    this.camera.position.z = playerPos.z + 10;
    this.camera.lookAt(playerPos.x, 0, playerPos.z);
  }
}
