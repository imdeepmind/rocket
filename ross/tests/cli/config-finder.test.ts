import * as fs from 'fs';
import * as path from 'path';

import {loadConfigFile, resolveConfigPath} from '@/cli/config-finder';
import {InvalidArgumentError} from 'commander';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('fs', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('config-finder', () => {
  const originalEnv = process.env.ROSS_CONFIG;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ROSS_CONFIG;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ROSS_CONFIG = originalEnv;
    } else {
      delete process.env.ROSS_CONFIG;
    }
  });

  describe('resolveConfigPath with specifiedPath', () => {
    it('returns resolved path when file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => true} as fs.Stats);

      const result = resolveConfigPath('custom.json', '/app');
      expect(result).toBe(path.resolve('/app', 'custom.json'));
    });

    it('throws InvalidArgumentError when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => resolveConfigPath('missing.json', '/app')).toThrow(
        InvalidArgumentError,
      );
      expect(() => resolveConfigPath('missing.json', '/app')).toThrow(
        'Config file not found',
      );
    });

    it('throws InvalidArgumentError when path is a directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => false} as fs.Stats);

      expect(() => resolveConfigPath('folder', '/app')).toThrow(
        InvalidArgumentError,
      );
      expect(() => resolveConfigPath('folder', '/app')).toThrow('Not a file');
    });
  });

  describe('resolveConfigPath with ROSS_CONFIG environment variable', () => {
    it('returns resolved path when env file exists', () => {
      process.env.ROSS_CONFIG = 'env-config.json';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => true} as fs.Stats);

      const result = resolveConfigPath(undefined, '/app');
      expect(result).toBe(path.resolve('/app', 'env-config.json'));
    });

    it('throws when env file does not exist', () => {
      process.env.ROSS_CONFIG = 'missing-env.json';
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => resolveConfigPath(undefined, '/app')).toThrow(
        InvalidArgumentError,
      );
      expect(() => resolveConfigPath(undefined, '/app')).toThrow(
        'Config file specified by ROSS_CONFIG not found',
      );
    });

    it('throws when env path is not a file', () => {
      process.env.ROSS_CONFIG = 'dir';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => false} as fs.Stats);

      expect(() => resolveConfigPath(undefined, '/app')).toThrow(
        InvalidArgumentError,
      );
      expect(() => resolveConfigPath(undefined, '/app')).toThrow('Not a file');
    });
  });

  describe('resolveConfigPath auto-discovery', () => {
    it('finds ross.json first when present', () => {
      vi.mocked(fs.existsSync).mockImplementation(p =>
        String(p).endsWith('ross.json'),
      );
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => true} as fs.Stats);

      const result = resolveConfigPath(undefined, '/app');
      expect(result).toBe(path.resolve('/app', 'ross.json'));
    });

    it('finds config.json when ross.json is absent', () => {
      vi.mocked(fs.existsSync).mockImplementation(p =>
        String(p).endsWith('config.json'),
      );
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => true} as fs.Stats);

      const result = resolveConfigPath(undefined, '/app');
      expect(result).toBe(path.resolve('/app', 'config.json'));
    });

    it('finds example_config.json as fallback', () => {
      vi.mocked(fs.existsSync).mockImplementation(p =>
        String(p).endsWith('example_config.json'),
      );
      vi.mocked(fs.statSync).mockReturnValue({isFile: () => true} as fs.Stats);

      const result = resolveConfigPath(undefined, '/app');
      expect(result).toBe(path.resolve('/app', 'example_config.json'));
    });

    it('throws when no candidate exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => resolveConfigPath(undefined, '/app')).toThrow(
        InvalidArgumentError,
      );
      expect(() => resolveConfigPath(undefined, '/app')).toThrow(
        'No configuration file found',
      );
    });
  });

  describe('loadConfigFile', () => {
    it('reads and parses JSON config', () => {
      const mockConfig = {application: {name: 'Test App'}};
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const result = loadConfigFile('/app/ross.json');
      expect(result).toEqual(mockConfig);
      expect(fs.readFileSync).toHaveBeenCalledWith('/app/ross.json', 'utf-8');
    });
  });
});
