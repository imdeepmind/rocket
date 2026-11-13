import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {pathToFileURL} from 'url';

import * as esbuild from 'esbuild';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {resolveConfig} from '@/lib/config/resolve';
import {
  buildFunctions,
  computeFunctionOutputPath,
} from '@/lib/functions/builder';

import {
  AppConfig,
  CustomEndpointConfig,
  ResolvedAppConfig,
} from '@/interfaces/config';

const rawBaseConfig: AppConfig = {
  application: {
    name: 'Test App',
    logLevel: 'info',
  },
  docs: {
    openapi: {
      enabled: false,
      path: '/docs',
      info: {
        title: 'Test Docs',
        version: '1.0.0',
      },
    },
  },
  infrastructure: {
    database: {
      engine: 'sqlite',
      connection: {url: './test.db'},
    },
  },
  data: {models: {}},
};

function createMockConfig(
  customEndpoints: Record<string, CustomEndpointConfig> = {},
): ResolvedAppConfig {
  return {
    ...resolveConfig(rawBaseConfig, {mode: 'dev'}),
    customEndpoints,
  };
}

describe('computeFunctionOutputPath', () => {
  const configDir = '/test/project';
  const outDir = '/test/project/.ross/functions';

  it('strips leading "function/" prefix', () => {
    const source = '/test/project/function/users/get.ts';
    const output = computeFunctionOutputPath(source, configDir, outDir);
    expect(output).toBe('/test/project/.ross/functions/users/get.js');
  });

  it('strips leading "functions/" prefix', () => {
    const source = '/test/project/functions/ping.ts';
    const output = computeFunctionOutputPath(source, configDir, outDir);
    expect(output).toBe('/test/project/.ross/functions/ping.js');
  });

  it('handles paths without function/ prefix', () => {
    const source = '/test/project/handlers/profile.ts';
    const output = computeFunctionOutputPath(source, configDir, outDir);
    expect(output).toBe('/test/project/.ross/functions/handlers/profile.js');
  });

  it('handles root-level files', () => {
    const source = '/test/project/test.ts';
    const output = computeFunctionOutputPath(source, configDir, outDir);
    expect(output).toBe('/test/project/.ross/functions/test.js');
  });
});

describe('buildFunctions', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ross-builder-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, {recursive: true, force: true});
    vi.restoreAllMocks();
  });

  it('returns empty array when customEndpoints is empty or omitted', async () => {
    const config = createMockConfig({});
    const results = await buildFunctions({config, configDir: tempDir});
    expect(results).toEqual([]);
  });

  it('returns empty array when only SQL endpoints are present', async () => {
    const config = createMockConfig({
      getUsers: {
        method: 'GET',
        path: '/users',
        description: 'Get users',
        handler: {
          type: 'sql',
          sql: 'SELECT * FROM users;',
        },
      },
    });

    const results = await buildFunctions({config, configDir: tempDir});
    expect(results).toEqual([]);
  });

  it('compiles a single TypeScript function endpoint into a standalone bundle', async () => {
    const fnDir = path.join(tempDir, 'function');
    fs.mkdirSync(fnDir, {recursive: true});

    const sourcePath = path.join(fnDir, 'hello.ts');
    fs.writeFileSync(
      sourcePath,
      `export async function helloHandler(inputs: { name: string }) {
        return { message: 'Hello ' + inputs.name };
      }`,
    );

    const config = createMockConfig({
      hello: {
        method: 'POST',
        path: '/hello',
        description: 'Hello world',
        handler: {
          type: 'function',
          file: './function/hello.ts',
          exportName: 'helloHandler',
        },
      },
    });

    const results = await buildFunctions({config, configDir: tempDir});

    expect(results).toHaveLength(1);
    expect(results[0].endpointName).toBe('hello');
    expect(results[0].exportName).toBe('helloHandler');
    expect(results[0].outputFile).toBe(
      path.join(tempDir, '.ross', 'functions', 'hello.js'),
    );
    expect(fs.existsSync(results[0].outputFile)).toBe(true);

    // Verify bundle execution
    const mod = await import(
      pathToFileURL(results[0].outputFile).href + '?t=' + Date.now()
    );
    expect(typeof mod.helloHandler).toBe('function');
    const res = await mod.helloHandler({name: 'Alice'});
    expect(res).toEqual({message: 'Hello Alice'});
  });

  it('compiles nested directories mirroring the source structure', async () => {
    const nestedDir = path.join(tempDir, 'function', 'api', 'v1');
    fs.mkdirSync(nestedDir, {recursive: true});

    const sourcePath = path.join(nestedDir, 'user.ts');
    fs.writeFileSync(
      sourcePath,
      'export async function getUser(inputs: any) { return { id: 1 }; }',
    );

    const config = createMockConfig({
      getUser: {
        method: 'GET',
        path: '/user',
        description: 'Get user',
        handler: {
          type: 'function',
          file: './function/api/v1/user.ts',
          exportName: 'getUser',
        },
      },
    });

    const results = await buildFunctions({config, configDir: tempDir});

    expect(results).toHaveLength(1);
    expect(results[0].outputFile).toBe(
      path.join(tempDir, '.ross', 'functions', 'api', 'v1', 'user.js'),
    );
    expect(fs.existsSync(results[0].outputFile)).toBe(true);
  });

  it('compiles each unique source file only once when multiple endpoints share the file', async () => {
    const fnDir = path.join(tempDir, 'function');
    fs.mkdirSync(fnDir, {recursive: true});

    const sourcePath = path.join(fnDir, 'multi.ts');
    fs.writeFileSync(
      sourcePath,
      `export async function firstHandler() { return { step: 1 }; }
       export async function secondHandler() { return { step: 2 }; }`,
    );

    const config = createMockConfig({
      first: {
        method: 'GET',
        path: '/first',
        description: 'First',
        handler: {
          type: 'function',
          file: './function/multi.ts',
          exportName: 'firstHandler',
        },
      },
      second: {
        method: 'POST',
        path: '/second',
        description: 'Second',
        handler: {
          type: 'function',
          file: './function/multi.ts',
          exportName: 'secondHandler',
        },
      },
    });

    const buildSpy = vi.fn(esbuild.build);

    const results = await buildFunctions({
      config,
      configDir: tempDir,
      buildFn: buildSpy as unknown as typeof esbuild.build,
    });

    expect(results).toHaveLength(2);
    // esbuild.build should only have been called ONCE for multi.ts
    expect(buildSpy).toHaveBeenCalledTimes(1);

    expect(results[0].endpointName).toBe('first');
    expect(results[0].exportName).toBe('firstHandler');
    expect(results[1].endpointName).toBe('second');
    expect(results[1].exportName).toBe('secondHandler');
    expect(results[0].outputFile).toBe(results[1].outputFile);
  });

  it('inlines local imports into the standalone bundle', async () => {
    const fnDir = path.join(tempDir, 'function');
    fs.mkdirSync(fnDir, {recursive: true});

    const helperPath = path.join(fnDir, 'helper.ts');
    fs.writeFileSync(
      helperPath,
      'export function greet(name: string) { return "Welcome, " + name; }',
    );

    const mainPath = path.join(fnDir, 'main.ts');
    fs.writeFileSync(
      mainPath,
      `import { greet } from './helper';
       export async function welcome(inputs: { name: string }) {
         return { greeting: greet(inputs.name) };
       }`,
    );

    const config = createMockConfig({
      welcome: {
        method: 'GET',
        path: '/welcome',
        description: 'Welcome',
        handler: {
          type: 'function',
          file: './function/main.ts',
          exportName: 'welcome',
        },
      },
    });

    const results = await buildFunctions({config, configDir: tempDir});

    expect(results).toHaveLength(1);
    const mod = await import(
      pathToFileURL(results[0].outputFile).href + '?t=' + Date.now()
    );
    const output = await mod.welcome({name: 'Bob'});
    expect(output).toEqual({greeting: 'Welcome, Bob'});
  });

  it('inlines third-party packages into the standalone bundle', async () => {
    const fnDir = path.join(tempDir, 'function');
    fs.mkdirSync(fnDir, {recursive: true});

    const mainPath = path.join(fnDir, 'uuid.ts');
    fs.writeFileSync(
      mainPath,
      `import { ulid } from 'ulid';
       export async function generateId() {
         return { id: ulid() };
       }`,
    );

    const config = createMockConfig({
      genId: {
        method: 'POST',
        path: '/gen-id',
        description: 'Generate ID',
        handler: {
          type: 'function',
          file: './function/uuid.ts',
          exportName: 'generateId',
        },
      },
    });

    const results = await buildFunctions({config, configDir: tempDir});

    expect(results).toHaveLength(1);
    const mod = await import(
      pathToFileURL(results[0].outputFile).href + '?t=' + Date.now()
    );
    const output = await mod.generateId();
    expect(typeof output.id).toBe('string');
    expect(output.id.length).toBe(26);
  });

  it('throws an error when function file does not exist', async () => {
    const config = createMockConfig({
      missing: {
        method: 'GET',
        path: '/missing',
        description: 'Missing file',
        handler: {
          type: 'function',
          file: './function/does-not-exist.ts',
          exportName: 'handler',
        },
      },
    });

    await expect(buildFunctions({config, configDir: tempDir})).rejects.toThrow(
      /not found at/,
    );
  });

  it('throws an error when function file attempts path traversal outside project directory', async () => {
    const config = createMockConfig({
      escape: {
        method: 'GET',
        path: '/escape',
        description: 'Path traversal attempt',
        handler: {
          type: 'function',
          file: '../../outside.ts',
          exportName: 'handler',
        },
      },
    });

    await expect(buildFunctions({config, configDir: tempDir})).rejects.toThrow(
      /escapes the project directory/,
    );
  });

  it('throws an error when exportName is not exported from the module', async () => {
    const fnDir = path.join(tempDir, 'function');
    fs.mkdirSync(fnDir, {recursive: true});

    const sourcePath = path.join(fnDir, 'wrong-export.ts');
    fs.writeFileSync(
      sourcePath,
      'export async function someOtherFunction() { return 1; }',
    );

    const config = createMockConfig({
      testEndpoint: {
        method: 'GET',
        path: '/test',
        description: 'Missing export',
        handler: {
          type: 'function',
          file: './function/wrong-export.ts',
          exportName: 'nonExistentHandler',
        },
      },
    });

    await expect(buildFunctions({config, configDir: tempDir})).rejects.toThrow(
      /Function "nonExistentHandler" is not exported from "\.\/function\/wrong-export\.ts"/,
    );
  });

  it('throws an error when exported entity is not a function', async () => {
    const fnDir = path.join(tempDir, 'function');
    fs.mkdirSync(fnDir, {recursive: true});

    const sourcePath = path.join(fnDir, 'not-a-fn.ts');
    fs.writeFileSync(
      sourcePath,
      'export const constantValue = { not: "a function" };',
    );

    const config = createMockConfig({
      testEndpoint: {
        method: 'GET',
        path: '/test',
        description: 'Not a function',
        handler: {
          type: 'function',
          file: './function/not-a-fn.ts',
          exportName: 'constantValue',
        },
      },
    });

    await expect(buildFunctions({config, configDir: tempDir})).rejects.toThrow(
      /is not a function \(typeof is "object"\)/,
    );
  });
});
