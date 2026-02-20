/**
 * Tests for Toolbar component
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { hanDocSchema } from '../schema';
import { Toolbar } from '../Toolbar';

describe('Toolbar', () => {
  const createMockView = (): EditorView => {
    const state = EditorState.create({
      schema: hanDocSchema,
      doc: hanDocSchema.nodes.doc.create(null, [
        hanDocSchema.nodes.section.create(null, [
          hanDocSchema.nodes.paragraph.create(null, [
            hanDocSchema.text('Hello world'),
          ]),
        ]),
      ]),
    });

    const div = document.createElement('div');
    const view = new EditorView(div, { state });
    
    return view;
  };

  it('should render toolbar buttons', () => {
    const view = createMockView();
    render(<Toolbar view={view} />);
    
    expect(screen.getByTitle(/굵게/)).toBeInTheDocument();
    expect(screen.getByTitle(/기울임/)).toBeInTheDocument();
    expect(screen.getByTitle(/밑줄/)).toBeInTheDocument();
    expect(screen.getByTitle(/HWPX로 저장/)).toBeInTheDocument();
  });

  it('should render heading buttons', () => {
    const view = createMockView();
    render(<Toolbar view={view} />);
    
    expect(screen.getByTitle(/본문/)).toBeInTheDocument();
    expect(screen.getByTitle(/제목 1/)).toBeInTheDocument();
    expect(screen.getByTitle(/제목 2/)).toBeInTheDocument();
    expect(screen.getByTitle(/제목 3/)).toBeInTheDocument();
  });

  it('should render alignment buttons', () => {
    const view = createMockView();
    render(<Toolbar view={view} />);
    
    expect(screen.getByTitle(/왼쪽 정렬/)).toBeInTheDocument();
    expect(screen.getByTitle(/가운데 정렬/)).toBeInTheDocument();
    expect(screen.getByTitle(/오른쪽 정렬/)).toBeInTheDocument();
    expect(screen.getByTitle(/양쪽 정렬/)).toBeInTheDocument();
  });

  it('should call onExport when export button is clicked', async () => {
    const view = createMockView();
    const onExport = vi.fn();
    render(<Toolbar view={view} onExport={onExport} />);
    
    const exportButton = screen.getByTitle(/HWPX로 저장/);
    fireEvent.click(exportButton);
    
    // Wait for async export
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(onExport).toHaveBeenCalled();
    expect(onExport).toHaveBeenCalledWith(expect.any(Uint8Array));
  });

  it('should not render when view is null', () => {
    const { container } = render(<Toolbar view={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('should toggle bold when bold button is clicked', () => {
    const view = createMockView();
    const dispatchSpy = vi.spyOn(view, 'dispatch');
    
    render(<Toolbar view={view} />);
    
    const boldButton = screen.getByTitle(/굵게/);
    fireEvent.click(boldButton);
    
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('should toggle italic when italic button is clicked', () => {
    const view = createMockView();
    const dispatchSpy = vi.spyOn(view, 'dispatch');
    
    render(<Toolbar view={view} />);
    
    const italicButton = screen.getByTitle(/기울임/);
    fireEvent.click(italicButton);
    
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('should toggle underline when underline button is clicked', () => {
    const view = createMockView();
    const dispatchSpy = vi.spyOn(view, 'dispatch');
    
    render(<Toolbar view={view} />);
    
    const underlineButton = screen.getByTitle(/밑줄/);
    fireEvent.click(underlineButton);
    
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
