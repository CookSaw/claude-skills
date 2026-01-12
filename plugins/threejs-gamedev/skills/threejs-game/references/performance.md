# Three.js Performance Optimization Guide

This comprehensive guide covers all aspects of optimizing Three.js games for smooth performance across devices.

## Understanding the Render Pipeline

Before optimizing, understand what happens each frame:

1. **JavaScript execution** - Game logic, physics, AI
2. **Style calculations** - CSS updates (minimal in games)
3. **Draw calls** - GPU commands sent to render objects
4. **GPU processing** - Vertex shaders, fragment shaders, compositing

**Target frame times:**
- 60 FPS = 16.67ms per frame
- 30 FPS = 33.33ms per frame

## Render Loop Optimization

### Never Create Objects in the Loop

The most common performance mistake is allocating memory during the render loop:

```typescript
// BAD - Garbage collection will cause stutters
function update() {
  const velocity = new THREE.Vector3(1, 0, 0);
  const rotation = new THREE.Euler(0, Math.PI, 0);
  const matrix = new THREE.Matrix4();
  // ...
}

// GOOD - Pre-allocate and reuse
const _velocity = new THREE.Vector3();
const _rotation = new THREE.Euler();
const _matrix = new THREE.Matrix4();

function update() {
  _velocity.set(1, 0, 0);
  _rotation.set(0, Math.PI, 0);
  _matrix.identity();
  // ...
}
```

### Delta Time for Frame Independence

Always use delta time to ensure consistent behavior regardless of frame rate:

```typescript
const clock = new THREE.Clock();

function gameLoop(): void {
  const delta = clock.getDelta(); // Seconds since last frame

  // Movement is frame-rate independent
  object.position.x += speed * delta;
  object.rotation.y += rotationSpeed * delta;

  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
```

### Conditional Rendering for Static Scenes

For scenes with periods of no change, avoid continuous rendering:

```typescript
let needsRender = true;

function requestRender(): void {
  if (!needsRender) {
    needsRender = true;
    requestAnimationFrame(render);
  }
}

function render(): void {
  needsRender = false;
  renderer.render(scene, camera);
}

// Call requestRender() when something changes
controls.addEventListener('change', requestRender);
```

## Draw Call Management

### Understanding Draw Calls

Each mesh in the scene typically generates one draw call. Monitor with:

```typescript
console.log('Draw calls:', renderer.info.render.calls);
console.log('Triangles:', renderer.info.render.triangles);
console.log('Points:', renderer.info.render.points);
```

### Target Draw Call Counts

| Platform | Target | Maximum |
|----------|--------|---------|
| Mobile | < 100 | 300 |
| Desktop | < 300 | 1000 |
| High-end Desktop | < 500 | 2000 |

### Reducing Draw Calls

**1. Merge Static Geometries**

```typescript
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const geometries: THREE.BufferGeometry[] = [];

// Collect geometries with same material
for (const mesh of staticMeshes) {
  mesh.updateMatrixWorld();
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  geometries.push(geo);
}

const mergedGeometry = mergeGeometries(geometries);
const mergedMesh = new THREE.Mesh(mergedGeometry, sharedMaterial);
scene.add(mergedMesh);
```

**2. Use Texture Atlases**

Combine multiple textures into one to share materials:

```typescript
// Instead of 10 materials with 10 textures
// Use 1 material with 1 atlas texture
// Adjust UV coordinates to sample correct region
```

**3. Batch Similar Objects**

Use InstancedMesh for repeated objects (see Instancing section).

## InstancedMesh for Repeated Objects

InstancedMesh renders thousands of objects in a single draw call:

```typescript
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

// Create 10,000 instances in ONE draw call
const instancedMesh = new THREE.InstancedMesh(geometry, material, 10000);

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const rotation = new THREE.Euler();
const scale = new THREE.Vector3(1, 1, 1);
const quaternion = new THREE.Quaternion();

for (let i = 0; i < 10000; i++) {
  position.set(
    Math.random() * 100 - 50,
    Math.random() * 100 - 50,
    Math.random() * 100 - 50
  );
  rotation.set(
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI
  );
  quaternion.setFromEuler(rotation);

  matrix.compose(position, quaternion, scale);
  instancedMesh.setMatrixAt(i, matrix);
}

instancedMesh.instanceMatrix.needsUpdate = true;
scene.add(instancedMesh);
```

### Updating Individual Instances

```typescript
function updateInstance(index: number, newPosition: THREE.Vector3): void {
  instancedMesh.getMatrixAt(index, matrix);
  matrix.decompose(position, quaternion, scale);
  position.copy(newPosition);
  matrix.compose(position, quaternion, scale);
  instancedMesh.setMatrixAt(index, matrix);
  instancedMesh.instanceMatrix.needsUpdate = true;
}
```

### Instance Colors

```typescript
const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(count * 3), 3
);

const color = new THREE.Color();
for (let i = 0; i < count; i++) {
  color.setHSL(Math.random(), 1, 0.5);
  instancedMesh.setColorAt(i, color);
}
instancedMesh.instanceColor.needsUpdate = true;
```

## Level of Detail (LOD)

Reduce polygon count for distant objects:

```typescript
const lod = new THREE.LOD();

// High detail (close)
const highDetail = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 64),
  material
);
lod.addLevel(highDetail, 0);

// Medium detail
const mediumDetail = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 32),
  material
);
lod.addLevel(mediumDetail, 50);

// Low detail (far)
const lowDetail = new THREE.Mesh(
  new THREE.SphereGeometry(1, 8, 8),
  material
);
lod.addLevel(lowDetail, 100);

// Billboard (very far) - optional
const sprite = new THREE.Sprite(spriteMaterial);
lod.addLevel(sprite, 200);

scene.add(lod);

// Update in render loop
function update(): void {
  lod.update(camera);
}
```

### Automatic LOD Generation

For complex models, generate LOD versions during build:

```bash
# Using gltf-transform CLI
npx @gltf-transform/cli simplify model.glb model-lod.glb --ratio 0.5
```

## Object Pooling

Reuse objects instead of creating/destroying them:

```typescript
class BulletPool {
  private pool: THREE.Mesh[] = [];
  private active: Set<THREE.Mesh> = new Set();
  private geometry: THREE.BufferGeometry;
  private material: THREE.Material;

  constructor(initialSize: number = 50) {
    this.geometry = new THREE.SphereGeometry(0.1);
    this.material = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createBullet());
    }
  }

  private createBullet(): THREE.Mesh {
    const bullet = new THREE.Mesh(this.geometry, this.material);
    bullet.visible = false;
    scene.add(bullet);
    return bullet;
  }

  spawn(position: THREE.Vector3, direction: THREE.Vector3): THREE.Mesh {
    const bullet = this.pool.pop() ?? this.createBullet();
    bullet.position.copy(position);
    bullet.userData.direction = direction.clone();
    bullet.visible = true;
    this.active.add(bullet);
    return bullet;
  }

  despawn(bullet: THREE.Mesh): void {
    bullet.visible = false;
    this.active.delete(bullet);
    this.pool.push(bullet);
  }

  update(delta: number): void {
    for (const bullet of this.active) {
      bullet.position.addScaledVector(bullet.userData.direction, delta * 50);

      // Check bounds and despawn if out of range
      if (bullet.position.length() > 100) {
        this.despawn(bullet);
      }
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    for (const bullet of [...this.pool, ...this.active]) {
      scene.remove(bullet);
    }
  }
}
```

## Frustum Culling

Three.js automatically culls objects outside the camera frustum, but verify it's working:

```typescript
// Ensure frustum culling is enabled (default)
mesh.frustumCulled = true;

// For large objects that might be partially visible
// you may need to expand the bounding sphere
mesh.geometry.computeBoundingSphere();
mesh.geometry.boundingSphere!.radius *= 1.5;
```

### Manual Frustum Culling for Custom Logic

```typescript
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

function updateFrustum(): void {
  camera.updateMatrixWorld();
  projScreenMatrix.multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(projScreenMatrix);
}

function isVisible(object: THREE.Object3D): boolean {
  if (!object.geometry) return true;
  object.geometry.computeBoundingSphere();
  const sphere = object.geometry.boundingSphere!.clone();
  sphere.applyMatrix4(object.matrixWorld);
  return frustum.intersectsSphere(sphere);
}
```

## Texture Optimization

### Power-of-Two Dimensions

Always use power-of-two texture dimensions for best performance:
- 256x256, 512x512, 1024x1024, 2048x2048

### Texture Compression

Use compressed texture formats:

```typescript
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('/basis/');
ktx2Loader.detectSupport(renderer);

const texture = await ktx2Loader.loadAsync('texture.ktx2');
```

### Mipmap Generation

```typescript
const texture = new THREE.TextureLoader().load('texture.png');
texture.generateMipmaps = true;
texture.minFilter = THREE.LinearMipmapLinearFilter;
```

### Texture Disposal

```typescript
function disposeTexture(texture: THREE.Texture): void {
  texture.dispose();
  // If using render targets
  if (texture instanceof THREE.WebGLRenderTarget) {
    texture.dispose();
  }
}
```

## Shadow Optimization

Shadows are expensive. Optimize aggressively:

```typescript
// 1. Limit shadow map size
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 2. Configure light shadows
const light = new THREE.DirectionalLight(0xffffff, 1);
light.castShadow = true;
light.shadow.mapSize.width = 1024;  // Reduce for mobile
light.shadow.mapSize.height = 1024;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 50;
light.shadow.camera.left = -20;
light.shadow.camera.right = 20;
light.shadow.camera.top = 20;
light.shadow.camera.bottom = -20;

// 3. Only cast shadows from important objects
importantMesh.castShadow = true;
groundMesh.receiveShadow = true;
decorativeMesh.castShadow = false; // Don't need shadows

// 4. Consider baked shadows for static scenes
const bakedShadowTexture = textureLoader.load('baked-shadow.png');
```

## Geometry Optimization

### Use BufferGeometry

Always use BufferGeometry (the default in modern Three.js):

```typescript
// Modern approach - BufferGeometry
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([...]);
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
```

### Reduce Vertex Count

```typescript
// Check vertex count
console.log('Vertices:', geometry.attributes.position.count);

// For imported models, use mesh simplification
// in your asset pipeline (Blender, gltf-transform)
```

### Index Buffers

Use indexed geometry when vertices are shared:

```typescript
const geometry = new THREE.BufferGeometry();
const vertices = new Float32Array([...]);
const indices = new Uint16Array([...]); // or Uint32Array for >65535 vertices

geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
geometry.setIndex(new THREE.BufferAttribute(indices, 1));
```

## Profiling Tools

### Stats.js Panel

```typescript
import Stats from 'stats.js';

const stats = new Stats();
stats.showPanel(0); // 0=FPS, 1=MS, 2=MB
document.body.appendChild(stats.dom);

function gameLoop(): void {
  stats.begin();
  // ... game logic
  stats.end();
  requestAnimationFrame(gameLoop);
}
```

### Chrome DevTools Performance Tab

1. Open DevTools (F12)
2. Go to Performance tab
3. Click Record
4. Interact with your game
5. Stop recording
6. Analyze flame chart for bottlenecks

### renderer.info

```typescript
function logRenderInfo(): void {
  const info = renderer.info;
  console.log('Render Info:', {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    points: info.render.points,
    lines: info.render.lines,
    geometries: info.memory.geometries,
    textures: info.memory.textures
  });
}
```

## Mobile-Specific Optimization

```typescript
// Detect mobile
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Apply mobile optimizations
if (isMobile) {
  // 1. Reduce resolution
  renderer.setPixelRatio(1);

  // 2. Disable expensive features
  renderer.shadowMap.enabled = false;

  // 3. Use simpler materials
  material = new THREE.MeshLambertMaterial({ color: 0x00ff00 });

  // 4. Reduce draw distance
  camera.far = 100; // instead of 1000

  // 5. Lower texture quality
  texture.minFilter = THREE.LinearFilter;
}
```

## Performance Checklist

Before shipping, verify:

- [ ] No object creation in render loop
- [ ] Draw calls under target (check `renderer.info.render.calls`)
- [ ] All unused resources disposed
- [ ] Delta time used for all animations
- [ ] LOD implemented for complex models
- [ ] Shadows optimized or disabled on mobile
- [ ] Textures are power-of-two
- [ ] Stats.js shows stable 60 FPS on target devices
- [ ] No memory leaks (monitor with DevTools Memory tab)
- [ ] WebGL context loss handled
