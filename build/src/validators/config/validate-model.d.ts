import Ajv from 'ajv';
import { AppConfig } from '../../interfaces/config.js';
declare function validateModelValidation(config: AppConfig, ajv: Ajv): string[];
export default validateModelValidation;
