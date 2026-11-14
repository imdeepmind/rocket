import * as fs from 'fs';
import * as path from 'path';
import {pathToFileURL} from 'url';

import * as esbuild from 'esbuild';

import {ResolvedAppConfig} from '@/interfaces/config';

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
export function computeFunctionOutputPath(
  sourceFile: string,
  configDir: string,
  outDir: string,
): string {
  const relative = path.relative(configDir, sourceFile);
  const normalized = relative.replace(/^(?:\.\/)?(?:functions?)[/\\]/, '');
  const jsPath = normalized.replace(/\.[^./\\]+$/, '.js');
  return path.resolve(outDir, jsPath);
}

/**
 * Compiles all custom function endpoints declared in the configuration into
 * self-contained, independent single-file bundles under .ross/functions/.
 *
 * Each unique source file is compiled exactly once, even when multiple endpoints
 * reference the same file with different export names.
 */
export async function buildFunctions(
  options: BuildFunctionsOptions,
): Promise<BuildFunctionResult[]> {
  const {config} = options;
  const configDir = path.resolve(options.configDir ?? process.cwd());
  const outDir = path.resolve(
    options.outDir ?? path.join(configDir, '.ross', 'functions'),
  );

  const customEndpoints = config.customEndpoints ?? {};
  const functionEndpoints: Array<{
    name: string;
    file: string;
    exportName: string;
  }> = [];

  for (const [name, endpoint] of Object.entries(customEndpoints)) {
    if (endpoint.handler.type === 'function') {
      functionEndpoints.push({
        name,
        file: endpoint.handler.file,
        exportName: endpoint.handler.exportName,
      });
    }
  }

  if (functionEndpoints.length === 0) {
    return [];
  }

  // Ensure output directory exists
  fs.mkdirSync(outDir, {recursive: true});

  // Group endpoints by unique resolved source file to ensure each file is compiled only once
  const fileGroups = new Map<
    string,
    {
      outputFile: string;
      endpoints: Array<{name: string; exportName: string; rawFile: string}>;
    }
  >();

  for (const ep of functionEndpoints) {
    const resolvedSource = path.resolve(configDir, ep.file);

    // Guard against path traversal outside the project directory
    const relativeToConfig = path.relative(configDir, resolvedSource);
    if (
      relativeToConfig.startsWith('..') ||
      path.isAbsolute(relativeToConfig)
    ) {
      throw new Error(
        `Function file "${ep.file}" for endpoint "${ep.name}" escapes the project directory "${configDir}".`,
      );
    }

    if (
      !fs.existsSync(resolvedSource) ||
      !fs.statSync(resolvedSource).isFile()
    ) {
      throw new Error(
        `Function file "${ep.file}" for endpoint "${ep.name}" not found at "${resolvedSource}".`,
      );
    }

    const outputFile = computeFunctionOutputPath(
      resolvedSource,
      configDir,
      outDir,
    );

    let group = fileGroups.get(resolvedSource);
    if (!group) {
      group = {outputFile, endpoints: []};
      fileGroups.set(resolvedSource, group);
    }

    group.endpoints.push({
      name: ep.name,
      exportName: ep.exportName,
      rawFile: ep.file,
    });
  }

  const compile = options.buildFn ?? esbuild.build;
  const nodePaths = [
    path.resolve(configDir, 'node_modules'),
    path.resolve(process.cwd(), 'node_modules'),
  ];

  // Compile each unique source file exactly once
  for (const [sourceFile, {outputFile}] of fileGroups) {
    fs.mkdirSync(path.dirname(outputFile), {recursive: true});

    await compile({
      entryPoints: [sourceFile],
      outfile: outputFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node24',
      sourcemap: true,
      nodePaths,
    });
  }

  // Verify function exports for all endpoints from the compiled bundles
  const results: BuildFunctionResult[] = [];

  for (const [sourceFile, {outputFile, endpoints}] of fileGroups) {
    const fileUrl = pathToFileURL(outputFile).href + '?t=' + Date.now();
    const mod = (await import(fileUrl)) as Record<string, unknown>;

    for (const ep of endpoints) {
      if (!(ep.exportName in mod)) {
        throw new Error(
          `Function "${ep.exportName}" is not exported from "${ep.rawFile}" (compiled at "${outputFile}") for endpoint "${ep.name}".`,
        );
      }

      if (typeof mod[ep.exportName] !== 'function') {
        throw new Error(
          `Export "${ep.exportName}" in "${ep.rawFile}" for endpoint "${ep.name}" is not a function (typeof is "${typeof mod[ep.exportName]}").`,
        );
      }

      results.push({
        endpointName: ep.name,
        sourceFile,
        outputFile,
        exportName: ep.exportName,
      });
    }
  }

  return results;
}
