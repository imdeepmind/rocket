import {AppConfig, ResolvedAppConfig} from '@/interfaces/config';

function validateRbacConstraints(
  config: AppConfig | ResolvedAppConfig,
): string[] {
  const errors: string[] = [];

  const rbac = config.rbac;
  const apis = config.apis ?? {};

  // If RBAC is absent or disabled:
  if (!rbac || !rbac.enabled) {
    for (const [key, apiConfig] of Object.entries(apis)) {
      if (apiConfig?.roles && apiConfig.roles.length > 0) {
        errors.push(
          `apis/${key}/roles: roles cannot be configured when rbac is not enabled`,
        );
      }
    }
    return errors;
  }

  const roles = rbac.roles ?? {};
  const declaredRoles = Object.keys(roles);

  // 1. Authentication requirement:
  if (!config.authentication || !config.authentication.enabled) {
    errors.push('/rbac: authentication must be enabled when rbac is enabled');
  } else if (config.authentication.provider?.type === 'api-key') {
    errors.push(
      "/rbac: static 'api-key' authentication cannot be used when rbac is enabled",
    );
  }

  // 2. Model & Field Integrity:
  const models = config.data?.models;
  const modelName = rbac.modelName;
  const roleField = rbac.roleField;

  const model = models && modelName ? models[modelName] : undefined;
  if (!model) {
    errors.push(
      `/rbac/modelName: model "${modelName}" does not exist in data.models`,
    );
  } else {
    const field = roleField ? model.fields?.[roleField] : undefined;
    if (!field) {
      errors.push(
        `/rbac/roleField: field "${roleField}" does not exist in model "${modelName}"`,
      );
    } else {
      if (field.type !== 'string' && field.type !== 'enum') {
        errors.push(
          `/rbac/roleField: field "${roleField}" in model "${modelName}" must be of type string or enum`,
        );
      }

      if (field.type === 'enum' || field.values) {
        const fieldValues = field.values ?? [];

        const declaredSet = new Set(declaredRoles);
        const fieldSet = new Set(fieldValues);

        const isExactMatch =
          declaredSet.size === fieldSet.size &&
          declaredRoles.every(r => fieldSet.has(r));

        if (!isExactMatch) {
          errors.push(
            `/rbac/roleField: enum values for field "${roleField}" must match declared roles in rbac.roles exactly`,
          );
        }
      }
    }
  }

  // 3. Role Integrity:
  if (
    !rbac.defaultRole ||
    !Object.prototype.hasOwnProperty.call(roles, rbac.defaultRole)
  ) {
    errors.push(
      `/rbac/defaultRole: defaultRole "${rbac.defaultRole}" is not defined in rbac.roles`,
    );
  }

  for (const [roleName, roleDef] of Object.entries(roles)) {
    if (roleDef.includes) {
      roleDef.includes.forEach((inc, i) => {
        if (inc === '*') {
          return;
        }

        if (inc.endsWith(':*')) {
          const prefix = inc.slice(0, -2);
          const hasMatch = declaredRoles.some(r => r.startsWith(`${prefix}:`));
          if (!hasMatch) {
            errors.push(
              `/rbac/roles/${roleName}/includes/${i}: wildcard pattern "${inc}" does not match any declared role in rbac.roles`,
            );
          }
          return;
        }

        if (!Object.prototype.hasOwnProperty.call(roles, inc)) {
          errors.push(
            `/rbac/roles/${roleName}/includes/${i}: role "${inc}" does not exist in rbac.roles`,
          );
        }
      });
    }
  }

  // 4. Route Policy Integrity:
  for (const [key, apiConfig] of Object.entries(apis)) {
    if (apiConfig?.roles) {
      if (!apiConfig.authorization) {
        errors.push(
          `apis/${key}/roles: endpoint with roles must have authorization enabled`,
        );
      }

      apiConfig.roles.forEach((rolePattern, i) => {
        if (rolePattern === '*') {
          return;
        }

        if (rolePattern.endsWith(':*')) {
          const prefix = rolePattern.slice(0, -2);
          const hasMatch = declaredRoles.some(r => r.startsWith(`${prefix}:`));
          if (!hasMatch) {
            errors.push(
              `apis/${key}/roles/${i}: wildcard pattern "${rolePattern}" does not match any declared role in rbac.roles`,
            );
          }
          return;
        }

        if (!Object.prototype.hasOwnProperty.call(roles, rolePattern)) {
          errors.push(
            `apis/${key}/roles/${i}: role "${rolePattern}" does not exist in rbac.roles`,
          );
        }
      });
    }
  }

  return errors;
}

export default validateRbacConstraints;
