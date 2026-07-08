import { describe, it, expect } from 'vitest';
import { classifySupabaseError } from '../utils/connectionErrorClassifier';

describe('connectionErrorClassifier', () => {
  it('should classify browser offline state as OFFLINE', () => {
    // Mock navigator.onLine as false
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    });

    const result = classifySupabaseError(new Error('Any error'));
    expect(result.type).toBe('OFFLINE');
    expect(result.isTransient).toBe(true);

    // Restore
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    });
  });

  it('should classify HTTP 429 as QUOTA_LIMITED', () => {
    const error = { status: 429, message: 'Too many requests' };
    const result = classifySupabaseError(error);
    expect(result.type).toBe('QUOTA_LIMITED');
    expect(result.isTransient).toBe(true);
  });

  it('should classify egress messages as QUOTA_LIMITED', () => {
    const error = { message: 'Egress quota exceeded for organization' };
    const result = classifySupabaseError(error);
    expect(result.type).toBe('QUOTA_LIMITED');
    expect(result.isTransient).toBe(true);
  });

  it('should classify HTTP 401 as AUTH_ERROR', () => {
    const error = { status: 401, message: 'Invalid JWT' };
    const result = classifySupabaseError(error);
    expect(result.type).toBe('AUTH_ERROR');
    expect(result.isTransient).toBe(false);
  });

  it('should classify HTTP 502 as BACKEND_UNREACHABLE', () => {
    const error = { status: 502, message: 'Bad Gateway' };
    const result = classifySupabaseError(error);
    expect(result.type).toBe('BACKEND_UNREACHABLE');
    expect(result.isTransient).toBe(true);
  });

  it('should classify network fetch failures as BACKEND_UNREACHABLE', () => {
    const error = new Error('Failed to fetch data from Supabase');
    const result = classifySupabaseError(error);
    expect(result.type).toBe('BACKEND_UNREACHABLE');
    expect(result.isTransient).toBe(true);
  });

  it('should default to REQUEST_FAILED for generic query errors', () => {
    const error = { status: 400, message: 'invalid input syntax for type uuid' };
    const result = classifySupabaseError(error);
    expect(result.type).toBe('REQUEST_FAILED');
    expect(result.isTransient).toBe(false);
  });
});
