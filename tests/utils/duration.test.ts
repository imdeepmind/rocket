import {describe, expect, it} from 'vitest';

import {parseDuration} from '@/utils/duration';

describe('duration utils', () => {
  describe('parseDuration', () => {
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
      // The regex ^(\d+)([smhd])$ actually limits units to s, m, h, d
      // so any other unit will fail the regex match and throw 'Invalid duration format'
      // instead of 'Unsupported duration unit'.
      // To trigger line 35, I'd need to bypass the regex, which is impossible with the current code.
      // But I can test a unit that might pass a broader regex if it were different.
      // With current regex, '10w' fails the match.
      expect(() => parseDuration('10w')).toThrow('Invalid duration format');
    });
  });
});
