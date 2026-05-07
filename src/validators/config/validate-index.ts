import {AppConfig} from '@/interfaces/config';

function validateIndexes(config: AppConfig): string[] {
  const errors: string[] = [];

  config.models.forEach((model, mi) => {
    const path = `/models/${mi}`;

    if (!model.indexes) return;

    const indexNames = new Set<string>();
    const fieldNames = new Set(model.fields.map(f => f.name));

    model.indexes.forEach((index, ii) => {
      const indexPath = `${path}/indexes/${ii}`;

      // 1. unique index name
      if (indexNames.has(index.name)) {
        errors.push(`${indexPath}: duplicate index name "${index.name}"`);
      } else {
        indexNames.add(index.name);
      }

      // 2. columns must exist
      index.columns.forEach(col => {
        if (!fieldNames.has(col)) {
          errors.push(
            `${indexPath}/columns: column "${col}" does not exist in fields`,
          );
        }
      });
    });
  });

  return errors;
}

export default validateIndexes;
