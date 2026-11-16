import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {afterEach, describe, expect, it} from 'vitest';

import {
  findPackageDir,
  readPackageManifest,
  resolveBinEntry,
  resolveDrizzleKitCli,
  resolveDrizzleOrmDir,
  resolvePackageDir,
} from '@/migrator/drizzle-paths';

const createdDirs: string[] = [];

const makePackage = (
  manifest: Record<string, unknown>,
  {nested = false}: {nested?: boolean} = {},
): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ross-paths-'));
  createdDirs.push(root);
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(manifest, null, 2),
  );

  if (!nested) {
    return root;
  }

  const deep = path.join(root, 'build', 'src', 'module');
  fs.mkdirSync(deep, {recursive: true});

  return deep;
};

afterEach(() => {
  while (createdDirs.length > 0) {
    fs.rmSync(createdDirs.pop() as string, {recursive: true, force: true});
  }
});

describe('readPackageManifest', () => {
  it('should read a manifest from a package directory', () => {
    const dir = makePackage({name: 'example', bin: './bin.cjs'});

    expect(readPackageManifest(dir)).toEqual({
      name: 'example',
      bin: './bin.cjs',
    });
  });

  it('should return undefined when the directory has no manifest', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ross-paths-'));
    createdDirs.push(dir);

    expect(readPackageManifest(dir)).toBeUndefined();
  });
});

describe('findPackageDir', () => {
  it('should return the directory itself when it is the package root', () => {
    const dir = makePackage({name: 'example'});

    expect(findPackageDir(dir, 'example')).toBe(dir);
  });

  it('should walk up until the package root is found', () => {
    const nested = makePackage({name: 'example'}, {nested: true});

    expect(findPackageDir(nested, 'example')).toBe(
      path.resolve(nested, '..', '..', '..'),
    );
  });

  it('should throw when no matching package exists in any ancestor', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ross-paths-'));
    createdDirs.push(dir);

    expect(() => findPackageDir(dir, 'missing-package')).toThrow(
      'Unable to locate the "missing-package" package',
    );
  });
});

describe('resolveBinEntry', () => {
  it('should resolve an object bin entry', () => {
    const dir = makePackage({name: 'example', bin: {example: './bin.cjs'}});

    expect(resolveBinEntry(dir, 'example')).toBe(path.join(dir, 'bin.cjs'));
  });

  it('should resolve a string bin entry', () => {
    const dir = makePackage({name: 'example', bin: './cli.js'});

    expect(resolveBinEntry(dir, 'example')).toBe(path.join(dir, 'cli.js'));
  });

  it('should throw when the package has no matching bin entry', () => {
    const dir = makePackage({name: 'example', bin: {other: './other.js'}});

    expect(() => resolveBinEntry(dir, 'example')).toThrow(
      'Package "example" does not expose a CLI entry point',
    );
  });
});

describe('resolvePackageDir', () => {
  it('should resolve packages installed next to ross', () => {
    expect(
      findPackageDir(resolvePackageDir('drizzle-orm'), 'drizzle-orm'),
    ).toBe(resolvePackageDir('drizzle-orm'));
    expect(resolveDrizzleOrmDir()).toBe(resolvePackageDir('drizzle-orm'));
    expect(resolveDrizzleKitCli()).toMatch(/drizzle-kit[/\\]bin\.cjs$/);
  });
});
