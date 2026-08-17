/**
 * Property 3: Past session classification
 * Feature: pickleball-schedule-manager, Property 3: Past session classification
 *
 * For any Practice_Session date and a reference date "today",
 * isPast(session.date, today) returns true if and only if session.date < today.
 *
 * **Validates: Requirements 1.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isPastSession } from '../common.js';

/**
 * Generator: 有効な日付文字列 (YYYY-MM-DD)
 */
const dateStrArb = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).map(d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
});

describe('Property 3: Past session classification', () => {
  it('isPastSession returns true iff dateStr < today (string comparison)', () => {
    fc.assert(
      fc.property(
        dateStrArb,
        dateStrArb,
        (sessionDate, today) => {
          const result = isPastSession(sessionDate, today);
          const expected = sessionDate < today;
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('same date is never past', () => {
    fc.assert(
      fc.property(
        dateStrArb,
        (date) => {
          expect(isPastSession(date, date)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
