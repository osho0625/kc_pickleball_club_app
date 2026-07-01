/**
 * Property 5: Participant count calculation
 * Feature: pickleball-schedule-manager, Property 5: Participant count calculation
 *
 * For any array of Attendance objects, the participant count SHALL equal
 * the number of entries where status is "○" plus the number of entries
 * where status is "△".
 *
 * **Validates: Requirements 2.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { countParticipants } from '../common.js';

/**
 * Generator: 有効な出欠ステータス
 */
const statusArb = fc.constantFrom('○', '×', '△');

/**
 * Generator: Attendanceオブジェクト
 */
const attendanceArb = fc.record({
  memberName: fc.string({ minLength: 1, maxLength: 10 }),
  status: statusArb,
  note: fc.option(fc.string({ maxLength: 20 }), { nil: '' }),
});

describe('Property 5: Participant count calculation', () => {
  it('count equals number of ○ plus number of △', () => {
    fc.assert(
      fc.property(
        fc.array(attendanceArb, { minLength: 0, maxLength: 50 }),
        (attendance) => {
          const result = countParticipants(attendance);
          const expected = attendance.filter(
            a => a.status === '○' || a.status === '△'
          ).length;
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('× only array returns 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            memberName: fc.string({ minLength: 1, maxLength: 10 }),
            status: fc.constant('×'),
            note: fc.constant(''),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (attendance) => {
          expect(countParticipants(attendance)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty array returns 0', () => {
    expect(countParticipants([])).toBe(0);
  });

  it('non-array input returns 0', () => {
    expect(countParticipants(null)).toBe(0);
    expect(countParticipants(undefined)).toBe(0);
  });
});
