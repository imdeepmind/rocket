import {DBEngine, ModelConfig} from '@/interfaces/config';

export function getUpdatedAtExpression(engine: DBEngine): string {
  if (engine === 'sqlite') {
    return "(datetime('now'))";
  }
  if (engine === 'mysql') {
    return 'CURRENT_TIMESTAMP';
  }
  return 'now()';
}

export function hasUpdatedAtField(model: ModelConfig): boolean {
  return 'updated_at' in model.fields;
}

export function buildUpdatedAtClause(
  model: ModelConfig,
  engine: DBEngine,
): string | null {
  if (!hasUpdatedAtField(model)) return null;
  return `"updated_at" = ${getUpdatedAtExpression(engine)}`;
}
