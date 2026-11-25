import { ConfigShowCLIOptions, ConfigValidateCLIOptions } from '../../interfaces/index.js';
/**
 * Handles 'ross config show' command execution.
 */
export declare function handleConfigShow(options: ConfigShowCLIOptions): Promise<void>;
/**
 * Handles 'ross config validate' (or 'ross check') command execution.
 */
export declare function handleConfigValidate(options: ConfigValidateCLIOptions): Promise<void>;
