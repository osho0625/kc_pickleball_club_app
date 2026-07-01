/**
 * Property 10: Backup filename format
 * Validates: Requirements 9.3
 *
 * For any Date object in JST timezone, the generated backup filename SHALL match
 * the pattern `backups/pickleball_YYYYMMDD_HHmmss.json` where YYYYMMDD and HHmmss
 * correspond to the JST date and time components.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateBackupFilenameFromDate } from '../shared/github.js';

// Generator for valid Date objects within a reasonable range (avoids NaN)
const validDate = () => fc.integer({
  min: new Date('2000-01-01T00:00:00Z').getTime(),
  max: new Date('2099-12-31T23:59:59Z').getTime()
}).map(ts => new Date(ts));

describe('Property 10: Backup filename format', () => {
  /**
   * **Validates: Requirements 9.3**
   */
  it('任意のDateオブジェクトに対して backups/pickleball_YYYYMMDD_HHmmss.json パターンに一致する', () => {
    fc.assert(
      fc.property(
        validDate(),
        (date) => {
          const filename = generateBackupFilenameFromDate(date);

          // パターンマッチ
          const pattern = /^backups\/pickleball_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/;
          expect(filename).toMatch(pattern);

          // JST変換して各コンポーネントを検証
          const match = filename.match(pattern);
          const jstOffset = 9 * 60 * 60 * 1000;
          const jst = new Date(date.getTime() + jstOffset);

          const expectedYear = jst.getUTCFullYear();
          const expectedMonth = jst.getUTCMonth() + 1;
          const expectedDay = jst.getUTCDate();
          const expectedHours = jst.getUTCHours();
          const expectedMinutes = jst.getUTCMinutes();
          const expectedSeconds = jst.getUTCSeconds();

          expect(parseInt(match[1], 10)).toBe(expectedYear);
          expect(parseInt(match[2], 10)).toBe(expectedMonth);
          expect(parseInt(match[3], 10)).toBe(expectedDay);
          expect(parseInt(match[4], 10)).toBe(expectedHours);
          expect(parseInt(match[5], 10)).toBe(expectedMinutes);
          expect(parseInt(match[6], 10)).toBe(expectedSeconds);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('月・日・時・分・秒がゼロパディングされている', () => {
    fc.assert(
      fc.property(
        validDate(),
        (date) => {
          const filename = generateBackupFilenameFromDate(date);

          // ファイル名の各数値部分が正しい桁数であること
          const pattern = /^backups\/pickleball_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/;
          const match = filename.match(pattern);

          // 年は4桁
          expect(match[1]).toHaveLength(4);
          // 月、日、時、分、秒は2桁
          expect(match[2]).toHaveLength(2);
          expect(match[3]).toHaveLength(2);
          expect(match[4]).toHaveLength(2);
          expect(match[5]).toHaveLength(2);
          expect(match[6]).toHaveLength(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('各数値コンポーネントが有効な範囲内である', () => {
    fc.assert(
      fc.property(
        validDate(),
        (date) => {
          const filename = generateBackupFilenameFromDate(date);
          const pattern = /^backups\/pickleball_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.json$/;
          const match = filename.match(pattern);

          const month = parseInt(match[2], 10);
          const day = parseInt(match[3], 10);
          const hours = parseInt(match[4], 10);
          const minutes = parseInt(match[5], 10);
          const seconds = parseInt(match[6], 10);

          expect(month).toBeGreaterThanOrEqual(1);
          expect(month).toBeLessThanOrEqual(12);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(31);
          expect(hours).toBeGreaterThanOrEqual(0);
          expect(hours).toBeLessThanOrEqual(23);
          expect(minutes).toBeGreaterThanOrEqual(0);
          expect(minutes).toBeLessThanOrEqual(59);
          expect(seconds).toBeGreaterThanOrEqual(0);
          expect(seconds).toBeLessThanOrEqual(59);
        }
      ),
      { numRuns: 100 }
    );
  });
});
