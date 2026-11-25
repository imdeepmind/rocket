import { ResolvedAppConfig } from '../../interfaces/config.js';
export interface RouteInfo {
    method: string;
    url: string;
    apiIdentifier?: string;
}
export declare function showWelcomeScreen(config: ResolvedAppConfig, port: number, routes: RouteInfo[]): void;
