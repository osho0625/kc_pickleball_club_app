/**
 * Property 1: Session sorting invariant
 * Feature: pickleball-schedule-manager, Property 1: Session sorting invariant
 *
 * For any array of Practice_Sessions, after sorting, for every consecutive pair,
 * sessions[i].date ≤ sessions[i+1].date, and if dates are equal then
 * sessions[i].startTime ≤ sessions[i+1].startTime.
 *
 * **Validates: Requirements 1.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortSessions } from '../common.js';

/**
 * Generator: 有効なPractice_Session（date: YYYY-MM-DD, startTime: HH:MM）
 */
const sessionArb = fc.record({
  date: fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).map(d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }),
  startTime: fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
  venue: fc.string({ minLength: 1, maxLength: 20 }),
});

describe('Property 1: Session sorting invariant', () => {
  it('sorted sessions maintain date ASC then startTime ASC ordering', () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
        (sessions) => {
          const sorted = sortSessions(sessions);

          // Length preserved
          expect(sorted.length).toBe(sessions.length);

          // Ordering invariant
          for (let i = 0; i < sorted.length - 1; i++) {
            const curr = sorted[i];
            const next = sorted[i + 1];

            if (curr.date === next.date) {
              expect(curr.startTime <= next.startTime).toBe(true);
            } else {
              expect(curr.date < next.date).toBe(true);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('sorting is non-destructive (does not modify original array)', () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 1, maxLength: 20 }),
        (sessions) => {
          const original = [...sessions];
          sortSessions(sessions);
          expect(sessions).toEqual(original);
        }
      ),
      { numRuns: 100 }
    );
  });
});
