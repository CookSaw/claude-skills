/**
 * Three.js + Cannon-es Physics Integration Example
 *
 * Production-ready physics setup with:
 * - World configuration and gravity
 * - Physics-mesh synchronization
 * - Collision detection and events
 * - Character controller basics
 * - Debug visualization
 * - Proper cleanup
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
// import CannonDebugger from 'cannon-es-debugger'; // Optional debug renderer

// ============================================================================
// Types
// ============================================================================

export interface PhysicsObject {
  mesh: THREE.Object3D;
  body: CANNON.Body;
  update?: (delta: number) => void;
}

export interface PhysicsWorldOptions {
  gravity?: THREE.Vector3;
  iterations?: number;
  tolerance?: number;
  allowSleep?: boolean;
}

// ============================================================================
// Physics World Manager
// ============================================================================

export class PhysicsWorld {
  readonly world: CANNON.World;
  private objects: PhysicsObject[] = [];
  private materials: Map<string, CANNON.Material> = new Map();
  // private debugger?: ReturnType<typeof CannonDebugger>;

  // Collision groups
  static readonly GROUP = {
    GROUND: 1,
    PLAYER: 2,
    ENEMY: 4,
    PROJECTILE: 8,
    TRIGGER: 16,
    DEFAULT: 32
  };

  constructor(options: PhysicsWorldOptions = {}) {
    this.world = new CANNON.World();

    // Configure world
    const gravity = options.gravity ?? new THREE.Vector3(0, -9.82, 0);
    this.world.gravity.set(gravity.x, gravity.y, gravity.z);

    // Use SAPBroadphase for better performance with many objects
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Solver settings
    (this.world.solver as CANNON.GSSolver).iterations = options.iterations ?? 10;
    (this.world.solver as CANNON.GSSolver).tolerance = options.tolerance ?? 0.001;

    // Sleep for performance
    this.world.allowSleep = options.allowSleep ?? true;

    // Default material
    this.setupDefaultMaterials();
  }

  private setupDefaultMaterials(): void {
    const defaultMaterial = new CANNON.Material('default');
    const groundMaterial = new CANNON.Material('ground');
    const bouncyMaterial = new CANNON.Material('bouncy');

    this.materials.set('default', defaultMaterial);
    this.materials.set('ground', groundMaterial);
    this.materials.set('bouncy', bouncyMaterial);

    // Default contact material
    const defaultContact = new CANNON.ContactMaterial(
      defaultMaterial,
      defaultMaterial,
      { friction: 0.3, restitution: 0.1 }
    );

    // Ground contact (less bouncy, more friction)
    const groundContact = new CANNON.ContactMaterial(
      groundMaterial,
      defaultMaterial,
      { friction: 0.5, restitution: 0.05 }
    );

    // Bouncy contact
    const bouncyContact = new CANNON.ContactMaterial(
      bouncyMaterial,
      defaultMaterial,
      { friction: 0.1, restitution: 0.9 }
    );

    this.world.addContactMaterial(defaultContact);
    this.world.addContactMaterial(groundContact);
    this.world.addContactMaterial(bouncyContact);
    this.world.defaultContactMaterial = defaultContact;
  }

  getMaterial(name: string): CANNON.Material | undefined {
    return this.materials.get(name);
  }

  // --------------------------------------------------------------------------
  // Object Creation
  // --------------------------------------------------------------------------

  createGround(
    scene: THREE.Scene,
    size = 100,
    position = new THREE.Vector3(0, 0, 0)
  ): PhysicsObject {
    // Three.js mesh
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Cannon.js body
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.materials.get('ground')
    });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    body.position.set(position.x, position.y, position.z);
    body.collisionFilterGroup = PhysicsWorld.GROUP.GROUND;
    this.world.addBody(body);

    const obj = { mesh, body };
    this.objects.push(obj);
    return obj;
  }

  createBox(
    scene: THREE.Scene,
    size: THREE.Vector3,
    position: THREE.Vector3,
    options: {
      mass?: number;
      color?: number;
      material?: string;
      collisionGroup?: number;
      collisionMask?: number;
    } = {}
  ): PhysicsObject {
    const mass = options.mass ?? 1;
    const color = options.color ?? 0x00ff00;

    // Three.js mesh
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Cannon.js body
    const shape = new CANNON.Box(
      new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)
    );
    const body = new CANNON.Body({
      mass,
      shape,
      material: this.materials.get(options.material ?? 'default')
    });
    body.position.set(position.x, position.y, position.z);

    if (options.collisionGroup !== undefined) {
      body.collisionFilterGroup = options.collisionGroup;
    }
    if (options.collisionMask !== undefined) {
      body.collisionFilterMask = options.collisionMask;
    }

    this.world.addBody(body);

    const obj = { mesh, body };
    this.objects.push(obj);
    return obj;
  }

  createSphere(
    scene: THREE.Scene,
    radius: number,
    position: THREE.Vector3,
    options: {
      mass?: number;
      color?: number;
      material?: string;
    } = {}
  ): PhysicsObject {
    const mass = options.mass ?? 1;
    const color = options.color ?? 0xff0000;

    // Three.js mesh
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    scene.add(mesh);

    // Cannon.js body
    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
      mass,
      shape,
      material: this.materials.get(options.material ?? 'default')
    });
    body.position.set(position.x, position.y, position.z);
    this.world.addBody(body);

    const obj = { mesh, body };
    this.objects.push(obj);
    return obj;
  }

  // --------------------------------------------------------------------------
  // Update
  // --------------------------------------------------------------------------

  private readonly FIXED_TIMESTEP = 1 / 60;
  private accumulator = 0;

  update(delta: number): void {
    // Fixed timestep for deterministic physics
    this.accumulator += delta;

    while (this.accumulator >= this.FIXED_TIMESTEP) {
      this.world.step(this.FIXED_TIMESTEP);
      this.accumulator -= this.FIXED_TIMESTEP;
    }

    // Sync Three.js meshes with Cannon.js bodies
    for (const obj of this.objects) {
      if (obj.body.type === CANNON.Body.DYNAMIC) {
        obj.mesh.position.copy(obj.body.position as unknown as THREE.Vector3);
        obj.mesh.quaternion.copy(obj.body.quaternion as unknown as THREE.Quaternion);
      }
      obj.update?.(delta);
    }

    // Update debugger if enabled
    // this.debugger?.update();
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  raycast(
    from: THREE.Vector3,
    to: THREE.Vector3,
    options: { collisionFilterMask?: number } = {}
  ): CANNON.RaycastResult | null {
    const result = new CANNON.RaycastResult();

    this.world.raycastClosest(
      new CANNON.Vec3(from.x, from.y, from.z),
      new CANNON.Vec3(to.x, to.y, to.z),
      { collisionFilterMask: options.collisionFilterMask },
      result
    );

    return result.hasHit ? result : null;
  }

  applyImpulse(body: CANNON.Body, impulse: THREE.Vector3, point?: THREE.Vector3): void {
    const impulseVec = new CANNON.Vec3(impulse.x, impulse.y, impulse.z);
    const pointVec = point
      ? new CANNON.Vec3(point.x, point.y, point.z)
      : body.position;

    body.applyImpulse(impulseVec, pointVec);
  }

  removeObject(obj: PhysicsObject, scene: THREE.Scene): void {
    const index = this.objects.indexOf(obj);
    if (index !== -1) {
      this.objects.splice(index, 1);
      this.world.removeBody(obj.body);
      scene.remove(obj.mesh);

      // Dispose Three.js resources
      if (obj.mesh instanceof THREE.Mesh) {
        obj.mesh.geometry.dispose();
        if (Array.isArray(obj.mesh.material)) {
          obj.mesh.material.forEach(m => m.dispose());
        } else {
          obj.mesh.material.dispose();
        }
      }
    }
  }

  // enableDebug(scene: THREE.Scene): void {
  //   this.debugger = CannonDebugger(scene, this.world, { color: 0x00ff00 });
  // }

  dispose(scene: THREE.Scene): void {
    // Remove all physics objects
    for (const obj of [...this.objects]) {
      this.removeObject(obj, scene);
    }

    // Clear world
    while (this.world.bodies.length > 0) {
      this.world.removeBody(this.world.bodies[0]);
    }

    while (this.world.constraints.length > 0) {
      this.world.removeConstraint(this.world.constraints[0]);
    }
  }
}

// ============================================================================
// Character Controller
// ============================================================================

export class CharacterController {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;

  private readonly moveSpeed = 5;
  private readonly jumpForce = 7;
  private readonly groundCheckDistance = 0.1;

  private isGrounded = false;
  private canJump = true;

  constructor(
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    position: THREE.Vector3
  ) {
    const radius = 0.4;
    const height = 1.0;

    // Visual mesh (capsule approximation)
    const geometry = new THREE.CapsuleGeometry(radius, height, 8, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x0088ff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Physics body (cylinder for simplicity)
    const shape = new CANNON.Cylinder(radius, radius, height + radius * 2, 8);
    this.body = new CANNON.Body({
      mass: 80,
      shape,
      material: physicsWorld.getMaterial('default'),
      fixedRotation: true, // Prevent tipping over
      linearDamping: 0.9,
      angularDamping: 1.0
    });
    this.body.position.set(position.x, position.y, position.z);
    this.body.collisionFilterGroup = PhysicsWorld.GROUP.PLAYER;
    this.body.collisionFilterMask = PhysicsWorld.GROUP.GROUND | PhysicsWorld.GROUP.DEFAULT;

    physicsWorld.world.addBody(this.body);
  }

  update(
    delta: number,
    input: { forward: number; right: number; jump: boolean },
    physicsWorld: PhysicsWorld
  ): void {
    // Ground check
    const from = new THREE.Vector3().copy(this.body.position as unknown as THREE.Vector3);
    const to = from.clone().add(new THREE.Vector3(0, -1.0 - this.groundCheckDistance, 0));
    const hit = physicsWorld.raycast(from, to, {
      collisionFilterMask: PhysicsWorld.GROUP.GROUND
    });
    this.isGrounded = hit !== null;

    // Movement
    const moveDir = new THREE.Vector3(input.right, 0, -input.forward);
    if (moveDir.length() > 0) {
      moveDir.normalize();

      // Apply velocity directly for responsive movement
      this.body.velocity.x = moveDir.x * this.moveSpeed;
      this.body.velocity.z = moveDir.z * this.moveSpeed;
    } else {
      // Stop horizontal movement when no input
      this.body.velocity.x *= 0.9;
      this.body.velocity.z *= 0.9;
    }

    // Jump
    if (input.jump && this.isGrounded && this.canJump) {
      this.body.velocity.y = this.jumpForce;
      this.canJump = false;

      // Reset jump after short delay
      setTimeout(() => {
        this.canJump = true;
      }, 100);
    }

    // Sync mesh position
    this.mesh.position.copy(this.body.position as unknown as THREE.Vector3);
  }

  getPosition(): THREE.Vector3 {
    return new THREE.Vector3().copy(this.body.position as unknown as THREE.Vector3);
  }

  isOnGround(): boolean {
    return this.isGrounded;
  }
}

// ============================================================================
// Usage Example
// ============================================================================

export function createPhysicsDemo(): {
  update: (delta: number) => void;
  dispose: () => void;
} {
  // Setup Three.js
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0x404040, 0.5);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(ambient, sun);

  // Physics world
  const physics = new PhysicsWorld();

  // Create ground
  physics.createGround(scene);

  // Create some boxes
  for (let i = 0; i < 20; i++) {
    const size = new THREE.Vector3(
      0.5 + Math.random() * 0.5,
      0.5 + Math.random() * 0.5,
      0.5 + Math.random() * 0.5
    );
    const position = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      5 + Math.random() * 5,
      (Math.random() - 0.5) * 10
    );
    physics.createBox(scene, size, position, {
      color: Math.random() * 0xffffff
    });
  }

  // Create bouncy balls
  for (let i = 0; i < 5; i++) {
    const radius = 0.3 + Math.random() * 0.2;
    const position = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      8 + Math.random() * 3,
      (Math.random() - 0.5) * 5
    );
    physics.createSphere(scene, radius, position, {
      material: 'bouncy',
      color: 0xff00ff
    });
  }

  // Game loop
  const clock = new THREE.Clock();

  function update(delta: number): void {
    physics.update(delta);
    renderer.render(scene, camera);
  }

  function animate(): void {
    const delta = clock.getDelta();
    update(delta);
    requestAnimationFrame(animate);
  }
  animate();

  // Cleanup
  return {
    update,
    dispose: () => {
      physics.dispose(scene);
      renderer.dispose();
      document.body.removeChild(renderer.domElement);
    }
  };
}
