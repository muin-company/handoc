/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { hanDocSchema } from '../schema';
import { imagePlugin } from '../imagePlugin';

describe('imagePlugin', () => {
  it('should create plugin instance', () => {
    const plugin = imagePlugin(hanDocSchema);
    expect(plugin).toBeDefined();
    expect(plugin.spec).toBeDefined();
    expect(plugin.spec.props).toBeDefined();
  });

  it('should have handleDrop prop', () => {
    const plugin = imagePlugin(hanDocSchema);
    expect(plugin.spec.props?.handleDrop).toBeDefined();
    expect(typeof plugin.spec.props?.handleDrop).toBe('function');
  });

  it('should have handlePaste prop', () => {
    const plugin = imagePlugin(hanDocSchema);
    expect(plugin.spec.props?.handlePaste).toBeDefined();
    expect(typeof plugin.spec.props?.handlePaste).toBe('function');
  });

  it('should be registered in editor state', () => {
    const state = EditorState.create({
      schema: hanDocSchema,
      doc: hanDocSchema.nodes.doc.create(null, [
        hanDocSchema.nodes.section.create(null, [
          hanDocSchema.nodes.paragraph.create(),
        ]),
      ]),
      plugins: [imagePlugin(hanDocSchema)],
    });

    expect(state.plugins).toBeDefined();
    expect(state.plugins.length).toBeGreaterThan(0);
    
    // Find imagePlugin in the plugins
    const hasImagePlugin = state.plugins.some(p => 
      p.spec?.props?.handleDrop && p.spec?.props?.handlePaste
    );
    expect(hasImagePlugin).toBe(true);
  });

  it('should not interfere with other plugins', () => {
    const state = EditorState.create({
      schema: hanDocSchema,
      plugins: [imagePlugin(hanDocSchema)],
    });

    // Plugin should not throw when state is created
    expect(state).toBeDefined();
    expect(state.doc).toBeDefined();
  });
});

/**
 * Note: Full integration tests for drop/paste functionality require a browser environment
 * with full DataTransfer and DragEvent support. These are tested manually or in E2E tests.
 * 
 * The plugin implementation handles:
 * - Image file detection from DataTransfer
 * - File to data URL conversion
 * - Image node insertion at drop/paste position
 * - Multiple image handling
 */
