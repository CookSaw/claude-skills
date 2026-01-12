# Three.js Common Errors and Solutions

This guide covers the most frequent errors encountered in Three.js game development, with detailed solutions and debugging strategies.

## Memory Leaks

### Problem: Memory Usage Grows Over Time

Three.js creates WebGL resources (buffers, textures, shader programs) that are not automatically garbage collected.

### Solution: Always Dispose Resources

```typescript
// Complete disposal function
function disposeObject(object: THREE.Object3D): void {
  // Recursively dispose children first
  while (object.children.length > 0) {
    disposeObject(object.children[0]);
  }

  // Dispose geometry
  if (object instanceof THREE.Mesh) {
    if (object.geometry) {
      object.geometry.dispose();
    }

    // Dispose material(s)
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(object.material);
      }
    }
  }

  // Remove from parent
  if (object.parent) {
    object.parent.remove(object);
  }
}

function disposeMaterial(material: THREE.Material): void {
  material.dispose();

  // Dispose all texture types
  const textureProperties = [
    'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
    'envMap', 'alphaMap', 'aoMap', 'displacementMap',
    'emissiveMap', 'metalnessMap', 'roughnessMap'
  ];

  for (const prop of textureProperties) {
    if (prop in material) {
      const texture = (material as any)[prop];
      if (texture instanceof THREE.Texture) {
        texture.dispose();
      }
    }
  }
}
```

### Detecting Memory Leaks

```typescript
// Monitor memory in render loop
function checkMemory(): void {
  const info = renderer.info;
  console.log('Geometries:', info.memory.geometries);
  console.log('Textures:', info.memory.textures);
}

// Use Chrome DevTools:
// 1. Performance tab > Memory checkbox
// 2. Take heap snapshots before/after operations
// 3. Look for increasing "JS Heap" in Performance monitor
```

## WebGL Context Lost

### Problem: 3D Content Disappears

The WebGL context can be lost due to:
- GPU driver crash
- Too many active contexts
- Mobile device resource pressure
- System sleep/wake

### Solution: Handle Context Loss Events

```typescript
const canvas = renderer.domElement;

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  console.warn('WebGL context lost');

  // Stop the render loop
  cancelAnimationFrame(animationId);

  // Show message to user
  showErrorOverlay('Graphics context lost. Please wait...');

  // Attempt recovery
  setTimeout(attemptRecovery, 1000);
});

canvas.addEventListener('webglcontextrestored', () => {
  console.log('WebGL context restored');
  hideErrorOverlay();

  // Reinitialize everything
  initializeRenderer();
  reloadAssets();
  startRenderLoop();
});

function attemptRecovery(): void {
  // Try to restore by forcing context recreation
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_lose_context');
  if (ext) {
    ext.restoreContext();
  }
}
```

### Prevention

```typescript
// Limit active contexts
// Each WebGL context uses GPU memory
// Avoid creating multiple renderers

// For XR, create context with xrCompatible
const renderer = new THREE.WebGLRenderer({
  canvas,
  xrCompatible: true
});

// Properly dispose renderer when done
renderer.dispose();
renderer.forceContextLoss();
```

## Shader Compilation Errors

### Problem: Material Renders Black or Not At All

Shader compilation can fail silently or with cryptic errors.

### Solution: Check Compilation Status

```typescript
// After adding mesh to scene and rendering once
const gl = renderer.getContext();
const programs = renderer.info.programs;

for (const program of programs || []) {
  const glProgram = program.program;

  // Check vertex shader
  const vertexShader = gl.getAttachedShaders(glProgram)?.[0];
  if (vertexShader && !gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
  }

  // Check fragment shader
  const fragmentShader = gl.getAttachedShaders(glProgram)?.[1];
  if (fragmentShader && !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
  }

  // Check program linking
  if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(glProgram));
  }
}
```

### Common Shader Errors

**1. Type Mismatch**
```glsl
// ERROR: alphaTest expects float, not int
material.alphaTest = 1; // Wrong
material.alphaTest = 1.0; // Correct
```

**2. Missing Uniforms**
```typescript
// ShaderMaterial missing required uniform
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2() } // Don't forget this!
  },
  // ...
});
```

**3. Extension Not Supported**
```typescript
// Check extension support before using
const gl = renderer.getContext();
if (!gl.getExtension('OES_texture_float')) {
  console.warn('Float textures not supported, using fallback');
  // Use alternative approach
}
```

## Objects Not Visible

### Problem: Objects Added to Scene But Not Rendered

Common causes and solutions:

### 1. Camera Position/Direction

```typescript
// Camera might be inside or behind the object
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Check object is in view
const frustum = new THREE.Frustum();
const matrix = new THREE.Matrix4();
camera.updateMatrixWorld();
matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
frustum.setFromProjectionMatrix(matrix);
console.log('Object visible:', frustum.containsPoint(object.position));
```

### 2. Scale Issues

```typescript
// Object might be too small or too large
console.log('Object scale:', object.scale);
console.log('Object bounding box:', new THREE.Box3().setFromObject(object));

// Normalize scale for imported models
const box = new THREE.Box3().setFromObject(model);
const size = box.getSize(new THREE.Vector3());
const maxDim = Math.max(size.x, size.y, size.z);
const scale = 5 / maxDim; // Normalize to size 5
model.scale.setScalar(scale);
```

### 3. Material Issues

```typescript
// Check material is visible
console.log('Material visible:', material.visible);
console.log('Material opacity:', material.opacity);
console.log('Material side:', material.side);

// For double-sided visibility
material.side = THREE.DoubleSide;

// For transparent materials
material.transparent = true;
material.opacity = 1.0;
```

### 4. Render Order

```typescript
// Transparent objects need correct render order
transparentObject.renderOrder = 1;

// Or sort manually
renderer.sortObjects = true;
```

## Animation Issues

### Problem: Animations Not Playing or Glitchy

### Solution: Proper AnimationMixer Setup

```typescript
let mixer: THREE.AnimationMixer;
const clock = new THREE.Clock();

// Load model with animations
const gltf = await gltfLoader.loadAsync('model.glb');
const model = gltf.scene;
scene.add(model);

// Create mixer
mixer = new THREE.AnimationMixer(model);

// Play animation
if (gltf.animations.length > 0) {
  const action = mixer.clipAction(gltf.animations[0]);
  action.play();
}

// Update in render loop - CRITICAL!
function animate(): void {
  const delta = clock.getDelta();
  mixer?.update(delta); // Must call every frame
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

### Common Animation Problems

**1. Model Slides Instead of Animates**
```typescript
// Root motion is baked into animation
// Extract and apply to object instead
action.play();
action.getMixer().addEventListener('loop', () => {
  // Handle root motion here
});
```

**2. Animation Speed Wrong**
```typescript
// Adjust time scale
action.setEffectiveTimeScale(0.5); // Half speed
action.setEffectiveTimeScale(2.0); // Double speed
```

**3. Animation Doesn't Loop**
```typescript
action.setLoop(THREE.LoopRepeat, Infinity);
action.clampWhenFinished = false;
```

## Z-Fighting (Flickering Surfaces)

### Problem: Overlapping Surfaces Flicker

When two surfaces are at nearly the same depth, the renderer can't determine which is in front.

### Solution: Adjust Depth

```typescript
// 1. Add small offset
overlappingMesh.position.z += 0.001;

// 2. Use polygon offset
material.polygonOffset = true;
material.polygonOffsetFactor = -1;
material.polygonOffsetUnits = -1;

// 3. Adjust camera near plane
camera.near = 0.1; // Not too small
camera.far = 1000; // Not too large
// Smaller range = better depth precision

// 4. Use logarithmic depth buffer for large scenes
const renderer = new THREE.WebGLRenderer({
  logarithmicDepthBuffer: true
});
```

## Texture Issues

### Problem: Textures Not Loading or Displaying Wrong

### Solution: Check Loading and Settings

```typescript
const textureLoader = new THREE.TextureLoader();

// With error handling
textureLoader.load(
  'texture.png',
  (texture) => {
    // Success
    texture.colorSpace = THREE.SRGBColorSpace;
    material.map = texture;
    material.needsUpdate = true;
  },
  (progress) => {
    // Progress
    console.log('Loading:', (progress.loaded / progress.total) * 100, '%');
  },
  (error) => {
    // Error
    console.error('Texture load failed:', error);
  }
);
```

### Common Texture Problems

**1. Wrong Color Space**
```typescript
// For color textures (diffuse, emissive)
texture.colorSpace = THREE.SRGBColorSpace;

// For data textures (normal, roughness, metalness)
texture.colorSpace = THREE.LinearSRGBColorSpace;
```

**2. Texture Flipped**
```typescript
texture.flipY = false; // For glTF models
```

**3. Texture Blurry**
```typescript
texture.minFilter = THREE.LinearMipmapLinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

**4. Texture Repeating Wrong**
```typescript
texture.wrapS = THREE.RepeatWrapping;
texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set(4, 4);
```

## Cross-Browser/Mobile Compatibility

### Problem: Works on Desktop, Fails on Mobile

### Solution: Feature Detection and Fallbacks

```typescript
// Check WebGL support
import { WebGL } from 'three/addons/capabilities/WebGL.js';

if (!WebGL.isWebGLAvailable()) {
  document.body.appendChild(WebGL.getWebGLErrorMessage());
  throw new Error('WebGL not supported');
}

// Check WebGL 2 support
if (!WebGL.isWebGL2Available()) {
  console.warn('WebGL 2 not available, using fallbacks');
}

// Check specific extensions
const gl = renderer.getContext();
const extensions = {
  floatTextures: gl.getExtension('OES_texture_float'),
  depthTexture: gl.getExtension('WEBGL_depth_texture'),
  anisotropic: gl.getExtension('EXT_texture_filter_anisotropic')
};

// Mobile-specific adjustments
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) {
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;
}
```

### iOS Safari Issues

```typescript
// iOS has stricter memory limits
// Reduce texture sizes on iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
if (isIOS) {
  // Use smaller textures
  // Reduce shadow map size
  // Limit number of draw calls
}

// iOS 17+ context loss issues
// Implement robust context restoration (see WebGL Context Lost section)
```

## Debug Tools Setup

### Stats.js

```typescript
import Stats from 'stats.js';

const stats = new Stats();
stats.dom.style.position = 'absolute';
stats.dom.style.left = '0px';
stats.dom.style.top = '0px';
document.body.appendChild(stats.dom);

function animate(): void {
  stats.begin();
  // ... render
  stats.end();
  requestAnimationFrame(animate);
}
```

### lil-gui (Debug Panel)

```typescript
import GUI from 'lil-gui';

const gui = new GUI();

// Add controls
gui.add(mesh.position, 'x', -10, 10).name('Position X');
gui.add(mesh.position, 'y', -10, 10).name('Position Y');
gui.add(mesh.position, 'z', -10, 10).name('Position Z');

gui.add(material, 'wireframe').name('Wireframe');
gui.addColor({ color: '#ff0000' }, 'color').onChange((value) => {
  material.color.set(value);
});

// Folder organization
const lightFolder = gui.addFolder('Lighting');
lightFolder.add(light, 'intensity', 0, 2);
lightFolder.addColor({ color: '#ffffff' }, 'color');
```

### Scene Helper Visualization

```typescript
// Axes helper
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Grid helper
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

// Camera helper
const cameraHelper = new THREE.CameraHelper(camera);
scene.add(cameraHelper);

// Light helpers
const directionalLightHelper = new THREE.DirectionalLightHelper(light);
scene.add(directionalLightHelper);

// Bounding box helper
const boxHelper = new THREE.BoxHelper(mesh, 0xff0000);
scene.add(boxHelper);

// Skeleton helper for animated models
const skeletonHelper = new THREE.SkeletonHelper(model);
scene.add(skeletonHelper);
```

## Debugging Checklist

When something isn't working:

1. **Check Console**
   - Look for JavaScript errors
   - Check for WebGL warnings

2. **Verify Basics**
   - Is the object added to the scene?
   - Is the camera pointing at it?
   - Is the material visible?

3. **Check renderer.info**
   ```typescript
   console.log(renderer.info);
   ```

4. **Use Helpers**
   - Add AxesHelper to verify orientation
   - Add BoxHelper to see bounding boxes
   - Add CameraHelper to verify frustum

5. **Simplify**
   - Replace complex material with MeshBasicMaterial
   - Replace complex geometry with BoxGeometry
   - Remove post-processing

6. **Profile**
   - Use Stats.js for FPS
   - Use Chrome Performance tab for bottlenecks
   - Use Memory tab for leaks
