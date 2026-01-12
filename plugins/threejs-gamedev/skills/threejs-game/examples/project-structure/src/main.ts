/**
 * Three.js Game - Entry Point
 */

import { Game } from './game/Game';

// Create and start the game
const game = new Game();

// Initialize and start
game.init().then(() => {
  game.start();
}).catch((error) => {
  console.error('Failed to initialize game:', error);
});

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
  game.dispose();
});

// Expose game instance for debugging (optional)
if ((import.meta as any).env?.DEV) {
  (window as any).game = game;
}
