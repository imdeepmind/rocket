interface PackageManifest {
    name?: string;
    bin?: string | Record<string, string>;
}
/**
 * Read a package manifest, or `undefined` when the directory holds none.
 */
export declare function readPackageManifest(directory: string): PackageManifest | undefined;
/**
 * Nearest ancestor of `startDir` (inclusive) that is the root of
 * `packageName`. An entry point is not always located at the package root, so
 * callers start from the directory holding it and walk up.
 */
export declare function findPackageDir(startDir: string, packageName: string): string;
/**
 * Directory of a package installed alongside ross.
 *
 * Resolution starts from this module's own location, so it neither depends on
 * the caller's working directory nor on how ross was installed (project
 * dependency, `npx` cache or global install): ross and its dependencies always
 * sit in the same tree.
 */
export declare function resolvePackageDir(packageName: string): string;
/**
 * Absolute path to the CLI entry declared by a package manifest. Reading `bin`
 * avoids depending on PATH or on the presence of a `node_modules/.bin` shim,
 * neither of which is guaranteed for `npx` and global installs.
 */
export declare function resolveBinEntry(packageDir: string, binName: string): string;
/** Absolute path to the drizzle-kit CLI shipped with this ross install. */
export declare function resolveDrizzleKitCli(): string;
/** Directory of the drizzle-orm package shipped with this ross install. */
export declare function resolveDrizzleOrmDir(): string;
export {};
