import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('テスト環境セットアップ確認', () => {
  it('Vitest が動作する', () => {
    expect(1 + 1).toBe(2);
  });

  it('fast-check が動作する', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a;
      }),
      { numRuns: 100 }
    );
  });

  it('jsdom 環境が利用可能', () => {
    const div = document.createElement('div');
    div.textContent = 'テスト';
    expect(div.textContent).toBe('テスト');
  });
});
