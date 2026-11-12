import {handleConfigShow, handleConfigValidate} from '@/cli/commands/config';
import * as configFinder from '@/cli/config-finder';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';
import {redactConfig} from '@/lib/config/redact';

vi.mock('@/lib/config/pipeline', () => ({
  resolveAndValidateConfig: vi.fn(),
}));

vi.mock('@/lib/config/redact', () => ({
  redactConfig: vi.fn(),
}));

vi.mock('@/cli/config-finder', () => ({
  resolveConfigPath: vi.fn(),
  loadConfigFile: vi.fn(),
}));

vi.mock('chalk', () => ({
  default: {
    green: vi.fn(s => s),
    gray: vi.fn(s => s),
    yellow: vi.fn(s => s),
    red: vi.fn(s => s),
  },
}));

describe('cli/commands/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleConfigShow', () => {
    it('resolves, redacts and prints configuration in dev mode by default', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockRaw = {application: {name: 'Raw Config'}};
      const mockResolved = {
        application: {name: 'Resolved Config'},
        infrastructure: {database: {connection: {password: 'secret'}}},
      };
      const mockRedacted = {
        application: {name: 'Resolved Config'},
        infrastructure: {database: {connection: {password: '***'}}},
      };

      vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
        '/app/ross.json',
      );
      vi.mocked(configFinder.loadConfigFile).mockReturnValue(mockRaw as never);
      vi.mocked(resolveAndValidateConfig).mockReturnValue(
        mockResolved as never,
      );
      vi.mocked(redactConfig).mockReturnValue(mockRedacted as never);

      await handleConfigShow({});

      expect(configFinder.resolveConfigPath).toHaveBeenCalledWith(undefined);
      expect(configFinder.loadConfigFile).toHaveBeenCalledWith(
        '/app/ross.json',
      );
      expect(resolveAndValidateConfig).toHaveBeenCalledWith(mockRaw, 'dev');
      expect(redactConfig).toHaveBeenCalledWith(mockResolved);
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify(mockRedacted, null, 2),
      );

      logSpy.mockRestore();
    });

    it('prints raw configuration and warns when raw flag is true', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockResolved = {
        application: {name: 'Resolved Config'},
        infrastructure: {database: {connection: {password: 'secret'}}},
      };

      vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
        '/app/ross.json',
      );
      vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
      vi.mocked(resolveAndValidateConfig).mockReturnValue(
        mockResolved as never,
      );

      await handleConfigShow({raw: true, mode: 'prod'});

      expect(resolveAndValidateConfig).toHaveBeenCalledWith({}, 'prod');
      expect(redactConfig).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Warning: Printing raw configuration with unredacted secrets.',
      );
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify(mockResolved, null, 2),
      );

      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('logs error and exits with 1 on invalid configuration', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as unknown as (
          code?: string | number | null,
        ) => never);

      vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
        '/app/ross.json',
      );
      vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
      vi.mocked(resolveAndValidateConfig).mockImplementation(() => {
        throw new Error('Missing required properties');
      });

      await handleConfigShow({});

      expect(errorSpy).toHaveBeenCalledWith(
        'Invalid configuration:',
        'Missing required properties',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('handleConfigValidate', () => {
    it('validates config and logs success summary', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockResolved = {
        data: {
          models: {
            users: {},
            notes: {},
          },
        },
        infrastructure: {
          database: {
            engine: 'postgres',
          },
        },
      };

      vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
        '/app/ross.json',
      );
      vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
      vi.mocked(resolveAndValidateConfig).mockReturnValue(
        mockResolved as never,
      );

      await handleConfigValidate({mode: 'dev'});

      expect(logSpy).toHaveBeenCalledWith('✓ Configuration is valid!');
      expect(logSpy).toHaveBeenCalledWith('  Config file: /app/ross.json');
      expect(logSpy).toHaveBeenCalledWith('  Models:      2');
      expect(logSpy).toHaveBeenCalledWith('  Database:    postgres');
      expect(logSpy).toHaveBeenCalledWith('  Mode:        dev');

      logSpy.mockRestore();
    });

    it('logs error and exits with 1 on invalid config in validate command', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as unknown as (
          code?: string | number | null,
        ) => never);

      vi.mocked(configFinder.resolveConfigPath).mockReturnValue(
        '/app/ross.json',
      );
      vi.mocked(configFinder.loadConfigFile).mockReturnValue({} as never);
      vi.mocked(resolveAndValidateConfig).mockImplementation(() => {
        throw new Error('Relation model not found');
      });

      await handleConfigValidate({});

      expect(errorSpy).toHaveBeenCalledWith(
        'Invalid configuration:',
        'Relation model not found',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      errorSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
