import {AppConfig} from '@/interfaces/config';

function validateForeignKeys(config: AppConfig): string[] {
  const errors: string[] = [];

  // Map of all models for quick lookup
  const modelMap = new Map<string, (typeof config.models)[0]>();
  config.models.forEach(m => modelMap.set(m.name, m));

  config.models.forEach((model, mi) => {
    const path = `/models/${mi}`;

    if (!model.foreignKeys) return;

    const fieldNames = new Set(model.fields.map(f => f.name));
    const fkNames = new Set<string>();

    model.foreignKeys.forEach((fk, fi) => {
      const fkPath = `${path}/foreignKeys/${fi}`;

      // 1. unique FK name inside model
      if (fkNames.has(fk.name)) {
        errors.push(`${fkPath}: duplicate foreign key name "${fk.name}"`);
      } else {
        fkNames.add(fk.name);
      }

      // 2. local columns must exist
      fk.columns.forEach(col => {
        if (!fieldNames.has(col)) {
          errors.push(
            `${fkPath}/columns: column "${col}" does not exist in model "${model.name}"`,
          );
        }
      });

      // 3. reference table must exist
      const refModel = modelMap.get(fk.referenceTable);
      if (!refModel) {
        errors.push(
          `${fkPath}: referenceTable "${fk.referenceTable}" does not exist`,
        );
        return;
      }

      const refFieldNames = new Set(refModel.fields.map(f => f.name));

      // 4. reference columns must exist
      fk.referenceColumns.forEach(col => {
        if (!refFieldNames.has(col)) {
          errors.push(
            `${fkPath}/referenceColumns: column "${col}" does not exist in table "${fk.referenceTable}"`,
          );
        }
      });

      // 5. column length match (VERY important)
      if (fk.columns.length !== fk.referenceColumns.length) {
        errors.push(
          `${fkPath}: columns and referenceColumns must have same length`,
        );
      }
    });
  });

  return errors;
}

export default validateForeignKeys;
