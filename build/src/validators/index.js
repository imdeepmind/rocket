import * as fs from 'fs';
import * as path from 'path';
import { InvalidArgumentError } from 'commander';
// Validate config file path
export function validateConfigPath(value) {
    const resolvedPath = path.resolve(value);
    if (!fs.existsSync(resolvedPath)) {
        throw new InvalidArgumentError(`Config file not found: ${resolvedPath}`);
    }
    if (!fs.statSync(resolvedPath).isFile()) {
        throw new InvalidArgumentError(`Not a file: ${resolvedPath}`);
    }
    return resolvedPath;
}
// Validate port
export function validatePort(value) {
    const port = Number(value);
    if (Number.isNaN(port)) {
        throw new InvalidArgumentError('Port must be a number');
    }
    if (port < 1 || port > 65535) {
        throw new InvalidArgumentError('Port must be between 1 and 65535');
    }
    return port;
}
// Validate mode
export function validateMode(value) {
    const allowed = ['dev', 'prod'];
    if (!allowed.includes(value)) {
        throw new InvalidArgumentError(`Mode must be one of: ${allowed.join(', ')}`);
    }
    return value;
}
//# sourceMappingURL=index.js.map