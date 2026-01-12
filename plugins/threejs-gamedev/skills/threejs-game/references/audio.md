# Three.js Audio Guide

This guide covers audio implementation in Three.js games including spatial audio, music, and sound effects.

## Audio System Overview

Three.js provides built-in audio through the Web Audio API:

| Class | Use Case |
|-------|----------|
| `AudioListener` | Ear of the player (attach to camera) |
| `Audio` | Non-positional audio (music, UI sounds) |
| `PositionalAudio` | 3D spatial audio (footsteps, explosions) |

## Basic Setup

```typescript
import * as THREE from 'three';

// Audio listener (the "ear")
const listener = new THREE.AudioListener();
camera.add(listener);

// Audio loader
const audioLoader = new THREE.AudioLoader();
```

## Non-Positional Audio (Background Music)

```typescript
class MusicPlayer {
  private listener: THREE.AudioListener;
  private currentTrack: THREE.Audio | null = null;
  private volume = 0.5;
  private tracks: Map<string, AudioBuffer> = new Map();

  constructor(listener: THREE.AudioListener) {
    this.listener = listener;
  }

  async loadTrack(name: string, url: string): Promise<void> {
    const buffer = await new THREE.AudioLoader().loadAsync(url);
    this.tracks.set(name, buffer);
  }

  play(name: string, loop = true): void {
    this.stop();

    const buffer = this.tracks.get(name);
    if (!buffer) {
      console.warn(`Track "${name}" not loaded`);
      return;
    }

    this.currentTrack = new THREE.Audio(this.listener);
    this.currentTrack.setBuffer(buffer);
    this.currentTrack.setLoop(loop);
    this.currentTrack.setVolume(this.volume);
    this.currentTrack.play();
  }

  stop(): void {
    if (this.currentTrack?.isPlaying) {
      this.currentTrack.stop();
    }
    this.currentTrack = null;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentTrack) {
      this.currentTrack.setVolume(this.volume);
    }
  }

  crossFade(toTrack: string, duration = 2): void {
    const fromTrack = this.currentTrack;
    if (!fromTrack) {
      this.play(toTrack);
      return;
    }

    const buffer = this.tracks.get(toTrack);
    if (!buffer) return;

    // Create new track
    const newTrack = new THREE.Audio(this.listener);
    newTrack.setBuffer(buffer);
    newTrack.setLoop(true);
    newTrack.setVolume(0);
    newTrack.play();

    // Animate crossfade
    const startTime = performance.now();
    const fromVolume = fromTrack.getVolume();

    const animate = (): void => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      fromTrack.setVolume(fromVolume * (1 - progress));
      newTrack.setVolume(this.volume * progress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        fromTrack.stop();
        this.currentTrack = newTrack;
      }
    };
    animate();
  }
}
```

## Positional Audio (3D Sound)

```typescript
class SoundEmitter {
  private sound: THREE.PositionalAudio;

  constructor(
    listener: THREE.AudioListener,
    buffer: AudioBuffer,
    options: {
      refDistance?: number;
      maxDistance?: number;
      rolloffFactor?: number;
      volume?: number;
    } = {}
  ) {
    this.sound = new THREE.PositionalAudio(listener);
    this.sound.setBuffer(buffer);
    this.sound.setRefDistance(options.refDistance ?? 1);
    this.sound.setMaxDistance(options.maxDistance ?? 100);
    this.sound.setRolloffFactor(options.rolloffFactor ?? 1);
    this.sound.setVolume(options.volume ?? 1);
  }

  attachTo(object: THREE.Object3D): void {
    object.add(this.sound);
  }

  play(): void {
    if (this.sound.isPlaying) {
      this.sound.stop();
    }
    this.sound.play();
  }

  stop(): void {
    if (this.sound.isPlaying) {
      this.sound.stop();
    }
  }

  setLoop(loop: boolean): void {
    this.sound.setLoop(loop);
  }
}
```

## Sound Effect Pool

For frequently played sounds (gunshots, footsteps), use pooling:

```typescript
class SFXPool {
  private listener: THREE.AudioListener;
  private pools: Map<string, THREE.Audio[]> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();
  private poolSize: number;

  constructor(listener: THREE.AudioListener, poolSize = 5) {
    this.listener = listener;
    this.poolSize = poolSize;
  }

  async load(name: string, url: string): Promise<void> {
    const buffer = await new THREE.AudioLoader().loadAsync(url);
    this.buffers.set(name, buffer);

    // Pre-create pool
    const pool: THREE.Audio[] = [];
    for (let i = 0; i < this.poolSize; i++) {
      const audio = new THREE.Audio(this.listener);
      audio.setBuffer(buffer);
      pool.push(audio);
    }
    this.pools.set(name, pool);
  }

  play(name: string, volume = 1, pitch = 1): THREE.Audio | null {
    const pool = this.pools.get(name);
    if (!pool) {
      console.warn(`SFX "${name}" not loaded`);
      return null;
    }

    // Find available audio instance
    let audio = pool.find(a => !a.isPlaying);

    if (!audio) {
      // All instances busy, steal oldest or create new
      audio = new THREE.Audio(this.listener);
      audio.setBuffer(this.buffers.get(name)!);
      pool.push(audio);
    }

    audio.setVolume(volume);
    audio.setPlaybackRate(pitch);
    audio.play();
    return audio;
  }

  playRandomPitch(name: string, volume = 1, pitchRange = 0.1): void {
    const pitch = 1 + (Math.random() - 0.5) * 2 * pitchRange;
    this.play(name, volume, pitch);
  }
}
```

## Complete Audio Manager

```typescript
export class AudioManager {
  private listener: THREE.AudioListener;
  private music: MusicPlayer;
  private sfx: SFXPool;
  private masterVolume = 1;
  private musicVolume = 0.5;
  private sfxVolume = 0.8;
  private muted = false;

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.music = new MusicPlayer(this.listener);
    this.sfx = new SFXPool(this.listener, 8);
  }

  async loadMusic(name: string, url: string): Promise<void> {
    await this.music.loadTrack(name, url);
  }

  async loadSFX(name: string, url: string): Promise<void> {
    await this.sfx.load(name, url);
  }

  playMusic(name: string): void {
    if (this.muted) return;
    this.music.setVolume(this.musicVolume * this.masterVolume);
    this.music.play(name);
  }

  stopMusic(): void {
    this.music.stop();
  }

  crossFadeMusic(name: string, duration = 2): void {
    if (this.muted) return;
    this.music.crossFade(name, duration);
  }

  playSFX(name: string, volume = 1): void {
    if (this.muted) return;
    this.sfx.play(name, volume * this.sfxVolume * this.masterVolume);
  }

  playSFXRandomized(name: string, volume = 1): void {
    if (this.muted) return;
    this.sfx.playRandomPitch(name, volume * this.sfxVolume * this.masterVolume);
  }

  createPositionalSound(
    buffer: AudioBuffer,
    parent: THREE.Object3D,
    options?: { refDistance?: number; maxDistance?: number }
  ): SoundEmitter {
    const emitter = new SoundEmitter(this.listener, buffer, {
      ...options,
      volume: this.sfxVolume * this.masterVolume
    });
    emitter.attachTo(parent);
    return emitter;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  mute(): void {
    this.muted = true;
    this.music.setVolume(0);
  }

  unmute(): void {
    this.muted = false;
    this.updateVolumes();
  }

  toggleMute(): boolean {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  private updateVolumes(): void {
    this.music.setVolume(this.musicVolume * this.masterVolume);
  }

  // Required for iOS/Safari - must be called from user interaction
  resumeContext(): void {
    if (this.listener.context.state === 'suspended') {
      this.listener.context.resume();
    }
  }

  dispose(): void {
    this.music.stop();
    this.listener.parent?.remove(this.listener);
  }
}
```

## Mobile Audio Restrictions

iOS and many mobile browsers require user interaction before playing audio:

```typescript
class MobileAudioUnlocker {
  private unlocked = false;
  private audioManager: AudioManager;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
    this.setupUnlock();
  }

  private setupUnlock(): void {
    const unlock = (): void => {
      if (this.unlocked) return;

      this.audioManager.resumeContext();
      this.unlocked = true;

      // Remove listeners
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('touchend', unlock);
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);

      console.log('Audio context unlocked');
    };

    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('touchend', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }
}

// Usage
const unlocker = new MobileAudioUnlocker(audioManager);

// Show "Tap to start" on mobile
if (!unlocker.isUnlocked()) {
  showTapToStartScreen();
}
```

## Audio Sprites

For many short sounds, use audio sprites:

```typescript
interface SpriteDefinition {
  start: number; // Start time in seconds
  duration: number; // Duration in seconds
}

class AudioSprite {
  private audio: THREE.Audio;
  private sprites: Map<string, SpriteDefinition>;

  constructor(
    listener: THREE.AudioListener,
    buffer: AudioBuffer,
    sprites: Record<string, SpriteDefinition>
  ) {
    this.audio = new THREE.Audio(listener);
    this.audio.setBuffer(buffer);
    this.sprites = new Map(Object.entries(sprites));
  }

  play(spriteName: string): void {
    const sprite = this.sprites.get(spriteName);
    if (!sprite) return;

    if (this.audio.isPlaying) {
      this.audio.stop();
    }

    this.audio.offset = sprite.start;
    this.audio.duration = sprite.duration;
    this.audio.play();
  }
}

// Example sprite sheet definition
const uiSprites = {
  click: { start: 0, duration: 0.1 },
  hover: { start: 0.2, duration: 0.05 },
  confirm: { start: 0.3, duration: 0.2 },
  cancel: { start: 0.6, duration: 0.15 }
};
```

## Audio Distance Models

```typescript
// Linear distance model
positionalAudio.setDistanceModel('linear');
positionalAudio.setRefDistance(1);
positionalAudio.setMaxDistance(100);
// Volume = 1 - rolloff * (distance - ref) / (max - ref)

// Inverse distance model (default, more realistic)
positionalAudio.setDistanceModel('inverse');
positionalAudio.setRefDistance(1);
positionalAudio.setRolloffFactor(1);
// Volume = ref / (ref + rolloff * (distance - ref))

// Exponential distance model
positionalAudio.setDistanceModel('exponential');
positionalAudio.setRefDistance(1);
positionalAudio.setRolloffFactor(1);
// Volume = (distance / ref) ^ -rolloff
```

## Best Practices

### Audio Format Recommendations

| Format | Browser Support | Use Case |
|--------|-----------------|----------|
| MP3 | Universal | Music, long audio |
| OGG | Chrome, Firefox, Edge | Music alternative |
| WAV | Universal | Short SFX (no compression) |
| WebM | Chrome, Firefox | Alternative for SFX |

### Loading Strategy

```typescript
// Preload critical sounds
await Promise.all([
  audioManager.loadSFX('jump', '/audio/jump.mp3'),
  audioManager.loadSFX('land', '/audio/land.mp3'),
  audioManager.loadSFX('shoot', '/audio/shoot.mp3')
]);

// Load music in background
audioManager.loadMusic('level1', '/audio/music/level1.mp3');
```

### Memory Management

```typescript
function disposeAudio(audio: THREE.Audio | THREE.PositionalAudio): void {
  if (audio.isPlaying) {
    audio.stop();
  }
  audio.disconnect();
  audio.parent?.remove(audio);
}
```
