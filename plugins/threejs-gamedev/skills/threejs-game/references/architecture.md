# Three.js Game Architecture Patterns

This guide covers proven architectural patterns for building maintainable and scalable Three.js games.

## Core Principles

1. **Separation of Concerns** - Keep rendering, game logic, and input handling separate
2. **Single Responsibility** - Each class/module does one thing well
3. **Composition over Inheritance** - Prefer composing behaviors over deep inheritance
4. **Testability** - Game logic should be testable without Three.js dependencies

## Basic Game Structure

### Entry Point (main.ts)

```typescript
import { Game } from './game/Game';

const game = new Game();
game.start();

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
  game.dispose();
});
```

### Main Game Class

```typescript
import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';
import { AssetLoader } from '../engine/AssetLoader';
import { InputManager } from '../engine/InputManager';
import { SceneManager } from './SceneManager';
import { GameLoop } from './GameLoop';

export class Game {
  private renderer: Renderer;
  private assetLoader: AssetLoader;
  private inputManager: InputManager;
  private sceneManager: SceneManager;
  private gameLoop: GameLoop;

  constructor() {
    this.renderer = new Renderer();
    this.assetLoader = new AssetLoader();
    this.inputManager = new InputManager();
    this.sceneManager = new SceneManager(this.renderer);
    this.gameLoop = new GameLoop(this.update.bind(this), this.render.bind(this));
  }

  async start(): Promise<void> {
    await this.assetLoader.loadInitialAssets();
    this.sceneManager.loadScene('menu');
    this.gameLoop.start();
  }

  private update(deltaTime: number): void {
    this.inputManager.update();
    this.sceneManager.update(deltaTime);
  }

  private render(): void {
    this.sceneManager.render();
  }

  dispose(): void {
    this.gameLoop.stop();
    this.sceneManager.dispose();
    this.renderer.dispose();
    this.inputManager.dispose();
  }
}
```

## Model-View-Controller (MVC) Pattern

### Model (Game State)

```typescript
// Models have NO references to Three.js, DOM, or rendering

export interface PlayerState {
  position: { x: number; y: number; z: number };
  rotation: number;
  health: number;
  score: number;
}

export class PlayerModel {
  private state: PlayerState = {
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    health: 100,
    score: 0
  };

  move(dx: number, dy: number, dz: number): void {
    this.state.position.x += dx;
    this.state.position.y += dy;
    this.state.position.z += dz;
  }

  rotate(angle: number): void {
    this.state.rotation += angle;
  }

  takeDamage(amount: number): void {
    this.state.health = Math.max(0, this.state.health - amount);
  }

  addScore(points: number): void {
    this.state.score += points;
  }

  getState(): Readonly<PlayerState> {
    return this.state;
  }

  isDead(): boolean {
    return this.state.health <= 0;
  }
}
```

### View (Three.js Representation)

```typescript
import * as THREE from 'three';
import { PlayerModel, PlayerState } from './PlayerModel';

export class PlayerView {
  private mesh: THREE.Mesh;
  private model: PlayerModel;

  constructor(model: PlayerModel, scene: THREE.Scene) {
    this.model = model;

    const geometry = new THREE.CapsuleGeometry(0.5, 1, 8, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);
  }

  update(): void {
    const state = this.model.getState();

    // Sync view with model
    this.mesh.position.set(
      state.position.x,
      state.position.y,
      state.position.z
    );
    this.mesh.rotation.y = state.rotation;

    // Visual feedback for health
    const healthPercent = state.health / 100;
    (this.mesh.material as THREE.MeshStandardMaterial).color.setHSL(
      healthPercent * 0.3, // Green when healthy, red when low
      1,
      0.5
    );
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
```

### Controller (Input to Model)

```typescript
import { PlayerModel } from './PlayerModel';
import { InputManager } from '../engine/InputManager';

export class PlayerController {
  private model: PlayerModel;
  private inputManager: InputManager;
  private speed = 5;
  private rotationSpeed = 2;

  constructor(model: PlayerModel, inputManager: InputManager) {
    this.model = model;
    this.inputManager = inputManager;
  }

  update(deltaTime: number): void {
    const input = this.inputManager;

    // Movement
    let dx = 0, dz = 0;
    if (input.isKeyDown('KeyW')) dz -= 1;
    if (input.isKeyDown('KeyS')) dz += 1;
    if (input.isKeyDown('KeyA')) dx -= 1;
    if (input.isKeyDown('KeyD')) dx += 1;

    // Normalize diagonal movement
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length > 0) {
      dx = (dx / length) * this.speed * deltaTime;
      dz = (dz / length) * this.speed * deltaTime;
      this.model.move(dx, 0, dz);
    }

    // Rotation
    if (input.isKeyDown('KeyQ')) {
      this.model.rotate(this.rotationSpeed * deltaTime);
    }
    if (input.isKeyDown('KeyE')) {
      this.model.rotate(-this.rotationSpeed * deltaTime);
    }
  }
}
```

## Component-Based Architecture

### Base Entity

```typescript
import * as THREE from 'three';

export interface Component {
  entity: Entity;
  update?(deltaTime: number): void;
  dispose?(): void;
}

export class Entity {
  public readonly object3D: THREE.Object3D;
  private components: Map<string, Component> = new Map();
  private children: Entity[] = [];
  public parent: Entity | null = null;

  constructor() {
    this.object3D = new THREE.Object3D();
  }

  addComponent<T extends Component>(name: string, component: T): T {
    component.entity = this;
    this.components.set(name, component);
    return component;
  }

  getComponent<T extends Component>(name: string): T | undefined {
    return this.components.get(name) as T;
  }

  removeComponent(name: string): void {
    const component = this.components.get(name);
    component?.dispose?.();
    this.components.delete(name);
  }

  addChild(child: Entity): void {
    child.parent = this;
    this.children.push(child);
    this.object3D.add(child.object3D);
  }

  update(deltaTime: number): void {
    for (const component of this.components.values()) {
      component.update?.(deltaTime);
    }
    for (const child of this.children) {
      child.update(deltaTime);
    }
  }

  dispose(): void {
    for (const child of this.children) {
      child.dispose();
    }
    for (const component of this.components.values()) {
      component.dispose?.();
    }
    this.components.clear();
    this.object3D.parent?.remove(this.object3D);
  }
}
```

### Example Components

```typescript
// Transform component (built-in via object3D, but can wrap for convenience)
export class TransformComponent implements Component {
  entity!: Entity;

  get position(): THREE.Vector3 {
    return this.entity.object3D.position;
  }

  get rotation(): THREE.Euler {
    return this.entity.object3D.rotation;
  }

  get scale(): THREE.Vector3 {
    return this.entity.object3D.scale;
  }
}

// Mesh component
export class MeshComponent implements Component {
  entity!: Entity;
  private mesh: THREE.Mesh;

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.mesh = new THREE.Mesh(geometry, material);
  }

  onAddedToEntity(): void {
    this.entity.object3D.add(this.mesh);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    } else {
      this.mesh.material.dispose();
    }
    this.entity.object3D.remove(this.mesh);
  }
}

// Movement component
export class MovementComponent implements Component {
  entity!: Entity;
  velocity = new THREE.Vector3();
  acceleration = new THREE.Vector3();
  friction = 0.98;

  update(deltaTime: number): void {
    this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
    this.velocity.multiplyScalar(this.friction);
    this.entity.object3D.position.add(
      this.velocity.clone().multiplyScalar(deltaTime)
    );
  }
}

// Health component
export class HealthComponent implements Component {
  entity!: Entity;
  maxHealth: number;
  currentHealth: number;
  onDeath?: () => void;

  constructor(maxHealth: number) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  takeDamage(amount: number): void {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
    if (this.currentHealth === 0) {
      this.onDeath?.();
    }
  }

  heal(amount: number): void {
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  getHealthPercent(): number {
    return this.currentHealth / this.maxHealth;
  }
}
```

### Using Components

```typescript
// Create a player entity
const player = new Entity();
player.addComponent('mesh', new MeshComponent(
  new THREE.CapsuleGeometry(0.5, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
));
player.addComponent('movement', new MovementComponent());
player.addComponent('health', new HealthComponent(100));

scene.add(player.object3D);

// In update loop
player.update(deltaTime);

// Access components
const health = player.getComponent<HealthComponent>('health');
health?.takeDamage(10);
```

## Scene Management

```typescript
import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';

export interface GameScene {
  name: string;
  scene: THREE.Scene;
  camera: THREE.Camera;
  onEnter(): void;
  onExit(): void;
  update(deltaTime: number): void;
  dispose(): void;
}

export class SceneManager {
  private renderer: Renderer;
  private scenes: Map<string, GameScene> = new Map();
  private currentScene: GameScene | null = null;
  private transitioning = false;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  registerScene(scene: GameScene): void {
    this.scenes.set(scene.name, scene);
  }

  async loadScene(name: string): Promise<void> {
    if (this.transitioning) return;

    const newScene = this.scenes.get(name);
    if (!newScene) {
      console.error(`Scene "${name}" not found`);
      return;
    }

    this.transitioning = true;

    // Exit current scene
    if (this.currentScene) {
      this.currentScene.onExit();
    }

    // Enter new scene
    this.currentScene = newScene;
    this.currentScene.onEnter();

    this.transitioning = false;
  }

  update(deltaTime: number): void {
    if (!this.transitioning && this.currentScene) {
      this.currentScene.update(deltaTime);
    }
  }

  render(): void {
    if (this.currentScene) {
      this.renderer.render(
        this.currentScene.scene,
        this.currentScene.camera
      );
    }
  }

  dispose(): void {
    for (const scene of this.scenes.values()) {
      scene.dispose();
    }
    this.scenes.clear();
  }
}
```

## Event System

```typescript
type EventCallback = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.events.get(event)?.delete(callback);
  }

  emit(event: string, ...args: any[]): void {
    const callbacks = this.events.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(...args);
      }
    }
  }

  once(event: string, callback: EventCallback): void {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  }

  clear(): void {
    this.events.clear();
  }
}

// Global event bus
export const gameEvents = new EventEmitter();

// Usage
gameEvents.on('player:death', () => {
  console.log('Player died!');
});

gameEvents.emit('player:death');
```

## State Machine

```typescript
export interface State<T> {
  name: string;
  onEnter?(context: T): void;
  onExit?(context: T): void;
  update?(context: T, deltaTime: number): void;
}

export class StateMachine<T> {
  private states: Map<string, State<T>> = new Map();
  private currentState: State<T> | null = null;
  private context: T;

  constructor(context: T) {
    this.context = context;
  }

  addState(state: State<T>): void {
    this.states.set(state.name, state);
  }

  setState(name: string): void {
    const newState = this.states.get(name);
    if (!newState) {
      console.error(`State "${name}" not found`);
      return;
    }

    if (this.currentState) {
      this.currentState.onExit?.(this.context);
    }

    this.currentState = newState;
    this.currentState.onEnter?.(this.context);
  }

  update(deltaTime: number): void {
    this.currentState?.update?.(this.context, deltaTime);
  }

  getCurrentState(): string | null {
    return this.currentState?.name ?? null;
  }
}

// Example: Enemy AI states
interface EnemyContext {
  entity: Entity;
  target: Entity | null;
  patrolPoints: THREE.Vector3[];
}

const idleState: State<EnemyContext> = {
  name: 'idle',
  onEnter(ctx) {
    console.log('Enemy is idle');
  },
  update(ctx, deltaTime) {
    // Check for player in range
    if (ctx.target && isInRange(ctx.entity, ctx.target, 10)) {
      enemyStateMachine.setState('chase');
    }
  }
};

const chaseState: State<EnemyContext> = {
  name: 'chase',
  update(ctx, deltaTime) {
    if (!ctx.target) {
      enemyStateMachine.setState('idle');
      return;
    }
    // Move towards target
    moveTowards(ctx.entity, ctx.target.object3D.position, deltaTime);
  }
};
```

## Input Manager

```typescript
export class InputManager {
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  private keysJustReleased: Set<string> = new Set();
  private mousePosition = { x: 0, y: 0 };
  private mouseButtons: Set<number> = new Set();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.keysDown.has(event.code)) {
      this.keysJustPressed.add(event.code);
    }
    this.keysDown.add(event.code);
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keysDown.delete(event.code);
    this.keysJustReleased.add(event.code);
  }

  private onMouseMove(event: MouseEvent): void {
    this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  private onMouseDown(event: MouseEvent): void {
    this.mouseButtons.add(event.button);
  }

  private onMouseUp(event: MouseEvent): void {
    this.mouseButtons.delete(event.button);
  }

  // Call at end of frame to clear just pressed/released
  update(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
  }

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  isKeyJustPressed(code: string): boolean {
    return this.keysJustPressed.has(code);
  }

  isKeyJustReleased(code: string): boolean {
    return this.keysJustReleased.has(code);
  }

  isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
    window.removeEventListener('mousemove', this.onMouseMove.bind(this));
    window.removeEventListener('mousedown', this.onMouseDown.bind(this));
    window.removeEventListener('mouseup', this.onMouseUp.bind(this));
  }
}
```

## Recommended File Structure

```
src/
\u251c\u2500\u2500 main.ts                 # Entry point
\u251c\u2500\u2500 game/
\u2502   \u251c\u2500\u2500 Game.ts             # Main game orchestrator
\u2502   \u251c\u2500\u2500 GameLoop.ts         # Update/render loop
\u2502   \u251c\u2500\u2500 SceneManager.ts     # Scene transitions
\u2502   \u2514\u2500\u2500 scenes/
\u2502       \u251c\u2500\u2500 MenuScene.ts
\u2502       \u251c\u2500\u2500 GameScene.ts
\u2502       \u2514\u2500\u2500 GameOverScene.ts
\u251c\u2500\u2500 engine/
\u2502   \u251c\u2500\u2500 Renderer.ts         # WebGL renderer wrapper
\u2502   \u251c\u2500\u2500 AssetLoader.ts      # Asset loading/caching
\u2502   \u251c\u2500\u2500 InputManager.ts     # Input handling
\u2502   \u251c\u2500\u2500 AudioManager.ts     # Sound/music
\u2502   \u2514\u2500\u2500 PhysicsWorld.ts     # Physics integration
\u251c\u2500\u2500 entities/
\u2502   \u251c\u2500\u2500 Entity.ts           # Base entity class
\u2502   \u251c\u2500\u2500 Player.ts
\u2502   \u251c\u2500\u2500 Enemy.ts
\u2502   \u2514\u2500\u2500 Projectile.ts
\u251c\u2500\u2500 components/
\u2502   \u251c\u2500\u2500 Component.ts        # Base component interface
\u2502   \u251c\u2500\u2500 MeshComponent.ts
\u2502   \u251c\u2500\u2500 MovementComponent.ts
\u2502   \u251c\u2500\u2500 HealthComponent.ts
\u2502   \u2514\u2500\u2500 ColliderComponent.ts
\u251c\u2500\u2500 systems/
\u2502   \u251c\u2500\u2500 PhysicsSystem.ts
\u2502   \u251c\u2500\u2500 CollisionSystem.ts
\u2502   \u2514\u2500\u2500 AISystem.ts
\u251c\u2500\u2500 ui/
\u2502   \u251c\u2500\u2500 HUD.ts
\u2502   \u2514\u2500\u2500 Menu.ts
\u2514\u2500\u2500 utils/
    \u251c\u2500\u2500 math.ts
    \u251c\u2500\u2500 pool.ts
    \u2514\u2500\u2500 events.ts
```

## Best Practices Summary

1. **Keep Models Pure** - No Three.js in game logic
2. **Use Components** - Compose behaviors, don't inherit
3. **Centralize Input** - One InputManager, query state
4. **Event-Driven Communication** - Decouple with events
5. **State Machines for AI** - Clear, debuggable behavior
6. **Scene Abstraction** - Easy level management
7. **Dispose Everything** - Prevent memory leaks
8. **Test Game Logic** - Models are easily unit-testable
