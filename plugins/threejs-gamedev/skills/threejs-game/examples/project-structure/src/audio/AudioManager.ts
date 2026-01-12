/**
 * Audio Manager
 * Handles music, sound effects, and spatial audio
 */

import * as THREE from 'three';

export class AudioManager {
  private listener: THREE.AudioListener;
  private music: THREE.Audio | null = null;
  private sfxBuffers: Map<string, AudioBuffer> = new Map();
  private sfxPool: Map<string, THREE.Audio[]> = new Map();

  private masterVolume = 1;
  private musicVolume = 0.5;
  private sfxVolume = 0.8;
  private muted = false;

  constructor(camera?: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    if (camera) {
      camera.add(this.listener);
    }
  }

  /**
   * Attach listener to a camera (call this after scene setup).
   */
  attachToCamera(camera: THREE.Camera): void {
    this.listener.parent?.remove(this.listener);
    camera.add(this.listener);
  }

  async loadMusic(_name: string, url: string): Promise<void> {
    const loader = new THREE.AudioLoader();
    const buffer = await loader.loadAsync(url);

    if (!this.music) {
      this.music = new THREE.Audio(this.listener);
    }
    this.music.setBuffer(buffer);
    this.music.setLoop(true);
    this.music.setVolume(this.musicVolume * this.masterVolume);
  }

  async loadSFX(name: string, url: string, poolSize = 5): Promise<void> {
    const loader = new THREE.AudioLoader();
    const buffer = await loader.loadAsync(url);
    this.sfxBuffers.set(name, buffer);

    // Create pool
    const pool: THREE.Audio[] = [];
    for (let i = 0; i < poolSize; i++) {
      const audio = new THREE.Audio(this.listener);
      audio.setBuffer(buffer);
      pool.push(audio);
    }
    this.sfxPool.set(name, pool);
  }

  playMusic(): void {
    if (this.music && !this.music.isPlaying && !this.muted) {
      this.music.play();
    }
  }

  stopMusic(): void {
    if (this.music?.isPlaying) {
      this.music.stop();
    }
  }

  pauseMusic(): void {
    if (this.music?.isPlaying) {
      this.music.pause();
    }
  }

  resumeMusic(): void {
    if (this.music && !this.music.isPlaying && !this.muted) {
      this.music.play();
    }
  }

  playSFX(name: string, volume = 1): THREE.Audio | null {
    if (this.muted) return null;

    const pool = this.sfxPool.get(name);
    if (!pool) {
      console.warn(`SFX "${name}" not loaded`);
      return null;
    }

    // Find available audio
    let audio = pool.find(a => !a.isPlaying);

    if (!audio) {
      // Create new instance if all are busy
      const buffer = this.sfxBuffers.get(name)!;
      audio = new THREE.Audio(this.listener);
      audio.setBuffer(buffer);
      pool.push(audio);
    }

    audio.setVolume(volume * this.sfxVolume * this.masterVolume);
    audio.play();
    return audio;
  }

  createPositionalAudio(
    name: string,
    parent: THREE.Object3D,
    options: { refDistance?: number; maxDistance?: number; loop?: boolean } = {}
  ): THREE.PositionalAudio | null {
    const buffer = this.sfxBuffers.get(name);
    if (!buffer) {
      console.warn(`SFX "${name}" not loaded`);
      return null;
    }

    const audio = new THREE.PositionalAudio(this.listener);
    audio.setBuffer(buffer);
    audio.setRefDistance(options.refDistance ?? 1);
    audio.setMaxDistance(options.maxDistance ?? 100);
    audio.setLoop(options.loop ?? false);
    audio.setVolume(this.sfxVolume * this.masterVolume);

    parent.add(audio);
    return audio;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.music) {
      this.music.setVolume(this.musicVolume * this.masterVolume);
    }
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  mute(): void {
    this.muted = true;
    if (this.music) {
      this.music.setVolume(0);
    }
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
    if (this.music) {
      this.music.setVolume(this.musicVolume * this.masterVolume);
    }
  }

  /**
   * Resume audio context (required for iOS/Safari after user interaction)
   */
  resumeContext(): Promise<void> {
    const context = this.listener.context;
    if (context.state === 'suspended') {
      return context.resume();
    }
    return Promise.resolve();
  }

  dispose(): void {
    this.stopMusic();
    this.listener.parent?.remove(this.listener);

    for (const pool of this.sfxPool.values()) {
      for (const audio of pool) {
        if (audio.isPlaying) audio.stop();
        audio.disconnect();
      }
    }

    this.sfxPool.clear();
    this.sfxBuffers.clear();
  }
}
