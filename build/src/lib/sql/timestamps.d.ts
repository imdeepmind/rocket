import { DBEngine, ModelConfig } from '../../interfaces/config.js';
export declare function getUpdatedAtExpression(engine: DBEngine): string;
export declare function hasUpdatedAtField(model: ModelConfig): boolean;
export declare function buildUpdatedAtClause(model: ModelConfig, engine: DBEngine): string | null;
