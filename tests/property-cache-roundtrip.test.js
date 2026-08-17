/**
 * Property 11: Cache round-trip
 * Feature: pickleball-schedule-manager, Property 11: Cache round-trip
 *
 * For any valid sessions array and members array, storing them via the cache function
 * and then retrieving SHALL return equivalent data, and the lastFetched timestamp
 * SHALL be a valid ISO 8601 string in JST.
 *
 * **Validates: Requirements 11.1**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { cacheData, getCachedData } from '../common.js';

/**
 * Generator: 簡易Practice_Session
 */
const sessionArb = fc.record({
  rowIndex: fc.integer({ min: 1, max: 200 }),
  date: fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2030-12-31'),
  }).map(d => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }),
  venue: fc.string({ minLength: 1, maxLength: 50 }),
  startTime: fc.tuple(
    fc.integer({ min: 0, max: 22 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
  endTime: fc.tuple(
    fc.integer({ min: 1, max: 23 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`),
});

/**
 * Generator: メンバー名配列
 */
const membersArb = fc.array(
  fc.string({ minLength: 1, maxLength: 10 }),
  { minLength: 1, maxLength: 20 }
);

describe('Property 11: Cache round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stored data can be retrieved equivalently', () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 0, maxLength: 20 }),
        membersArb,
        (sessions, members) => {
          cacheData(sessions, members);
          const cached = getCachedData();

          expect(cached).not.toBeNull();
          expect(cached.sessions).toEqual(sessions);
          expect(cached.members).toEqual(members);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('lastFetched is a valid ISO 8601 string with +09:00 timezone', () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 0, maxLength: 5 }),
        membersArb,
        (sessions, members) => {
          cacheData(sessions, members);
          const cached = getCachedData();

          expect(cached).not.toBeNull();
          // ISO 8601 with JST offset
          expect(cached.lastFetched).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+09:00$/
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getCachedData returns null when no cache exists', () => {
    expect(getCachedData()).toBeNull();
  });

  it('getCachedData returns null for malformed data', () => {
    localStorage.setItem('pb_cache', 'not valid json{{{');
    expect(getCachedData()).toBeNull();
  });
});
