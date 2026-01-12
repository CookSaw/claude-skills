# Three.js Physics Integration Guide

This guide covers physics engine integration with Three.js for realistic game mechanics.

## Physics Engine Comparison

| Engine | Size | Performance | Features | Best For |
|--------|------|-------------|----------|----------|
| **Cannon-es** | ~150KB | Good | Basic physics | Simple games, learning |
| **Rapier** | ~500KB (WASM) | Excellent | Advanced | Production games |
| **Ammo.js** | ~900KB | Good | Full Bullet | Complex simulations |
| **Oimo.js** | ~150KB | Good | Basic | Lightweight needs |

## Cannon-es Integration

### Installation

```bash
npm install cannon-es @types/cannon-es
```

### Basic Setup

```typescript
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

// Ground
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane()
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Three.js ground mesh
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x333333 })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);
```

### Physics-Mesh Synchronization

```typescript
interface PhysicsObject {
  mesh: THREE.Mesh;
  body: CANNON.Body;
}

const physicsObjects: PhysicsObject[] = [];

function createPhysicsBox(
  size: THREE.Vector3,
  position: THREE.Vector3,
  mass: number = 1
): PhysicsObject {
  // Three.js mesh
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.position.copy(position);
  scene.add(mesh);

  // Cannon.js body
  const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
  const body = new CANNON.Body({ mass, shape });
  body.position.set(position.x, position.y, position.z);
  world.addBody(body);

  const obj = { mesh, body };
  physicsObjects.push(obj);
  return obj;
}

function createPhysicsSphere(
  radius: number,
  position: THREE.Vector3,
  mass: number = 1
): PhysicsObject {
  const geometry = new THREE.SphereGeometry(radius);
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);

  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({ mass, shape });
  body.position.set(position.x, position.y, position.z);
  world.addBody(body);

  const obj = { mesh, body };
  physicsObjects.push(obj);
  return obj;
}

// Sync in game loop
function updatePhysics(delta: number): void {
  world.step(1 / 60, delta, 3);

  for (const obj of physicsObjects) {
    obj.mesh.position.copy(obj.body.position as unknown as THREE.Vector3);
    obj.mesh.quaternion.copy(obj.body.quaternion as unknown as THREE.Quaternion);
  }
}
```

### Material Properties

```typescript
// Default material
const defaultMaterial = new CANNON.Material('default');

// Contact material (defines interaction)
const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.3,
    restitution: 0.3 // Bounciness
  }
);
world.addContactMaterial(defaultContactMaterial);
world.defaultContactMaterial = defaultContactMaterial;

// Apply to bodies
body.material = defaultMaterial;
```

### Collision Events

```typescript
body.addEventListener('collide', (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
  const impactVelocity = event.contact.getImpactVelocityAlongNormal();

  if (impactVelocity > 1.5) {
    // Play impact sound
    playSound('impact', Math.min(impactVelocity / 10, 1));
  }
});
```

### Raycasting

```typescript
function physicsRaycast(
  from: THREE.Vector3,
  to: THREE.Vector3
): CANNON.RaycastResult | null {
  const result = new CANNON.RaycastResult();

  world.raycastClosest(
    new CANNON.Vec3(from.x, from.y, from.z),
    new CANNON.Vec3(to.x, to.y, to.z),
    {},
    result
  );

  return result.hasHit ? result : null;
}

// Example: Check ground below player
const groundCheck = physicsRaycast(
  player.position,
  player.position.clone().add(new THREE.Vector3(0, -1.1, 0))
);
const isGrounded = groundCheck !== null;
```

## Rapier Integration

### Installation

```bash
npm install @dimforge/rapier3d-compat
```

### Setup with Async Initialization

```typescript
import RAPIER from '@dimforge/rapier3d-compat';

let world: RAPIER.World;
let eventQueue: RAPIER.EventQueue;

async function initPhysics(): Promise<void> {
  await RAPIER.init();

  const gravity = { x: 0, y: -9.82, z: 0 };
  world = new RAPIER.World(gravity);
  eventQueue = new RAPIER.EventQueue(true);
}

// Call before game starts
await initPhysics();
```

### Rapier Bodies

```typescript
interface RapierObject {
  mesh: THREE.Mesh;
  rigidBody: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

const rapierObjects: RapierObject[] = [];

function createRapierBox(
  size: THREE.Vector3,
  position: THREE.Vector3,
  isDynamic: boolean = true
): RapierObject {
  // Three.js mesh
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  scene.add(mesh);

  // Rapier rigid body
  const rigidBodyDesc = isDynamic
    ? RAPIER.RigidBodyDesc.dynamic()
    : RAPIER.RigidBodyDesc.fixed();
  rigidBodyDesc.setTranslation(position.x, position.y, position.z);

  const rigidBody = world.createRigidBody(rigidBodyDesc);

  // Collider
  const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
  const collider = world.createCollider(colliderDesc, rigidBody);

  const obj = { mesh, rigidBody, collider };
  rapierObjects.push(obj);
  return obj;
}

function updateRapierPhysics(): void {
  world.step(eventQueue);

  for (const obj of rapierObjects) {
    const position = obj.rigidBody.translation();
    const rotation = obj.rigidBody.rotation();

    obj.mesh.position.set(position.x, position.y, position.z);
    obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  // Handle collision events
  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    if (started) {
      console.log('Collision started between', handle1, handle2);
    }
  });
}
```

## Debug Visualization

### Cannon-es Debug Renderer

```typescript
import CannonDebugger from 'cannon-es-debugger';

const cannonDebugger = CannonDebugger(scene, world, {
  color: 0x00ff00,
  scale: 1
});

// In game loop (only in development)
if (import.meta.env.DEV) {
  cannonDebugger.update();
}
```

### Custom Debug Lines

```typescript
class PhysicsDebugRenderer {
  private lines: THREE.LineSegments;
  private positions: Float32Array;

  constructor(scene: THREE.Scene, maxLines: number = 10000) {
    this.positions = new Float32Array(maxLines * 6);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      vertexColors: false
    });

    this.lines = new THREE.LineSegments(geometry, material);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  update(world: CANNON.World): void {
    let index = 0;

    for (const body of world.bodies) {
      const pos = body.position;

      // Draw velocity vector
      const vel = body.velocity;
      this.positions[index++] = pos.x;
      this.positions[index++] = pos.y;
      this.positions[index++] = pos.z;
      this.positions[index++] = pos.x + vel.x;
      this.positions[index++] = pos.y + vel.y;
      this.positions[index++] = pos.z + vel.z;
    }

    this.lines.geometry.setDrawRange(0, index / 3);
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
```

## Character Controller

### Basic Character with Cannon-es

```typescript
class CharacterController {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  private moveDirection = new THREE.Vector3();
  private isGrounded = false;

  readonly moveSpeed = 5;
  readonly jumpForce = 8;

  constructor(scene: THREE.Scene, world: CANNON.World, position: THREE.Vector3) {
    // Capsule approximation using cylinder + spheres
    const radius = 0.3;
    const height = 1.0;

    // Visual mesh
    const geometry = new THREE.CapsuleGeometry(radius, height, 8, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Physics body (simplified as cylinder)
    const shape = new CANNON.Cylinder(radius, radius, height + radius * 2, 8);
    this.body = new CANNON.Body({
      mass: 80,
      shape,
      fixedRotation: true, // Prevent tipping
      linearDamping: 0.9
    });
    this.body.position.set(position.x, position.y, position.z);
    world.addBody(this.body);
  }

  update(delta: number, input: { x: number; z: number; jump: boolean }): void {
    // Ground check
    this.checkGrounded();

    // Movement
    this.moveDirection.set(input.x, 0, input.z).normalize();

    if (this.moveDirection.length() > 0) {
      const velocity = this.body.velocity;
      velocity.x = this.moveDirection.x * this.moveSpeed;
      velocity.z = this.moveDirection.z * this.moveSpeed;
    }

    // Jump
    if (input.jump && this.isGrounded) {
      this.body.velocity.y = this.jumpForce;
    }

    // Sync mesh
    this.mesh.position.copy(this.body.position as unknown as THREE.Vector3);
  }

  private checkGrounded(): void {
    const start = this.body.position;
    const end = new CANNON.Vec3(start.x, start.y - 1.1, start.z);

    const result = new CANNON.RaycastResult();
    world.raycastClosest(start, end, { collisionFilterMask: ~0 }, result);

    this.isGrounded = result.hasHit;
  }
}
```

## Performance Tips

### Collision Groups

```typescript
// Define collision groups
const GROUP_GROUND = 1;
const GROUP_PLAYER = 2;
const GROUP_ENEMY = 4;
const GROUP_PROJECTILE = 8;

// Player collides with ground and enemies
playerBody.collisionFilterGroup = GROUP_PLAYER;
playerBody.collisionFilterMask = GROUP_GROUND | GROUP_ENEMY;

// Projectiles collide with enemies only
projectileBody.collisionFilterGroup = GROUP_PROJECTILE;
projectileBody.collisionFilterMask = GROUP_ENEMY;
```

### Sleep Optimization

```typescript
// Enable sleeping for static/slow objects
world.allowSleep = true;

// Configure sleep thresholds
body.sleepSpeedLimit = 0.1;
body.sleepTimeLimit = 1;

// Wake up body programmatically
body.wakeUp();
```

### Fixed Timestep

```typescript
const FIXED_TIMESTEP = 1 / 60;
let accumulator = 0;

function updatePhysics(delta: number): void {
  accumulator += delta;

  while (accumulator >= FIXED_TIMESTEP) {
    world.step(FIXED_TIMESTEP);
    accumulator -= FIXED_TIMESTEP;
  }

  // Interpolate for smooth rendering
  const alpha = accumulator / FIXED_TIMESTEP;
  for (const obj of physicsObjects) {
    // Lerp between previous and current position
    obj.mesh.position.lerpVectors(
      obj.previousPosition,
      obj.body.position as unknown as THREE.Vector3,
      alpha
    );
  }
}
```

## Common Patterns

### Trigger Zones

```typescript
function createTrigger(
  position: THREE.Vector3,
  size: THREE.Vector3,
  onEnter: (body: CANNON.Body) => void
): CANNON.Body {
  const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
  const body = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape,
    isTrigger: true
  });
  body.position.set(position.x, position.y, position.z);

  body.addEventListener('collide', (event) => {
    onEnter(event.body);
  });

  world.addBody(body);
  return body;
}
```

### Constraints

```typescript
// Distance constraint (rope-like)
const distance = new CANNON.DistanceConstraint(bodyA, bodyB, 2);
world.addConstraint(distance);

// Point-to-point constraint (ball joint)
const p2p = new CANNON.PointToPointConstraint(
  bodyA,
  new CANNON.Vec3(0, 0.5, 0),
  bodyB,
  new CANNON.Vec3(0, -0.5, 0)
);
world.addConstraint(p2p);

// Hinge constraint (door)
const hinge = new CANNON.HingeConstraint(bodyA, bodyB, {
  pivotA: new CANNON.Vec3(0.5, 0, 0),
  pivotB: new CANNON.Vec3(-0.5, 0, 0),
  axisA: new CANNON.Vec3(0, 1, 0),
  axisB: new CANNON.Vec3(0, 1, 0)
});
world.addConstraint(hinge);
```

## Cleanup

```typescript
function disposePhysics(): void {
  // Remove all bodies
  while (world.bodies.length > 0) {
    world.removeBody(world.bodies[0]);
  }

  // Remove all constraints
  while (world.constraints.length > 0) {
    world.removeConstraint(world.constraints[0]);
  }

  // Clear arrays
  physicsObjects.length = 0;
}
```
