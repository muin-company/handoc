import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HanDocViewer } from '../HanDocViewer';
import '@testing-library/jest-dom';

// Mock HanDoc.open
vi.mock('@handoc/hwpx-parser', () => ({
  HanDoc: {
    open: vi.fn().mockResolvedValue({
      header: {
        version: '1.0',
        secCnt: 1,
        beginNum: { page: 1, footnote: 1, endnote: 1, pic: 1, tbl: 1, equation: 1 },
        refList: {
          fontFaces: [],
          borderFills: [],
          charProperties: [],
          paraProperties: [],
          styles: [],
          others: [],
        },
      },
      sections: [
        {
          paragraphs: [
            {
              id: null,
              paraPrIDRef: null,
              styleIDRef: null,
              pageBreak: false,
              columnBreak: false,
              merged: false,
              runs: [
                {
                  charPrIDRef: null,
                  children: [{ type: 'text' as const, content: 'Test Document' }],
                },
              ],
              lineSegArray: [],
            },
          ],
        },
      ],
      images: [],
    }),
  },
}));

describe('HanDocViewer', () => {
  const mockBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // Minimal ZIP header

  it('renders loading state initially', () => {
    render(<HanDocViewer buffer={mockBuffer} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders document content after loading', async () => {
    render(<HanDocViewer buffer={mockBuffer} />);
    const content = await screen.findByText((content) => content.includes('Test Document'));
    expect(content).toBeInTheDocument();
  });

  it('applies page view mode by default', async () => {
    const { container } = render(<HanDocViewer buffer={mockBuffer} />);
    await screen.findByText((content) => content.includes('Test Document'));
    expect(container.querySelector('.handoc-page')).toBeInTheDocument();
  });

  it('applies continuous view mode', async () => {
    const { container } = render(<HanDocViewer buffer={mockBuffer} viewMode="continuous" />);
    await screen.findByText((content) => content.includes('Test Document'));
    expect(container.querySelector('.handoc-continuous')).toBeInTheDocument();
  });

  it('shows zoom controls when enabled', async () => {
    const { container } = render(<HanDocViewer buffer={mockBuffer} showZoomControls />);
    await screen.findByText((content) => content.includes('Test Document'));
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument();
    expect(container.querySelector('.handoc-controls')).toBeInTheDocument();
    expect(container.querySelector('.handoc-zoom-label')).toHaveTextContent('100%');
  });

  it('increases zoom when + button clicked', async () => {
    const onZoomChange = vi.fn();
    render(<HanDocViewer buffer={mockBuffer} showZoomControls onZoomChange={onZoomChange} />);
    await screen.findByText((content) => content.includes('Test Document'));
    
    const zoomInBtn = screen.getByLabelText('Zoom in');
    fireEvent.click(zoomInBtn);
    
    expect(onZoomChange).toHaveBeenCalledWith(110);
  });

  it('decreases zoom when - button clicked', async () => {
    const onZoomChange = vi.fn();
    render(<HanDocViewer buffer={mockBuffer} showZoomControls onZoomChange={onZoomChange} />);
    await screen.findByText((content) => content.includes('Test Document'));
    
    const zoomOutBtn = screen.getByLabelText('Zoom out');
    fireEvent.click(zoomOutBtn);
    
    expect(onZoomChange).toHaveBeenCalledWith(90);
  });

  it('clamps zoom to 50-200 range', async () => {
    render(<HanDocViewer buffer={mockBuffer} zoom={300} showZoomControls />);
    await screen.findByText((content) => content.includes('Test Document'));
    expect(screen.getByText('200%')).toBeInTheDocument();
  });

  it('applies custom className', async () => {
    const { container } = render(<HanDocViewer buffer={mockBuffer} className="custom-class" />);
    await screen.findByText((content) => content.includes('Test Document'));
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('renders error state on parsing failure', async () => {
    const { HanDoc } = await import('@handoc/hwpx-parser');
    vi.mocked(HanDoc.open).mockRejectedValueOnce(new Error('Invalid file format'));
    
    render(<HanDocViewer buffer={mockBuffer} />);
    const errorMsg = await screen.findByText(/Error: Invalid file format/);
    expect(errorMsg).toBeInTheDocument();
  });

  it('resets zoom to 100% when reset button clicked', async () => {
    const onZoomChange = vi.fn();
    render(<HanDocViewer buffer={mockBuffer} zoom={150} showZoomControls onZoomChange={onZoomChange} />);
    await screen.findByText((content) => content.includes('Test Document'));
    
    const resetBtn = screen.getByLabelText('Reset zoom');
    fireEvent.click(resetBtn);
    
    expect(onZoomChange).toHaveBeenCalledWith(100);
  });
});
