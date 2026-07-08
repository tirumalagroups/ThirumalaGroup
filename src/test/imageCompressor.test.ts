import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressToWebP } from '../utils/imageCompressor';

describe('imageCompressor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should call FileReader and compress successfully when environment APIs exist', async () => {
    // Mock FileReader
    const readAsDataURLMock = vi.fn();
    const mockFileReader = {
      readAsDataURL: readAsDataURLMock,
      onload: null as any,
      result: 'data:image/png;base64,mockdata',
    };
    
    vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader as any);

    // Mock Image object
    const mockImage = {
      width: 2000,
      height: 1000,
      onload: null as any,
      src: '',
    };
    vi.spyOn(global, 'Image').mockImplementation(() => mockImage as any);

    // Mock Canvas and context
    const mockBlob = new Blob(['mock-compressed-data'], { type: 'image/webp' });
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
      }),
      toBlob: vi.fn().mockImplementation((cb) => {
        cb(mockBlob);
      }),
    };
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas as any;
      return {} as any;
    });

    const file = new File(['dummy-content'], 'test.png', { type: 'image/png' });
    
    // Start compression
    const compressPromise = compressToWebP(file, 1280, 0.8);

    // Simulate FileReader onload
    mockFileReader.onload({ target: mockFileReader } as any);

    // Simulate Image onload
    mockImage.onload();

    const resultBlob = await compressPromise;
    expect(resultBlob).toBe(mockBlob);
    expect(mockCanvas.width).toBe(1280); // Scaled from 2000px down to 1280px max
    expect(mockCanvas.height).toBe(640); // 1280 * 1000 / 2000 = 640px
  });
});
