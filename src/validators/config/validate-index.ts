import {AppConfig} from '@/interfaces/config';

function validateIndexes(config: AppConfig): string[] {
  const errors: string[] = [];

  Object.entries(config.data.models).forEach(([modelName, model]) => {
    if (!model.indexes) return;

    Object.entries(model.indexes).forEach(([indexName, index]) => {
      const indexPath = `/data/models/${modelName}/indexes/${indexName}`;

      // fields must exist
      index.fields.forEach(col => {
        if (!(col in model.fields)) {
          errors.push(
            `${indexPath}/fields: field "${col}" does not exist in model fields`,
          );
        }
      });
    });
  });

  return errors;
}

export default validateIndexes;
