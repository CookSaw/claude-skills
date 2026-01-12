/**
 * Physics World Manager
 * Integrates Cannon-es physics with Three.js
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface PhysicsObject {
  mesh: THREE.Object3D;
  body: CANNON.Body;
}

export class PhysicsWorld {
  readonly world: CANNON.World;
  private objects: PhysicsObject[] = [];
  private materials: Map<string, CANNON.Material> = new Map();

  // Collision groups
  static readonly GROUP = {
    GROUND: 1,
    PLAYER: 2,
    ENEMY: 4,
    PROJECTILE: 8,
    TRIGGER: 16,
    DEFAULT: 32
  };

  // Fixed timestep for deterministic physics
  private readonly FIXED_TIMESTEP = 1 / 60;
  private accumulator = 0;

  constructor(gravity = new THREE.Vector3(0, -9.82, 0)) {
    this.world = new CANNON.World();
    this.world.gravity.set(gravity.x, gravity.y, gravity.z);

    // Use SAPBroadphase for better performance
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Enable sleeping for performance
    this.world.allowSleep = true;

    // Setup default materials
    this.setupMaterials();
  }

  private setupMaterials(): void {
    const defaultMat = new CANNON.Material('default');
    const groundMat = new CANNON.Material('ground');
    const bouncyMat = new CANNON.Material('bouncy');

    this.materials.set('default', defaultMat);
    this.materials.set('ground', groundMat);
    this.materials.set('bouncy', bouncyMat);

    // Contact materials
    const defaultContact = new CANNON.ContactMaterial(defaultMat, defaultMat, {
      friction: 0.3,
      restitution: 0.1
    });

    const groundContact = new CANNON.ContactMaterial(groundMat, defaultMat, {
      friction: 0.5,
      restitution: 0.05
    });

    const bouncyContact = new CANNON.ContactMaterial(bouncyMat, defaultMat, {
      friction: 0.1,
      restitution: 0.9
    });

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

  createGround(scene: THREE.Scene, size = 100): PhysicsObject {
    // Three.js mesh
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Cannon.js body
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.materials.get('ground')
    });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
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
    options: { mass?: number; color?: number; material?: string } = {}
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
    }
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

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(scene: THREE.Scene): void {
    // Remove all physics objects
    for (const obj of [...this.objects]) {
      this.removeObject(obj, scene);
    }

    // Clear world
    while (this.world.bodies.length > 0) {
      const body = this.world.bodies[0];
      if (body) this.world.removeBody(body);
    }

    while (this.world.constraints.length > 0) {
      const constraint = this.world.constraints[0];
      if (constraint) this.world.removeConstraint(constraint);
    }
  }
}
