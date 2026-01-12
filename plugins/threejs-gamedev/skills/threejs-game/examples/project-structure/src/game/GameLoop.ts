/**
 * Game Loop
 * Handles frame timing and update/render cycle
 */

import * as THREE from 'three';

type UpdateCallback = (deltaTime: number) => void;
type RenderCallback = () => void;

export class GameLoop {
  private updateCallback: UpdateCallback;
  private renderCallback: RenderCallback;

  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private _isPaused = false;

  private maxDeltaTime = 0.1; // Prevent spiral of death

  constructor(update: UpdateCallback, render: RenderCallback) {
    this.updateCallback = update;
    this.renderCallback = render;
    this.clock = new THREE.Clock(false);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.tick();
  }

  stop(): void {
    this.isRunning = false;
    this.clock.stop();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  pause(): void {
    this._isPaused = true;
  }

  resume(): void {
    if (this._isPaused) {
      this._isPaused = false;
      this.clock.getDelta(); // Reset delta
    }
  }

  togglePause(): void {
    if (this._isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  isPaused(): boolean {
    return this._isPaused;
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    let deltaTime = this.clock.getDelta();
    deltaTime = Math.min(deltaTime, this.maxDeltaTime);

    if (!this._isPaused) {
      this.updateCallback(deltaTime);
    }

    this.renderCallback();
    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}
