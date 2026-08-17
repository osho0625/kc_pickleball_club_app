/**
 * Property 7: Attendance note length validation
 * Validates: Requirements 3.2
 *
 * For any string, note validation SHALL accept strings with length ≤ 20 characters
 * and reject strings with length > 20 characters.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateNote } from '../shared/validation.js';

describe('Property 7: Attendance note length validation', () => {
  /**
   * **Validates: Requirements 3.2**
   */
  it('20文字以内の文字列は受け入れる', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }),
        (note) => {
          expect(validateNote(note)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('21文字以上の文字列は拒否する', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 21, maxLength: 200 }),
        (note) => {
          expect(validateNote(note)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('null/undefined/空文字はすべて受け入れる', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        (note) => {
          expect(validateNote(note)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('マルチバイト文字（日本語含む）も文字数ベースでカウントされる（20文字以内）', () => {
    // 日本語文字列を含む任意のユニコード文字列で20文字以内は受け入れ
    const unicodeNoteArb = fc.stringMatching(/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{1,20}$/);
    fc.assert(
      fc.property(
        unicodeNoteArb,
        (note) => {
          expect(note.length).toBeLessThanOrEqual(20);
          expect(validateNote(note)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('マルチバイト文字でも21文字以上は拒否する', () => {
    const longUnicodeNoteArb = fc.stringMatching(/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{21,50}$/);
    fc.assert(
      fc.property(
        longUnicodeNoteArb,
        (note) => {
          expect(note.length).toBeGreaterThan(20);
          expect(validateNote(note)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
