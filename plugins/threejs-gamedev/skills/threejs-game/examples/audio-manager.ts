/**
 * Three.js Audio Manager Example
 *
 * Production-ready audio system with:
 * - Background music with crossfade
 * - Sound effects pooling
 * - Spatial/positional audio
 * - Volume controls
 * - Mobile audio unlock
 * - Proper cleanup
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface AudioConfig {
  masterVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
  spatialRefDistance?: number;
  spatialMaxDistance?: number;
}

export interface SoundConfig {
  volume?: number;
  loop?: boolean;
  pitch?: number;
  spatial?: boolean;
  refDistance?: number;
  maxDistance?: number;
}

// ============================================================================
// Music Player (Non-Positional Audio)
// ============================================================================

export class MusicPlayer {
  private listener: THREE.AudioListener;
  private currentTrack: THREE.Audio | null = null;
  private tracks: Map<string, AudioBuffer> = new Map();
  private volume = 0.5;

  constructor(listener: THREE.AudioListener) {
    this.listener = listener;
  }

  async loadTrack(name: string, url: string): Promise<void> {
    const loader = new THREE.AudioLoader();
    const buffer = await loader.loadAsync(url);
    this.tracks.set(name, buffer);
  }

  play(name: string, loop = true): void {
    this.stop();

    const buffer = this.tracks.get(name);
    if (!buffer) {
      console.warn(`Music track "${name}" not loaded`);
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

  pause(): void {
    if (this.currentTrack?.isPlaying) {
      this.currentTrack.pause();
    }
  }

  resume(): void {
    if (this.currentTrack && !this.currentTrack.isPlaying) {
      this.currentTrack.play();
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentTrack) {
      this.currentTrack.setVolume(this.volume);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  crossFade(toTrack: string, duration = 2): void {
    const fromTrack = this.currentTrack;
    if (!fromTrack) {
      this.play(toTrack);
      return;
    }

    const buffer = this.tracks.get(toTrack);
    if (!buffer) {
      console.warn(`Music track "${toTrack}" not loaded`);
      return;
    }

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

      // Ease in-out for smooth transition
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      fromTrack.setVolume(fromVolume * (1 - eased));
      newTrack.setVolume(this.volume * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        fromTrack.stop();
        this.currentTrack = newTrack;
      }
    };
    animate();
  }

  isPlaying(): boolean {
    return this.currentTrack?.isPlaying ?? false;
  }

  getCurrentTrack(): THREE.Audio | null {
    return this.currentTrack;
  }

  dispose(): void {
    this.stop();
    this.tracks.clear();
  }
}

// ============================================================================
// Sound Effects Pool
// ============================================================================

export class SFXPool {
  private listener: THREE.AudioListener;
  private pools: Map<string, THREE.Audio[]> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();
  private poolSize: number;
  private volume = 1;

  constructor(listener: THREE.AudioListener, poolSize = 8) {
    this.listener = listener;
    this.poolSize = poolSize;
  }

  async load(name: string, url: string): Promise<void> {
    const loader = new THREE.AudioLoader();
    const buffer = await loader.loadAsync(url);
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

  play(name: string, options: { volume?: number; pitch?: number } = {}): THREE.Audio | null {
    const pool = this.pools.get(name);
    const buffer = this.buffers.get(name);

    if (!pool || !buffer) {
      console.warn(`SFX "${name}" not loaded`);
      return null;
    }

    // Find available audio instance
    let audio = pool.find(a => !a.isPlaying);

    if (!audio) {
      // All instances busy, create new one and add to pool
      audio = new THREE.Audio(this.listener);
      audio.setBuffer(buffer);
      pool.push(audio);
    }

    const finalVolume = (options.volume ?? 1) * this.volume;
    const pitch = options.pitch ?? 1;

    audio.setVolume(finalVolume);
    audio.setPlaybackRate(pitch);
    audio.play();

    return audio;
  }

  playRandomPitch(name: string, volume = 1, pitchVariation = 0.1): THREE.Audio | null {
    const pitch = 1 + (Math.random() - 0.5) * 2 * pitchVariation;
    return this.play(name, { volume, pitch });
  }

  playAtPosition(
    name: string,
    position: THREE.Vector3,
    scene: THREE.Scene,
    options: {
      volume?: number;
      refDistance?: number;
      maxDistance?: number;
    } = {}
  ): THREE.PositionalAudio | null {
    const buffer = this.buffers.get(name);
    if (!buffer) {
      console.warn(`SFX "${name}" not loaded`);
      return null;
    }

    // Create positional audio
    const audio = new THREE.PositionalAudio(this.listener);
    audio.setBuffer(buffer);
    audio.setRefDistance(options.refDistance ?? 1);
    audio.setMaxDistance(options.maxDistance ?? 100);
    audio.setVolume((options.volume ?? 1) * this.volume);

    // Create temporary object at position
    const audioObject = new THREE.Object3D();
    audioObject.position.copy(position);
    audioObject.add(audio);
    scene.add(audioObject);

    // Auto-cleanup when done
    audio.onEnded = () => {
      scene.remove(audioObject);
      audio.disconnect();
    };

    audio.play();
    return audio;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getVolume(): number {
    return this.volume;
  }

  stopAll(): void {
    for (const pool of this.pools.values()) {
      for (const audio of pool) {
        if (audio.isPlaying) {
          audio.stop();
        }
      }
    }
  }

  dispose(): void {
    this.stopAll();
    for (const pool of this.pools.values()) {
      for (const audio of pool) {
        audio.disconnect();
      }
    }
    this.pools.clear();
    this.buffers.clear();
  }
}

// ============================================================================
// Spatial Audio Emitter
// ============================================================================

export class SpatialEmitter {
  readonly audio: THREE.PositionalAudio;
  private parent: THREE.Object3D | null = null;

  constructor(
    listener: THREE.AudioListener,
    buffer: AudioBuffer,
    options: {
      refDistance?: number;
      maxDistance?: number;
      rolloffFactor?: number;
      distanceModel?: string;
      volume?: number;
      loop?: boolean;
    } = {}
  ) {
    this.audio = new THREE.PositionalAudio(listener);
    this.audio.setBuffer(buffer);
    this.audio.setRefDistance(options.refDistance ?? 1);
    this.audio.setMaxDistance(options.maxDistance ?? 100);
    this.audio.setRolloffFactor(options.rolloffFactor ?? 1);
    this.audio.setDistanceModel(options.distanceModel ?? 'inverse');
    this.audio.setVolume(options.volume ?? 1);
    this.audio.setLoop(options.loop ?? false);
  }

  attachTo(object: THREE.Object3D): void {
    if (this.parent) {
      this.parent.remove(this.audio);
    }
    this.parent = object;
    object.add(this.audio);
  }

  detach(): void {
    if (this.parent) {
      this.parent.remove(this.audio);
      this.parent = null;
    }
  }

  play(): void {
    if (this.audio.isPlaying) {
      this.audio.stop();
    }
    this.audio.play();
  }

  stop(): void {
    if (this.audio.isPlaying) {
      this.audio.stop();
    }
  }

  pause(): void {
    if (this.audio.isPlaying) {
      this.audio.pause();
    }
  }

  setVolume(volume: number): void {
    this.audio.setVolume(volume);
  }

  setLoop(loop: boolean): void {
    this.audio.setLoop(loop);
  }

  isPlaying(): boolean {
    return this.audio.isPlaying;
  }

  dispose(): void {
    this.stop();
    this.detach();
    this.audio.disconnect();
  }
}

// ============================================================================
// Complete Audio Manager
// ============================================================================

export class AudioManager {
  private listener: THREE.AudioListener;
  private music: MusicPlayer;
  private sfx: SFXPool;
  private emitters: Set<SpatialEmitter> = new Set();

  private masterVolume = 1;
  private musicVolume = 0.5;
  private sfxVolume = 0.8;
  private muted = false;
  private wasPlayingBeforeMute = false;

  constructor(camera: THREE.Camera, config: AudioConfig = {}) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.masterVolume = config.masterVolume ?? 1;
    this.musicVolume = config.musicVolume ?? 0.5;
    this.sfxVolume = config.sfxVolume ?? 0.8;

    this.music = new MusicPlayer(this.listener);
    this.sfx = new SFXPool(this.listener, 8);

    this.updateVolumes();
  }

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  async loadMusic(name: string, url: string): Promise<void> {
    await this.music.loadTrack(name, url);
  }

  async loadSFX(name: string, url: string): Promise<void> {
    await this.sfx.load(name, url);
  }

  async loadBuffer(url: string): Promise<AudioBuffer> {
    const loader = new THREE.AudioLoader();
    return loader.loadAsync(url);
  }

  // --------------------------------------------------------------------------
  // Music Controls
  // --------------------------------------------------------------------------

  playMusic(name: string, loop = true): void {
    if (this.muted) return;
    this.music.play(name, loop);
  }

  stopMusic(): void {
    this.music.stop();
  }

  pauseMusic(): void {
    this.music.pause();
  }

  resumeMusic(): void {
    if (this.muted) return;
    this.music.resume();
  }

  crossFadeMusic(name: string, duration = 2): void {
    if (this.muted) return;
    this.music.crossFade(name, duration);
  }

  // --------------------------------------------------------------------------
  // SFX Controls
  // --------------------------------------------------------------------------

  playSFX(name: string, volume = 1): THREE.Audio | null {
    if (this.muted) return null;
    return this.sfx.play(name, { volume });
  }

  playSFXRandomized(name: string, volume = 1, pitchVariation = 0.1): THREE.Audio | null {
    if (this.muted) return null;
    return this.sfx.playRandomPitch(name, volume, pitchVariation);
  }

  playSFXAtPosition(
    name: string,
    position: THREE.Vector3,
    scene: THREE.Scene,
    volume = 1
  ): THREE.PositionalAudio | null {
    if (this.muted) return null;
    return this.sfx.playAtPosition(name, position, scene, { volume });
  }

  // --------------------------------------------------------------------------
  // Spatial Audio
  // --------------------------------------------------------------------------

  createSpatialEmitter(
    buffer: AudioBuffer,
    options: {
      refDistance?: number;
      maxDistance?: number;
      volume?: number;
      loop?: boolean;
    } = {}
  ): SpatialEmitter {
    const emitter = new SpatialEmitter(this.listener, buffer, {
      ...options,
      volume: (options.volume ?? 1) * this.sfxVolume * this.masterVolume
    });
    this.emitters.add(emitter);
    return emitter;
  }

  removeEmitter(emitter: SpatialEmitter): void {
    emitter.dispose();
    this.emitters.delete(emitter);
  }

  // --------------------------------------------------------------------------
  // Volume Controls
  // --------------------------------------------------------------------------

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  getSFXVolume(): number {
    return this.sfxVolume;
  }

  private updateVolumes(): void {
    this.music.setVolume(this.musicVolume * this.masterVolume);
    this.sfx.setVolume(this.sfxVolume * this.masterVolume);
  }

  // --------------------------------------------------------------------------
  // Mute Controls
  // --------------------------------------------------------------------------

  mute(): void {
    if (this.muted) return;

    this.wasPlayingBeforeMute = this.music.isPlaying();
    this.muted = true;
    this.music.setVolume(0);
    this.sfx.setVolume(0);

    // Mute all emitters
    for (const emitter of this.emitters) {
      emitter.setVolume(0);
    }
  }

  unmute(): void {
    if (!this.muted) return;

    this.muted = false;
    this.updateVolumes();

    // Restore emitter volumes (approximate)
    for (const emitter of this.emitters) {
      emitter.setVolume(this.sfxVolume * this.masterVolume);
    }
  }

  toggleMute(): boolean {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  // --------------------------------------------------------------------------
  // Mobile Audio Context
  // --------------------------------------------------------------------------

  /**
   * Resume audio context - required for iOS/Safari
   * Call this from a user interaction (click/touch)
   */
  resumeContext(): Promise<void> {
    const context = this.listener.context;
    if (context.state === 'suspended') {
      return context.resume();
    }
    return Promise.resolve();
  }

  getContextState(): AudioContextState {
    return this.listener.context.state;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  stopAll(): void {
    this.music.stop();
    this.sfx.stopAll();
    for (const emitter of this.emitters) {
      emitter.stop();
    }
  }

  dispose(): void {
    this.stopAll();
    this.music.dispose();
    this.sfx.dispose();

    for (const emitter of this.emitters) {
      emitter.dispose();
    }
    this.emitters.clear();

    this.listener.parent?.remove(this.listener);
  }
}

// ============================================================================
// Mobile Audio Unlocker
// ============================================================================

export class MobileAudioUnlocker {
  private unlocked = false;
  private audioManager: AudioManager;
  private onUnlock?: () => void;

  constructor(audioManager: AudioManager, onUnlock?: () => void) {
    this.audioManager = audioManager;
    this.onUnlock = onUnlock;
    this.setupUnlock();
  }

  private setupUnlock(): void {
    const unlock = async (): Promise<void> => {
      if (this.unlocked) return;

      try {
        await this.audioManager.resumeContext();
        this.unlocked = true;
        this.removeListeners();
        console.log('Audio context unlocked');
        this.onUnlock?.();
      } catch (error) {
        console.warn('Failed to unlock audio context:', error);
      }
    };

    const events = ['touchstart', 'touchend', 'click', 'keydown'];
    for (const event of events) {
      document.addEventListener(event, unlock, { once: true, passive: true });
    }
  }

  private removeListeners(): void {
    // Listeners auto-remove with { once: true }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }
}

// ============================================================================
// Usage Example
// ============================================================================

export async function createAudioDemo(
  camera: THREE.Camera,
  scene: THREE.Scene
): Promise<{
  audioManager: AudioManager;
  update: () => void;
  dispose: () => void;
}> {
  // Create audio manager
  const audioManager = new AudioManager(camera, {
    masterVolume: 1,
    musicVolume: 0.5,
    sfxVolume: 0.8
  });

  // Setup mobile unlock
  const unlocker = new MobileAudioUnlocker(audioManager, () => {
    // Start music when unlocked
    audioManager.playMusic('bgm');
  });

  // Load audio assets
  await Promise.all([
    audioManager.loadMusic('bgm', '/audio/music/background.mp3'),
    audioManager.loadMusic('boss', '/audio/music/boss.mp3'),
    audioManager.loadSFX('jump', '/audio/sfx/jump.wav'),
    audioManager.loadSFX('shoot', '/audio/sfx/shoot.wav'),
    audioManager.loadSFX('explosion', '/audio/sfx/explosion.wav'),
    audioManager.loadSFX('pickup', '/audio/sfx/pickup.wav')
  ]);

  // Example: Create spatial emitter for engine sound
  const engineBuffer = await audioManager.loadBuffer('/audio/sfx/engine.wav');
  const engineEmitter = audioManager.createSpatialEmitter(engineBuffer, {
    refDistance: 5,
    maxDistance: 50,
    loop: true,
    volume: 0.5
  });

  // Attach to a vehicle object
  // engineEmitter.attachTo(vehicleMesh);
  // engineEmitter.play();

  // Start background music if already unlocked
  if (unlocker.isUnlocked()) {
    audioManager.playMusic('bgm');
  }

  // Example game events
  function onPlayerJump(): void {
    audioManager.playSFXRandomized('jump', 0.8, 0.15);
  }

  function onExplosion(position: THREE.Vector3): void {
    audioManager.playSFXAtPosition('explosion', position, scene, 1);
  }

  function onBossEncounter(): void {
    audioManager.crossFadeMusic('boss', 3);
  }

  return {
    audioManager,
    update: () => {
      // Audio doesn't need per-frame updates
      // Spatial audio position is handled automatically via Three.js scene graph
    },
    dispose: () => {
      engineEmitter.dispose();
      audioManager.dispose();
    }
  };
}
