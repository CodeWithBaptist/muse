import { afterEach, describe, expect, it, vi } from 'vitest';
import DesignSystemPage, { metadata } from './page';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/components/design-system/DesignSystemReference', () => ({
  DesignSystemReference: () => <div>Design reference</div>,
}));
afterEach(() => vi.unstubAllEnvs());

describe('design page gate', () => {
  it('returns notFound in production unless the override is exactly true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const flag of [undefined, '', 'false', 'TRUE', '1']) {
      vi.stubEnv('SHOW_DESIGN_SYSTEM', flag);
      expect(() => DesignSystemPage()).toThrow('NEXT_NOT_FOUND');
    }
    vi.stubEnv('SHOW_DESIGN_SYSTEM', 'true');
    expect(DesignSystemPage()).toBeTruthy();
  });

  it('remains available in development and always excludes indexing', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(DesignSystemPage()).toBeTruthy();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
