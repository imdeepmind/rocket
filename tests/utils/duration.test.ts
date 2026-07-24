import {afterEach, describe, expect, it} from 'vitest';

import {parseDuration} from '@/utils/duration';

describe('duration utils', () => {
  describe('parseDuration', () => {
    const originalMatch = String.prototype.match;

    afterEach(() => {
      String.prototype.match = originalMatch;
    });

    it('should parse seconds correctly', () => {
      expect(parseDuration('30s')).toBe(30000);
      expect(parseDuration('1s')).toBe(1000);
    });

    it('should parse minutes correctly', () => {
      expect(parseDuration('5m')).toBe(300000);
      expect(parseDuration('1m')).toBe(60000);
    });

    it('should parse hours correctly', () => {
      expect(parseDuration('1h')).toBe(3600000);
      expect(parseDuration('2h')).toBe(7200000);
    });

    it('should parse days correctly', () => {
      expect(parseDuration('1d')).toBe(86400000);
      expect(parseDuration('7d')).toBe(604800000);
    });

    it('should throw error for invalid format', () => {
      expect(() => parseDuration('30')).toThrow('Invalid duration format');
      expect(() => parseDuration('s30')).toThrow('Invalid duration format');
      expect(() => parseDuration('')).toThrow('Invalid duration format');
      expect(() => parseDuration('10 x')).toThrow('Invalid duration format');
    });

    it('should throw error for unsupported unit', () => {
      String.prototype.match = function (this: string, regex: string | RegExp) {
        if (regex instanceof RegExp && regex.source === '^(\\d+)([smhd])$') {
          return ['10w', '10', 'w'] as unknown as RegExpMatchArray;
        }
        return originalMatch.call(this, regex as never);
      } as typeof String.prototype.match;

      expect(() => parseDuration('10w')).toThrow(
        'Unsupported duration unit: "w"',
      );
    });
  });
});
