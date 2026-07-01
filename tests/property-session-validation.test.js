/**
 * Property 6: Session form validation
 * Validates: Requirements 4.4, 4.5, 5.5
 *
 * For any session form data object, validation SHALL reject when:
 * (a) date is missing, (b) venue is missing, (c) startTime is missing, or (d) endTime ≤ startTime.
 * Validation SHALL accept when all required fields are present and endTime > startTime.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateSessionParamsLogic, isValidDate, isValidTime } from '../shared/validation.js';

// カスタムジェネレータ: 有効な日付文字列 (YYYY-MM-DD)
const validDateArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 }) // 28日以内で安全に全月カバー
).map(([y, m, d]) => {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
});

// カスタムジェネレータ: 有効な会場名 (1〜100文字)
const validVenueArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

// カスタムジェネレータ: 有効な時刻 (HH:MM)
const validTimeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

// カスタムジェネレータ: startTime < endTime のペア
const validTimeRangeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 * 60 + 58 }), // 0〜1438 (分)
  fc.integer({ min: 1, max: 23 * 60 + 59 })  // 1〜1439 (分)
).filter(([s, e]) => s < e)
  .map(([s, e]) => {
    const startH = String(Math.floor(s / 60)).padStart(2, '0');
    const startM = String(s % 60).padStart(2, '0');
    const endH = String(Math.floor(e / 60)).padStart(2, '0');
    const endM = String(e % 60).padStart(2, '0');
    return { startTime: `${startH}:${startM}`, endTime: `${endH}:${endM}` };
  });

describe('Property 6: Session form validation', () => {
  /**
   * **Validates: Requirements 4.4, 4.5, 5.5**
   */
  it('全必須フィールドが有効かつ endTime > startTime なら検証を通過する', () => {
    fc.assert(
      fc.property(
        validDateArb,
        validVenueArb,
        validTimeRangeArb,
        (date, venue, timeRange) => {
          const result = validateSessionParamsLogic(date, venue, timeRange.startTime, timeRange.endTime);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dateが空/null/undefinedの場合は INVALID_PARAMS を返す', () => {
    const emptyDateArb = fc.constantFrom('', null, undefined);

    fc.assert(
      fc.property(
        emptyDateArb,
        validVenueArb,
        validTimeRangeArb,
        (date, venue, timeRange) => {
          const result = validateSessionParamsLogic(date, venue, timeRange.startTime, timeRange.endTime);
          expect(result).not.toBeNull();
          expect(result.code).toBe('INVALID_PARAMS');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('venueが空/null/undefinedの場合は INVALID_PARAMS を返す', () => {
    const emptyVenueArb = fc.constantFrom('', null, undefined);

    fc.assert(
      fc.property(
        validDateArb,
        emptyVenueArb,
        validTimeRangeArb,
        (date, venue, timeRange) => {
          const result = validateSessionParamsLogic(date, venue, timeRange.startTime, timeRange.endTime);
          expect(result).not.toBeNull();
          expect(result.code).toBe('INVALID_PARAMS');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('startTimeが空/null/undefinedの場合は INVALID_PARAMS を返す', () => {
    const emptyTimeArb = fc.constantFrom('', null, undefined);

    fc.assert(
      fc.property(
        validDateArb,
        validVenueArb,
        emptyTimeArb,
        validTimeArb,
        (date, venue, startTime, endTime) => {
          const result = validateSessionParamsLogic(date, venue, startTime, endTime);
          expect(result).not.toBeNull();
          expect(result.code).toBe('INVALID_PARAMS');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('endTime ≤ startTime の場合は INVALID_PARAMS を返す', () => {
    // endTime <= startTime のペアを生成
    const invalidTimeRangeArb = fc.tuple(
      fc.integer({ min: 1, max: 23 * 60 + 59 }),   // startTime (分): 1〜1439
      fc.integer({ min: 0, max: 23 * 60 + 59 })    // endTime (分): 0〜1439
    ).filter(([s, e]) => e <= s)
      .map(([s, e]) => {
        const startH = String(Math.floor(s / 60)).padStart(2, '0');
        const startM = String(s % 60).padStart(2, '0');
        const endH = String(Math.floor(e / 60)).padStart(2, '0');
        const endM = String(e % 60).padStart(2, '0');
        return { startTime: `${startH}:${startM}`, endTime: `${endH}:${endM}` };
      });

    fc.assert(
      fc.property(
        validDateArb,
        validVenueArb,
        invalidTimeRangeArb,
        (date, venue, timeRange) => {
          const result = validateSessionParamsLogic(date, venue, timeRange.startTime, timeRange.endTime);
          expect(result).not.toBeNull();
          expect(result.code).toBe('INVALID_PARAMS');
        }
      ),
      { numRuns: 100 }
    );
  });
});
