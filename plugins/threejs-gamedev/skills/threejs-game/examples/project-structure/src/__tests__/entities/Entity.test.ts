/**
 * Entity Tests
 */

import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Entity } from '../../entities/Entity';
import type { Component } from '../../components/Component';

// Mock component for testing
class MockComponent implements Component {
  entity!: Entity;
  updateCalls: number[] = [];
  disposed = false;
  attached = false;
  detached = false;

  update(deltaTime: number): void {
    this.updateCalls.push(deltaTime);
  }

  dispose(): void {
    this.disposed = true;
  }

  onAttach(): void {
    this.attached = true;
  }

  onDetach(): void {
    this.detached = true;
  }
}

describe('Entity', () => {
  describe('initialization', () => {
    it('should create with auto-generated id', () => {
      const entity = new Entity();
      expect(entity.id).toMatch(/^entity_/);
    });

    it('should create with custom id', () => {
      const entity = new Entity('player');
      expect(entity.id).toBe('player');
    });

    it('should create an Object3D', () => {
      const entity = new Entity();
      expect(entity.object3D).toBeInstanceOf(THREE.Object3D);
    });

    it('should be active by default', () => {
      const entity = new Entity();
      expect(entity.active).toBe(true);
    });
  });

  describe('component management', () => {
    it('should add and retrieve components', () => {
      const entity = new Entity();
      const component = new MockComponent();

      entity.addComponent('test', component);
      expect(entity.getComponent('test')).toBe(component);
    });

    it('should set entity reference on component', () => {
      const entity = new Entity();
      const component = new MockComponent();

      entity.addComponent('test', component);
      expect(component.entity).toBe(entity);
    });

    it('should call onAttach when adding component', () => {
      const entity = new Entity();
      const component = new MockComponent();

      entity.addComponent('test', component);
      expect(component.attached).toBe(true);
    });

    it('should check if component exists', () => {
      const entity = new Entity();
      const component = new MockComponent();

      expect(entity.hasComponent('test')).toBe(false);
      entity.addComponent('test', component);
      expect(entity.hasComponent('test')).toBe(true);
    });

    it('should remove components', () => {
      const entity = new Entity();
      const component = new MockComponent();

      entity.addComponent('test', component);
      entity.removeComponent('test');

      expect(entity.hasComponent('test')).toBe(false);
      expect(component.detached).toBe(true);
      expect(component.disposed).toBe(true);
    });

    it('should replace existing components with warning', () => {
      const entity = new Entity();
      const comp1 = new MockComponent();
      const comp2 = new MockComponent();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      entity.addComponent('test', comp1);
      entity.addComponent('test', comp2);

      expect(warnSpy).toHaveBeenCalled();
      expect(entity.getComponent('test')).toBe(comp2);
      expect(comp1.disposed).toBe(true);

      warnSpy.mockRestore();
    });

    it('should return component names', () => {
      const entity = new Entity();
      entity.addComponent('a', new MockComponent());
      entity.addComponent('b', new MockComponent());

      const names = entity.getComponentNames();
      expect(names).toContain('a');
      expect(names).toContain('b');
    });
  });

  describe('child entities', () => {
    it('should add child entities', () => {
      const parent = new Entity('parent');
      const child = new Entity('child');

      parent.addChild(child);

      expect(child.parent).toBe(parent);
      expect(parent.getChildren()).toContain(child);
    });

    it('should add child to Object3D hierarchy', () => {
      const parent = new Entity('parent');
      const child = new Entity('child');

      parent.addChild(child);

      expect(parent.object3D.children).toContain(child.object3D);
    });

    it('should remove child entities', () => {
      const parent = new Entity('parent');
      const child = new Entity('child');

      parent.addChild(child);
      parent.removeChild(child);

      expect(child.parent).toBeNull();
      expect(parent.getChildren()).not.toContain(child);
    });

    it('should transfer child from one parent to another', () => {
      const parent1 = new Entity('parent1');
      const parent2 = new Entity('parent2');
      const child = new Entity('child');

      parent1.addChild(child);
      parent2.addChild(child);

      expect(child.parent).toBe(parent2);
      expect(parent1.getChildren()).not.toContain(child);
      expect(parent2.getChildren()).toContain(child);
    });

    it('should find child by id', () => {
      const parent = new Entity('parent');
      const child1 = new Entity('child1');
      const child2 = new Entity('child2');
      const grandchild = new Entity('grandchild');

      parent.addChild(child1);
      parent.addChild(child2);
      child1.addChild(grandchild);

      expect(parent.findChild('child1')).toBe(child1);
      expect(parent.findChild('grandchild')).toBe(grandchild);
      expect(parent.findChild('nonexistent')).toBeUndefined();
    });

    it('should find entities by tag', () => {
      const parent = new Entity('parent');
      const child1 = new Entity('child1');
      const child2 = new Entity('child2');

      child1.tags.add('enemy');
      child2.tags.add('enemy');
      child2.tags.add('boss');

      parent.addChild(child1);
      parent.addChild(child2);

      const enemies = parent.findByTag('enemy');
      expect(enemies).toContain(child1);
      expect(enemies).toContain(child2);

      const bosses = parent.findByTag('boss');
      expect(bosses).toContain(child2);
      expect(bosses).not.toContain(child1);
    });
  });

  describe('update', () => {
    it('should update all components', () => {
      const entity = new Entity();
      const comp1 = new MockComponent();
      const comp2 = new MockComponent();

      entity.addComponent('a', comp1);
      entity.addComponent('b', comp2);

      entity.update(0.016);

      expect(comp1.updateCalls).toContain(0.016);
      expect(comp2.updateCalls).toContain(0.016);
    });

    it('should update children', () => {
      const parent = new Entity('parent');
      const child = new Entity('child');
      const childComp = new MockComponent();

      child.addComponent('test', childComp);
      parent.addChild(child);

      parent.update(0.016);

      expect(childComp.updateCalls).toContain(0.016);
    });

    it('should not update when inactive', () => {
      const entity = new Entity();
      const comp = new MockComponent();
      entity.addComponent('test', comp);

      entity.active = false;
      entity.update(0.016);

      expect(comp.updateCalls).toHaveLength(0);
    });
  });

  describe('dispose', () => {
    it('should dispose all components', () => {
      const entity = new Entity();
      const comp1 = new MockComponent();
      const comp2 = new MockComponent();

      entity.addComponent('a', comp1);
      entity.addComponent('b', comp2);

      entity.dispose();

      expect(comp1.disposed).toBe(true);
      expect(comp2.disposed).toBe(true);
    });

    it('should dispose children', () => {
      const parent = new Entity('parent');
      const child = new Entity('child');
      const childComp = new MockComponent();

      child.addComponent('test', childComp);
      parent.addChild(child);

      parent.dispose();

      expect(childComp.disposed).toBe(true);
    });

    it('should remove from parent', () => {
      const parent = new Entity('parent');
      const child = new Entity('child');

      parent.addChild(child);
      child.dispose();

      expect(parent.getChildren()).not.toContain(child);
    });
  });

  describe('transform helpers', () => {
    it('should provide position access', () => {
      const entity = new Entity();
      entity.position.set(1, 2, 3);

      expect(entity.position.x).toBe(1);
      expect(entity.position.y).toBe(2);
      expect(entity.position.z).toBe(3);
    });

    it('should provide rotation access', () => {
      const entity = new Entity();
      entity.rotation.set(0.1, 0.2, 0.3);

      expect(entity.rotation.x).toBeCloseTo(0.1);
      expect(entity.rotation.y).toBeCloseTo(0.2);
      expect(entity.rotation.z).toBeCloseTo(0.3);
    });

    it('should provide scale access', () => {
      const entity = new Entity();
      entity.scale.set(2, 2, 2);

      expect(entity.scale.x).toBe(2);
      expect(entity.scale.y).toBe(2);
      expect(entity.scale.z).toBe(2);
    });

    it('should get world position', () => {
      const parent = new Entity('parent');
      const child = new Entity('child');

      parent.position.set(10, 0, 0);
      child.position.set(5, 0, 0);
      parent.addChild(child);

      // Update matrices
      parent.object3D.updateMatrixWorld(true);

      const worldPos = child.getWorldPosition();
      expect(worldPos.x).toBe(15);
    });
  });
});
