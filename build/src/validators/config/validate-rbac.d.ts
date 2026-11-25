import { AppConfig, ResolvedAppConfig } from '../../interfaces/config.js';
declare function validateRbacConstraints(config: AppConfig | ResolvedAppConfig): string[];
export default validateRbacConstraints;
