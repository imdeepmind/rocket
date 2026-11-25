import * as esbuild from 'esbuild';
import { ResolvedAppConfig } from '../../interfaces/config.js';
export interface BuildFunctionResult {
    endpointName: string;
    sourceFile: string;
    outputFile: string;
    exportName: string;
}
export interface BuildFunctionsOptions {
    config: ResolvedAppConfig;
    configDir?: string;
    outDir?: string;
    buildFn?: typeof esbuild.build;
}
/**
 * Computes the compiled JavaScript destination path inside the output directory,
 * mirroring the source file structure (stripping leading "function/" or "functions/").
 */
export declare function computeFunctionOutputPath(sourceFile: string, configDir: string, outDir: string): string;
/**
 * Compiles all custom function endpoints declared in the configuration into
 * self-contained, independent single-file bundles under .ross/functions/.
 *
 * Each unique source file is compiled exactly once, even when multiple endpoints
 * reference the same file with different export names.
 */
export declare function buildFunctions(options: BuildFunctionsOptions): Promise<BuildFunctionResult[]>;
