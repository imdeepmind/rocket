import {AppConfig} from '@/interfaces/config';

function validateRelations(config: AppConfig): string[] {
  const errors: string[] = [];

  const modelMap = new Map(Object.entries(config.data.models));

  Object.entries(config.data.models).forEach(([modelName, model]) => {
    if (!model.relations) return;

    Object.entries(model.relations).forEach(([relationName, relation]) => {
      const path = `/data/models/${modelName}/relations/${relationName}`;

      // 1. local field must exist
      if (!(relation.localField in model.fields)) {
        errors.push(
          `${path}/localField: field "${relation.localField}" does not exist in model "${modelName}"`,
        );
      }

      // 2. referenced model must exist
      const refModel = modelMap.get(relation.model);
      if (!refModel) {
        errors.push(`${path}/model: model "${relation.model}" does not exist`);
        return;
      }

      // 3. foreign field must exist in referenced model
      if (!(relation.foreignField in refModel.fields)) {
        errors.push(
          `${path}/foreignField: field "${relation.foreignField}" does not exist in model "${relation.model}"`,
        );
      }
    });
  });

  return errors;
}

export default validateRelations;
