/**
 * Event Emitter Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../../utils/events';

interface TestEvents extends Record<string, unknown> {
  'test:simple': string;
  'test:object': { id: number; name: string };
  'test:void': void;
}

describe('EventEmitter', () => {
  describe('on/emit', () => {
    it('should emit events to listeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback = vi.fn();

      emitter.on('test:simple', callback);
      emitter.emit('test:simple', 'hello');

      expect(callback).toHaveBeenCalledWith('hello');
    });

    it('should emit to multiple listeners', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.on('test:simple', callback1);
      emitter.on('test:simple', callback2);
      emitter.emit('test:simple', 'test');

      expect(callback1).toHaveBeenCalledWith('test');
      expect(callback2).toHaveBeenCalledWith('test');
    });

    it('should handle object data', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback = vi.fn();

      emitter.on('test:object', callback);
      emitter.emit('test:object', { id: 1, name: 'test' });

      expect(callback).toHaveBeenCalledWith({ id: 1, name: 'test' });
    });

    it('should return unsubscribe function', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback = vi.fn();

      const unsubscribe = emitter.on('test:simple', callback);

      emitter.emit('test:simple', 'first');
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      emitter.emit('test:simple', 'second');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('off', () => {
    it('should remove specific listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.on('test:simple', callback1);
      emitter.on('test:simple', callback2);

      emitter.off('test:simple', callback1);
      emitter.emit('test:simple', 'test');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle removing non-existent listener', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback = vi.fn();

      // Should not throw
      emitter.off('test:simple', callback);
    });
  });

  describe('once', () => {
    it('should only call listener once', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback = vi.fn();

      emitter.once('test:simple', callback);

      emitter.emit('test:simple', 'first');
      emitter.emit('test:simple', 'second');
      emitter.emit('test:simple', 'third');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('first');
    });

    it('should return unsubscribe function', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback = vi.fn();

      const unsubscribe = emitter.once('test:simple', callback);
      unsubscribe();

      emitter.emit('test:simple', 'test');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('hasListeners', () => {
    it('should return true when listeners exist', () => {
      const emitter = new EventEmitter<TestEvents>();

      expect(emitter.hasListeners('test:simple')).toBe(false);

      emitter.on('test:simple', () => {});
      expect(emitter.hasListeners('test:simple')).toBe(true);
    });

    it('should return false after all listeners removed', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback = () => {};

      emitter.on('test:simple', callback);
      emitter.off('test:simple', callback);

      expect(emitter.hasListeners('test:simple')).toBe(false);
    });
  });

  describe('listenerCount', () => {
    it('should return correct count', () => {
      const emitter = new EventEmitter<TestEvents>();

      expect(emitter.listenerCount('test:simple')).toBe(0);

      emitter.on('test:simple', () => {});
      expect(emitter.listenerCount('test:simple')).toBe(1);

      emitter.on('test:simple', () => {});
      expect(emitter.listenerCount('test:simple')).toBe(2);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for event', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.on('test:simple', callback1);
      emitter.on('test:simple', callback2);

      emitter.removeAllListeners('test:simple');
      emitter.emit('test:simple', 'test');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should remove all listeners for all events', () => {
      const emitter = new EventEmitter<TestEvents>();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      emitter.on('test:simple', callback1);
      emitter.on('test:object', callback2);

      emitter.clear();

      emitter.emit('test:simple', 'test');
      emitter.emit('test:object', { id: 1, name: 'test' });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should continue emitting after listener error', () => {
      const emitter = new EventEmitter<TestEvents>();
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      emitter.on('test:simple', errorCallback);
      emitter.on('test:simple', normalCallback);

      emitter.emit('test:simple', 'test');

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });
});
