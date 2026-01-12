# Three.js Shaders Guide

This guide covers custom shaders in Three.js using GLSL and the new Three Shading Language (TSL).

## Shader Basics

### How Shaders Work in Three.js

```
Vertex Shader    →    Fragment Shader
(per vertex)          (per pixel)
     ↓                      ↓
Position, UV          Color output
```

### ShaderMaterial vs RawShaderMaterial

| Type | Includes Built-ins | Use Case |
|------|-------------------|----------|
| `ShaderMaterial` | Yes (uniforms, attributes) | Most cases |
| `RawShaderMaterial` | No | Full control |

## Basic ShaderMaterial

```typescript
import * as THREE from 'three';

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x00ff00) },
    uTexture: { value: texture }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform sampler2D uTexture;

    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vec4 texColor = texture2D(uTexture, vUv);
      vec3 light = normalize(vec3(1.0, 1.0, 1.0));
      float diff = max(dot(vNormal, light), 0.0);

      gl_FragColor = vec4(uColor * texColor.rgb * diff, 1.0);
    }
  `
});

// Update in game loop
material.uniforms.uTime.value += delta;
```

## GLSL Essentials

### Data Types

```glsl
// Scalars
float f = 1.0;
int i = 1;
bool b = true;

// Vectors
vec2 v2 = vec2(1.0, 2.0);
vec3 v3 = vec3(1.0, 2.0, 3.0);
vec4 v4 = vec4(1.0, 2.0, 3.0, 1.0);

// Swizzling
vec3 color = v4.rgb;
vec2 uv = v3.xy;
float r = v4.r; // Same as v4.x

// Matrices
mat2 m2;
mat3 m3;
mat4 m4;

// Samplers
sampler2D tex2D;
samplerCube texCube;
```

### Built-in Functions

```glsl
// Math
abs(x), sign(x), floor(x), ceil(x), fract(x)
min(a, b), max(a, b), clamp(x, min, max)
mix(a, b, t)  // Linear interpolation
step(edge, x) // 0 if x < edge, else 1
smoothstep(edge0, edge1, x) // Smooth interpolation

// Vector
length(v), distance(a, b), normalize(v)
dot(a, b), cross(a, b), reflect(I, N)

// Trigonometry
sin(x), cos(x), tan(x)
asin(x), acos(x), atan(y, x)

// Texture
texture2D(sampler, uv)
textureCube(sampler, direction)
```

### Three.js Built-in Uniforms

```glsl
// Automatically provided by ShaderMaterial
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;

// Attributes (vertex shader only)
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
```

## Common Shader Effects

### Fresnel Effect (Rim Lighting)

```typescript
const fresnelShader = {
  uniforms: {
    uFresnelPower: { value: 2.0 },
    uFresnelColor: { value: new THREE.Color(0x00ffff) }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uFresnelPower;
    uniform vec3 uFresnelColor;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      float fresnel = pow(1.0 - dot(vNormal, vViewDir), uFresnelPower);
      gl_FragColor = vec4(uFresnelColor * fresnel, fresnel);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending
};
```

### Dissolve Effect

```typescript
const dissolveShader = {
  uniforms: {
    uProgress: { value: 0 },
    uNoiseScale: { value: 5.0 },
    uEdgeColor: { value: new THREE.Color(0xff5500) },
    uEdgeWidth: { value: 0.1 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uProgress;
    uniform float uNoiseScale;
    uniform vec3 uEdgeColor;
    uniform float uEdgeWidth;
    varying vec2 vUv;
    varying vec3 vPosition;

    // Simple noise function
    float noise(vec3 p) {
      return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    }

    void main() {
      float n = noise(vPosition * uNoiseScale);

      if (n < uProgress) {
        discard;
      }

      float edge = smoothstep(uProgress, uProgress + uEdgeWidth, n);
      vec3 color = mix(uEdgeColor, vec3(1.0), edge);

      gl_FragColor = vec4(color, 1.0);
    }
  `
};
```

### Water/Liquid Surface

```typescript
const waterShader = {
  uniforms: {
    uTime: { value: 0 },
    uWaveHeight: { value: 0.1 },
    uWaveSpeed: { value: 1.0 },
    uColor: { value: new THREE.Color(0x0077be) }
  },
  vertexShader: `
    uniform float uTime;
    uniform float uWaveHeight;
    uniform float uWaveSpeed;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;

      vec3 pos = position;
      float wave1 = sin(pos.x * 4.0 + uTime * uWaveSpeed) * uWaveHeight;
      float wave2 = sin(pos.y * 3.0 + uTime * uWaveSpeed * 0.8) * uWaveHeight * 0.5;
      pos.z += wave1 + wave2;

      vElevation = pos.z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float brightness = vElevation * 5.0 + 0.5;
      vec3 color = uColor * brightness;
      gl_FragColor = vec4(color, 0.8);
    }
  `,
  transparent: true
};
```

### Hologram Effect

```typescript
const hologramShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x00ffff) },
    uScanlineCount: { value: 100.0 },
    uGlitchIntensity: { value: 0.1 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(cameraPosition - worldPos.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uScanlineCount;
    uniform float uGlitchIntensity;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      // Fresnel
      float fresnel = pow(1.0 - dot(vNormal, vViewDir), 3.0);

      // Scanlines
      float scanline = sin(vUv.y * uScanlineCount + uTime * 5.0) * 0.5 + 0.5;

      // Glitch
      float glitch = step(0.99, sin(uTime * 50.0)) * uGlitchIntensity;

      // Combine
      float alpha = fresnel * 0.8 + scanline * 0.2 + glitch;
      vec3 color = uColor + glitch * vec3(1.0, 0.0, 0.0);

      gl_FragColor = vec4(color, alpha * 0.7);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false
};
```

## Three Shading Language (TSL)

TSL is Three.js's new node-based shader system (r160+):

```typescript
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uv, sin, time, vec3, color, mix,
  normalWorld, viewportUV, texture
} from 'three/tsl';

// Create node material
const material = new MeshStandardNodeMaterial();

// Animated color based on UV
material.colorNode = mix(
  color(0xff0000),
  color(0x0000ff),
  sin(uv().y.mul(10).add(time))
);

// Fresnel-like effect
const fresnel = normalWorld.dot(vec3(0, 0, 1)).oneMinus().pow(2);
material.emissiveNode = color(0x00ffff).mul(fresnel);
```

### TSL Common Nodes

```typescript
import {
  // Math
  sin, cos, abs, floor, fract, clamp, mix, step, smoothstep,
  min, max, pow, sqrt, length, normalize, dot, cross,

  // Values
  float, vec2, vec3, vec4, color, time,

  // Attributes
  uv, position, normal, tangent,

  // Uniforms
  uniform,

  // Textures
  texture, cubeTexture,

  // Screen
  viewportUV, screenUV,

  // Utilities
  If, Loop, Fn
} from 'three/tsl';
```

### TSL Example: Gradient Shader

```typescript
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uv, mix, color } from 'three/tsl';

const material = new MeshBasicNodeMaterial();

// Vertical gradient
material.colorNode = mix(
  color(0xff0000), // Bottom color
  color(0x0000ff), // Top color
  uv().y           // Interpolation factor
);
```

## Extending Built-in Materials

### onBeforeCompile

```typescript
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

material.onBeforeCompile = (shader) => {
  // Add custom uniform
  shader.uniforms.uTime = { value: 0 };

  // Modify vertex shader
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
    #include <begin_vertex>
    transformed.y += sin(transformed.x * 5.0 + uTime) * 0.2;
    `
  );

  // Store reference for updates
  material.userData.shader = shader;
};

// Update in game loop
if (material.userData.shader) {
  material.userData.shader.uniforms.uTime.value += delta;
}
```

## Debugging Shaders

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Black output | Division by zero, NaN | Check math operations |
| No effect | Wrong uniform name | Verify spelling |
| Artifacts | Precision issues | Use `highp float` |
| Missing texture | Texture not loaded | Wait for load |

### Visual Debugging

```glsl
// Output normal as color
gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);

// Output UV as color
gl_FragColor = vec4(vUv, 0.0, 1.0);

// Output depth
float depth = gl_FragCoord.z;
gl_FragColor = vec4(vec3(depth), 1.0);

// Output specific value
gl_FragColor = vec4(vec3(someValue), 1.0);
```

### Chrome DevTools

1. Open DevTools → Sources
2. Find shader code in "(no domain)" sources
3. Look for compilation errors in console

### Shader Validation Tool

```typescript
function validateShader(
  gl: WebGLRenderingContext,
  source: string,
  type: number
): string | null {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return error;
  }

  gl.deleteShader(shader);
  return null;
}

// Usage
const gl = renderer.getContext();
const error = validateShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
if (error) console.error('Shader error:', error);
```

## Performance Tips

### Shader Optimization

```glsl
// AVOID: Complex math in fragment shader
float expensive = pow(sin(x) * cos(y), 2.0);

// BETTER: Precompute in vertex shader or JavaScript
// Pass as varying or uniform

// AVOID: Branching
if (condition) {
  color = vec3(1.0);
} else {
  color = vec3(0.0);
}

// BETTER: Use step/mix
color = mix(vec3(0.0), vec3(1.0), step(0.5, value));

// AVOID: Texture lookups in loops
for (int i = 0; i < 10; i++) {
  color += texture2D(tex, uv + offset[i]);
}

// BETTER: Unroll loops or use fewer samples
```

### Precision Qualifiers

```glsl
// Mobile optimization
precision mediump float; // Default for fragments
precision highp float;   // When needed (positions, time)

// Per-variable precision
highp float time;
mediump vec3 color;
lowp float intensity;
```

## External Resources

- [The Book of Shaders](https://thebookofshaders.com/)
- [Shadertoy](https://www.shadertoy.com/)
- [LYGIA Shader Library](https://lygia.xyz/)
- [Three.js Shader Examples](https://threejs.org/examples/?q=shader)
