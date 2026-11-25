import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
/**
 * Read a package manifest, or `undefined` when the directory holds none.
 */
export function readPackageManifest(directory) {
    const manifestPath = path.join(directory, 'package.json');
    if (!fs.existsSync(manifestPath)) {
        return undefined;
    }
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}
/**
 * Nearest ancestor of `startDir` (inclusive) that is the root of
 * `packageName`. An entry point is not always located at the package root, so
 * callers start from the directory holding it and walk up.
 */
export function findPackageDir(startDir, packageName) {
    let current = startDir;
    for (;;) {
        if (readPackageManifest(current)?.name === packageName) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    throw new Error(`Unable to locate the "${packageName}" package`);
}
/**
 * Directory of a package installed alongside ross.
 *
 * Resolution starts from this module's own location, so it neither depends on
 * the caller's working directory nor on how ross was installed (project
 * dependency, `npx` cache or global install): ross and its dependencies always
 * sit in the same tree.
 */
export function resolvePackageDir(packageName) {
    const entry = fileURLToPath(import.meta.resolve(packageName));
    return findPackageDir(path.dirname(entry), packageName);
}
/**
 * Absolute path to the CLI entry declared by a package manifest. Reading `bin`
 * avoids depending on PATH or on the presence of a `node_modules/.bin` shim,
 * neither of which is guaranteed for `npx` and global installs.
 */
export function resolveBinEntry(packageDir, binName) {
    const bin = readPackageManifest(packageDir)?.bin;
    const entry = typeof bin === 'string' ? bin : bin?.[binName];
    if (!entry) {
        throw new Error(`Package "${binName}" does not expose a CLI entry point`);
    }
    return path.resolve(packageDir, entry);
}
/** Absolute path to the drizzle-kit CLI shipped with this ross install. */
export function resolveDrizzleKitCli() {
    return resolveBinEntry(resolvePackageDir('drizzle-kit'), 'drizzle-kit');
}
/** Directory of the drizzle-orm package shipped with this ross install. */
export function resolveDrizzleOrmDir() {
    return resolvePackageDir('drizzle-orm');
}
//# sourceMappingURL=drizzle-paths.js.map