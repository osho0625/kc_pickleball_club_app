/**
 * Property 4: Attendance display formatting
 * Feature: pickleball-schedule-manager, Property 4: Attendance display formatting
 *
 * For any Attendance with status "△" and any note string (including empty),
 * the formatted display SHALL be "△（{note}）" when note is non-empty,
 * and "△（未定）" when note is empty or null.
 *
 * **Validates: Requirements 2.2, 2.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatAttendance } from '../common.js';

describe('Property 4: Attendance display formatting', () => {
  it('△ with non-empty note displays as △（{note}）', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (note) => {
          const result = formatAttendance('△', note);
          expect(result).toBe(`△（${note}）`);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('△ with empty string note displays as △（未定）', () => {
    expect(formatAttendance('△', '')).toBe('△（未定）');
  });

  it('△ with null note displays as △（未定）', () => {
    expect(formatAttendance('△', null)).toBe('△（未定）');
  });

  it('△ with undefined note displays as △（未定）', () => {
    expect(formatAttendance('△', undefined)).toBe('△（未定）');
  });

  it('○ status returns ○ regardless of note', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ maxLength: 20 }), { nil: null }),
        (note) => {
          const result = formatAttendance('○', note);
          expect(result).toBe('○');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('× status returns × regardless of note', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ maxLength: 20 }), { nil: null }),
        (note) => {
          const result = formatAttendance('×', note);
          expect(result).toBe('×');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty status returns empty string', () => {
    expect(formatAttendance('', null)).toBe('');
    expect(formatAttendance('', 'some note')).toBe('');
  });
});
