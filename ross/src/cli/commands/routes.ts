import * as path from 'path';

import chalk from 'chalk';

import {startServer} from '@/server';

import {resolveAndValidateConfig} from '@/lib/config/pipeline';

import {RoutesCLIOptions} from '@/interfaces';

import {loadConfigFile, resolveConfigPath} from '../config-finder';

function getMethodColor(method: string): string {
  const colors: Record<string, chalk.Chalk> = {
    GET: chalk.green,
    POST: chalk.yellow,
    PUT: chalk.blue,
    PATCH: chalk.blueBright,
    DELETE: chalk.red,
    HEAD: chalk.magenta,
    OPTIONS: chalk.cyan,
  };

  if (method.includes('/')) {
    return method
      .split('/')
      .map(m => {
        const color = colors[m.toUpperCase()] || chalk.white;
        return color(m);
      })
      .join(chalk.gray('/'));
  }

  return (colors[method.toUpperCase()] || chalk.white)(method);
}

/**
 * Handles 'ross routes' command execution.
 */
export async function handleRoutes(options: RoutesCLIOptions): Promise<void> {
  try {
    const mode = options.mode ?? 'dev';
    const configPath = resolveConfigPath(options.config);
    const configDir = path.dirname(path.resolve(configPath));
    const loadedConfig = loadConfigFile(configPath);
    const resolvedConfig = resolveAndValidateConfig(
      loadedConfig,
      mode,
      configDir,
      options,
    );

    const {app, routes} = await startServer(resolvedConfig);
    await app.close();

    const filteredRoutes = routes.filter(route => {
      const isHead = route.method.toUpperCase().split('/').includes('HEAD');
      return !isHead;
    });

    const sortedRoutes = [...filteredRoutes].sort((a, b) =>
      a.url.localeCompare(b.url),
    );

    console.log(
      chalk.cyan(`\nRegistered Routes (${sortedRoutes.length} endpoints):`),
    );
    console.log(
      chalk.gray(
        '──────────────────────────────────────────────────────────────────────────',
      ),
    );
    console.log(
      chalk.bold('METHOD'.padEnd(10) + 'PATH'.padEnd(45) + 'IDENTIFIER'),
    );
    console.log(
      chalk.gray(
        '──────────────────────────────────────────────────────────────────────────',
      ),
    );

    for (const route of sortedRoutes) {
      const coloredMethod = getMethodColor(route.method);
      const padding = ' '.repeat(Math.max(0, 10 - route.method.length));
      const urlPadded = route.url.padEnd(45);
      const identifier = route.apiIdentifier
        ? chalk.gray(route.apiIdentifier)
        : '';
      console.log(
        `${coloredMethod}${padding}${chalk.white(urlPadded)}${identifier}`,
      );
    }

    console.log(
      chalk.gray(
        '──────────────────────────────────────────────────────────────────────────\n',
      ),
    );
    process.exit(0);
  } catch (err) {
    console.error(
      chalk.red('Failed to list routes:'),
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}
