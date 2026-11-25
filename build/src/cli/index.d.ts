import { Command } from 'commander';
/**
 * Constructs and configures the Commander CLI program for ROSS.
 */
export declare function buildCli(): Command;
/**
 * CLI Entrypoint runner.
 */
export declare function runCli(argv?: string[]): Promise<void>;
