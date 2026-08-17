/**
 * Property 8: Row content mismatch detection
 * Validates: Requirements 5.4, 6.5, 8.5, 8.6, 13.4, 13.5
 *
 * For any row data (date, venue, startTime) and expected values (expectedDate, expectedVenue, expectedStartTime),
 * the verification function SHALL return ROW_MISMATCH if and only if the row's date ≠ expectedDate
 * OR the row's venue ≠ expectedVenue OR the row's startTime ≠ expectedStartTime.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { verifyRowContentLogic } from '../shared/validation.js';

// カスタムジェネレータ: 日付風文字列
const dateStrArb = fc.tuple(
  fc.integer({ min: 2020, max: 2030 }),
  fc.integer({ min: 1, max: 12 }),
  fc.integer({ min: 1, max: 28 })
).map(([y, m, d]) => {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
});

// カスタムジェネレータ: 会場名
const venueArb = fc.string({ minLength: 1, maxLength: 50 });

// カスタムジェネレータ: 時刻文字列 (HH:MM)
const timeArb = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

describe('Property 8: Row content mismatch detection', () => {
  /**
   * **Validates: Requirements 5.4, 6.5, 8.5, 8.6, 13.4, 13.5**
   */
  it('全フィールドが一致する場合はnullを返す（ミスマッチなし）', () => {
    fc.assert(
      fc.property(
        dateStrArb,
        venueArb,
        timeArb,
        (date, venue, startTime) => {
          const result = verifyRowContentLogic(date, venue, startTime, date, venue, startTime);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dateが異なる場合は ROW_MISMATCH を返す', () => {
    fc.assert(
      fc.property(
        dateStrArb,
        dateStrArb,
        venueArb,
        timeArb,
        (actualDate, expectedDate, venue, startTime) => {
          fc.pre(actualDate !== expectedDate);
          const result = verifyRowContentLogic(actualDate, venue, startTime, expectedDate, venue, startTime);
          expect(result).not.toBeNull();
          expect(result.code).toBe('ROW_MISMATCH');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('venueが異なる場合は ROW_MISMATCH を返す', () => {
    fc.assert(
      fc.property(
        dateStrArb,
        venueArb,
        venueArb,
        timeArb,
        (date, actualVenue, expectedVenue, startTime) => {
          fc.pre(actualVenue !== expectedVenue);
          const result = verifyRowContentLogic(date, actualVenue, startTime, date, expectedVenue, startTime);
          expect(result).not.toBeNull();
          expect(result.code).toBe('ROW_MISMATCH');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('startTimeが異なる場合は ROW_MISMATCH を返す', () => {
    fc.assert(
      fc.property(
        dateStrArb,
        venueArb,
        timeArb,
        timeArb,
        (date, venue, actualStartTime, expectedStartTime) => {
          fc.pre(actualStartTime !== expectedStartTime);
          const result = verifyRowContentLogic(date, venue, actualStartTime, date, venue, expectedStartTime);
          expect(result).not.toBeNull();
          expect(result.code).toBe('ROW_MISMATCH');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('少なくとも1フィールドが異なればROW_MISMATCH、全一致ならnull（if and only if）', () => {
    fc.assert(
      fc.property(
        dateStrArb,
        venueArb,
        timeArb,
        dateStrArb,
        venueArb,
        timeArb,
        (actualDate, actualVenue, actualStartTime, expectedDate, expectedVenue, expectedStartTime) => {
          const result = verifyRowContentLogic(
            actualDate, actualVenue, actualStartTime,
            expectedDate, expectedVenue, expectedStartTime
          );

          const allMatch =
            actualDate === expectedDate &&
            actualVenue === expectedVenue &&
            actualStartTime === expectedStartTime;

          if (allMatch) {
            expect(result).toBeNull();
          } else {
            expect(result).not.toBeNull();
            expect(result.code).toBe('ROW_MISMATCH');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
