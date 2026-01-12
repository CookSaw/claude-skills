/**
 * Input Manager
 * Handles keyboard, mouse, and touch input
 */

export interface TouchInfo {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
}

export class InputManager {
  private keysDown: Set<string> = new Set();
  private keysJustPressed: Set<string> = new Set();
  private keysJustReleased: Set<string> = new Set();

  private mousePosition = { x: 0, y: 0 };
  private mouseButtons: Set<number> = new Set();
  private mouseJustPressed: Set<number> = new Set();
  private mouseJustReleased: Set<number> = new Set();
  private mouseDelta = { x: 0, y: 0 };

  // Touch support
  private activeTouches: Map<number, TouchInfo> = new Map();
  private touchJustStarted: Map<number, TouchInfo> = new Map();
  private touchJustEnded: Map<number, TouchInfo> = new Map();

  // Gamepad support
  private gamepads: Map<number, Gamepad> = new Map();

  constructor() {
    // Keyboard
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Mouse
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('contextmenu', this.onContextMenu);

    // Touch
    window.addEventListener('touchstart', this.onTouchStart, { passive: false });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('touchcancel', this.onTouchEnd);

    // Gamepad
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);

    // Blur (release all keys when window loses focus)
    window.addEventListener('blur', this.onBlur);
  }

  /**
   * Call at end of each frame to reset just-pressed/released states
   */
  update(): void {
    this.keysJustPressed.clear();
    this.keysJustReleased.clear();
    this.mouseJustPressed.clear();
    this.mouseJustReleased.clear();
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    this.touchJustStarted.clear();
    this.touchJustEnded.clear();

    // Poll gamepads
    this.pollGamepads();
  }

  // --------------------------------------------------------------------------
  // Keyboard
  // --------------------------------------------------------------------------

  isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  isKeyJustPressed(code: string): boolean {
    return this.keysJustPressed.has(code);
  }

  isKeyJustReleased(code: string): boolean {
    return this.keysJustReleased.has(code);
  }

  /**
   * Check if any of the given keys are down
   */
  isAnyKeyDown(codes: string[]): boolean {
    return codes.some(code => this.keysDown.has(code));
  }

  // --------------------------------------------------------------------------
  // Mouse
  // --------------------------------------------------------------------------

  isMouseButtonDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  isMouseButtonJustPressed(button: number): boolean {
    return this.mouseJustPressed.has(button);
  }

  isMouseButtonJustReleased(button: number): boolean {
    return this.mouseJustReleased.has(button);
  }

  getMousePosition(): { x: number; y: number } {
    return { ...this.mousePosition };
  }

  getMouseDelta(): { x: number; y: number } {
    return { ...this.mouseDelta };
  }

  /**
   * Get normalized mouse position (-1 to 1)
   */
  getMouseNormalized(): { x: number; y: number } {
    return {
      x: (this.mousePosition.x / window.innerWidth) * 2 - 1,
      y: -(this.mousePosition.y / window.innerHeight) * 2 + 1
    };
  }

  // --------------------------------------------------------------------------
  // Touch
  // --------------------------------------------------------------------------

  getTouches(): TouchInfo[] {
    return Array.from(this.activeTouches.values());
  }

  getTouch(id: number): TouchInfo | undefined {
    return this.activeTouches.get(id);
  }

  getPrimaryTouch(): TouchInfo | undefined {
    // Get the first (oldest) touch
    for (const touch of this.activeTouches.values()) {
      return touch;
    }
    return undefined;
  }

  getTouchCount(): number {
    return this.activeTouches.size;
  }

  isTouching(): boolean {
    return this.activeTouches.size > 0;
  }

  getTouchJustStarted(): TouchInfo[] {
    return Array.from(this.touchJustStarted.values());
  }

  getTouchJustEnded(): TouchInfo[] {
    return Array.from(this.touchJustEnded.values());
  }

  /**
   * Get normalized touch position (-1 to 1)
   */
  getTouchNormalized(touch: TouchInfo): { x: number; y: number } {
    return {
      x: (touch.x / window.innerWidth) * 2 - 1,
      y: -(touch.y / window.innerHeight) * 2 + 1
    };
  }

  /**
   * Detect swipe gesture
   */
  detectSwipe(
    touch: TouchInfo,
    minDistance = 50,
    maxTime = 300
  ): { direction: 'up' | 'down' | 'left' | 'right'; distance: number } | null {
    const dx = touch.x - touch.startX;
    const dy = touch.y - touch.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const elapsed = performance.now() - touch.startTime;

    if (distance < minDistance || elapsed > maxTime) {
      return null;
    }

    // Determine direction
    if (Math.abs(dx) > Math.abs(dy)) {
      return {
        direction: dx > 0 ? 'right' : 'left',
        distance
      };
    } else {
      return {
        direction: dy > 0 ? 'down' : 'up',
        distance
      };
    }
  }

  /**
   * Detect pinch gesture (requires 2 touches)
   */
  detectPinch(): { scale: number; center: { x: number; y: number } } | null {
    if (this.activeTouches.size !== 2) {
      return null;
    }

    const touches = Array.from(this.activeTouches.values());
    const t1 = touches[0];
    const t2 = touches[1];

    if (!t1 || !t2) return null;

    const currentDist = Math.sqrt(
      Math.pow(t2.x - t1.x, 2) + Math.pow(t2.y - t1.y, 2)
    );

    const startDist = Math.sqrt(
      Math.pow(t2.startX - t1.startX, 2) + Math.pow(t2.startY - t1.startY, 2)
    );

    if (startDist === 0) return null;

    return {
      scale: currentDist / startDist,
      center: {
        x: (t1.x + t2.x) / 2,
        y: (t1.y + t2.y) / 2
      }
    };
  }

  // --------------------------------------------------------------------------
  // Gamepad
  // --------------------------------------------------------------------------

  getGamepad(index: number = 0): Gamepad | null {
    return this.gamepads.get(index) ?? null;
  }

  getGamepadAxis(index: number, axisIndex: number, deadzone = 0.1): number {
    const gamepad = this.gamepads.get(index);
    if (!gamepad) return 0;

    const value = gamepad.axes[axisIndex] ?? 0;
    return Math.abs(value) < deadzone ? 0 : value;
  }

  isGamepadButtonDown(index: number, buttonIndex: number): boolean {
    const gamepad = this.gamepads.get(index);
    if (!gamepad) return false;

    return gamepad.buttons[buttonIndex]?.pressed ?? false;
  }

  private pollGamepads(): void {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad) {
        this.gamepads.set(gamepad.index, gamepad);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------

  /**
   * Check if device supports touch
   */
  isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get unified pointer position (mouse or primary touch)
   */
  getPointerPosition(): { x: number; y: number } {
    const touch = this.getPrimaryTouch();
    if (touch) {
      return { x: touch.x, y: touch.y };
    }
    return this.mousePosition;
  }

  /**
   * Check if pointer is down (mouse button or touch)
   */
  isPointerDown(): boolean {
    return this.mouseButtons.has(0) || this.activeTouches.size > 0;
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  dispose(): void {
    // Keyboard
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    // Mouse
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('contextmenu', this.onContextMenu);

    // Touch
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('touchcancel', this.onTouchEnd);

    // Gamepad
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);

    // Blur
    window.removeEventListener('blur', this.onBlur);

    // Clear state
    this.keysDown.clear();
    this.mouseButtons.clear();
    this.activeTouches.clear();
    this.gamepads.clear();
  }

  // --------------------------------------------------------------------------
  // Event Handlers (arrow functions to preserve 'this')
  // --------------------------------------------------------------------------

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.keysDown.has(event.code)) {
      this.keysJustPressed.add(event.code);
    }
    this.keysDown.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keysDown.delete(event.code);
    this.keysJustReleased.add(event.code);
  };

  private onMouseMove = (event: MouseEvent): void => {
    this.mouseDelta.x += event.movementX;
    this.mouseDelta.y += event.movementY;
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  };

  private onMouseDown = (event: MouseEvent): void => {
    this.mouseButtons.add(event.button);
    this.mouseJustPressed.add(event.button);
  };

  private onMouseUp = (event: MouseEvent): void => {
    this.mouseButtons.delete(event.button);
    this.mouseJustReleased.add(event.button);
  };

  private onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private onTouchStart = (event: TouchEvent): void => {
    // Prevent mouse emulation on touch devices
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches.item(i);
      if (!touch) continue;
      const info: TouchInfo = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now()
      };
      this.activeTouches.set(touch.identifier, info);
      this.touchJustStarted.set(touch.identifier, info);
    }
  };

  private onTouchMove = (event: TouchEvent): void => {
    event.preventDefault();

    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches.item(i);
      if (!touch) continue;
      const info = this.activeTouches.get(touch.identifier);
      if (info) {
        info.x = touch.clientX;
        info.y = touch.clientY;
      }
    }
  };

  private onTouchEnd = (event: TouchEvent): void => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches.item(i);
      if (!touch) continue;
      const info = this.activeTouches.get(touch.identifier);
      if (info) {
        this.touchJustEnded.set(touch.identifier, { ...info });
        this.activeTouches.delete(touch.identifier);
      }
    }
  };

  private onGamepadConnected = (event: GamepadEvent): void => {
    console.log(`Gamepad connected: ${event.gamepad.id}`);
    this.gamepads.set(event.gamepad.index, event.gamepad);
  };

  private onGamepadDisconnected = (event: GamepadEvent): void => {
    console.log(`Gamepad disconnected: ${event.gamepad.id}`);
    this.gamepads.delete(event.gamepad.index);
  };

  private onBlur = (): void => {
    // Release all inputs when window loses focus
    this.keysDown.clear();
    this.mouseButtons.clear();
  };
}
