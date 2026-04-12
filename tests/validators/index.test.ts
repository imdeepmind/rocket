import * as fs from 'fs';
import * as path from 'path';
import {describe, expect, it, vi} from 'vitest';
import {InvalidArgumentError} from 'commander';
import {
  validateConfigPath,
  validatePort,
  validateMode,
} from '../../src/validators/index';

vi.mock('fs');
vi.mock('path');

describe('validators/index', () => {
  describe('validateConfigPath', () => {
    it('should return resolved path if file exists', () => {
      const input = 'config.json';
      const resolved = '/absolute/path/config.json';

      vi.mocked(path.resolve).mockReturnValue(resolved);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => true} as fs.Stats);

      expect(validateConfigPath(input)).toBe(resolved);
    });

    it('should throw InvalidArgumentError if file does not exist', () => {
      const input = 'missing.json';
      const resolved = '/absolute/path/missing.json';

      vi.mocked(path.resolve).mockReturnValue(resolved);
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => validateConfigPath(input)).toThrow(InvalidArgumentError);
      expect(() => validateConfigPath(input)).toThrow(
        `Config file not found: ${resolved}`,
      );
    });

    it('should throw InvalidArgumentError if path is a directory', () => {
      const input = 'dir';
      const resolved = '/absolute/path/dir';

      vi.mocked(path.resolve).mockReturnValue(resolved);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => false} as fs.Stats);

      expect(() => validateConfigPath(input)).toThrow(InvalidArgumentError);
      expect(() => validateConfigPath(input)).toThrow(
        `Not a file: ${resolved}`,
      );
    });
  });

  describe('validatePort', () => {
    it('should return port number if valid', () => {
      expect(validatePort('3000')).toBe(3000);
      expect(validatePort('8080')).toBe(8080);
    });

    it('should throw if port is not a number', () => {
      expect(() => validatePort('abc')).toThrow(InvalidArgumentError);
      expect(() => validatePort('abc')).toThrow('Port must be a number');
    });

    it('should throw if port is below 1', () => {
      expect(() => validatePort('0')).toThrow(InvalidArgumentError);
      expect(() => validatePort('-1')).toThrow(
        'Port must be between 1 and 65535',
      );
    });

    it('should throw if port is above 65535', () => {
      expect(() => validatePort('65536')).toThrow(InvalidArgumentError);
    });
  });

  describe('validateMode', () => {
    it('should return mode if valid', () => {
      expect(validateMode('dev')).toBe('dev');
      expect(validateMode('prod')).toBe('prod');
    });

    it('should throw if mode is invalid', () => {
      expect(() => validateMode('invalid')).toThrow(InvalidArgumentError);
      expect(() => validateMode('invalid')).toThrow(
        'Mode must be one of: dev, prod',
      );
    });
  });
});
