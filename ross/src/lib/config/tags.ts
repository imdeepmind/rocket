import {parseApiIdentifier} from '@/lib/config/identifier';

import {capitalizeFirstLetter} from '@/utils/string';

const MODEL_OPERATION_TAGS: Record<string, string> = {
  search: 'Read',
  index: 'Read',
  getAll: 'Read',
  insert: 'Insert',
  edit: 'Update',
  delete: 'Delete',
};

function getAuthOperationTag(operation: string): string {
  if (operation === 'login') return 'Login';
  if (operation === 'registration') return 'Register';
  if (operation === 'changePassword' || operation === 'forgotPassword') {
    return 'Password';
  }
  if (operation.startsWith('otpVerify') || operation.startsWith('resendOtp')) {
    return 'OTP';
  }
  return 'Profile';
}

/**
 * Derive the Swagger tags for an API identifier.
 *
 * Format: `<module>.<variant>.<model>.<field>.<operation>`
 *
 *   - model:     `[Model, Read|Insert|Update|Delete]`
 *   - aggregate: `[Model, Read]`
 *   - auth:      `[Model, Auth, Login|Register|Password|Profile|OTP]`
 *   - custom:    `['Custom Endpoints']`
 */
export function deriveApiTags(identifier: string): string[] {
  const parsed = parseApiIdentifier(identifier);

  if (!parsed) return [];

  const modelTag = capitalizeFirstLetter(parsed.model);

  switch (parsed.module) {
    case 'model':
      return [modelTag, MODEL_OPERATION_TAGS[parsed.operation] ?? 'Read'];
    case 'aggregate':
      return [modelTag, 'Read'];
    case 'auth':
      return [modelTag, 'Auth', getAuthOperationTag(parsed.operation)];
    case 'custom':
      return ['Custom Endpoints'];
    default:
      return [modelTag];
  }
}
