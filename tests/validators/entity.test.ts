import {describe, expect, it} from 'vitest';

import {validateEntityName} from '@/validators/entity';

describe('Entity Name Validator', () => {
  describe('Valid Names', () => {
    const validNames = [
      'users',
      'user_profile',
      'auth-token',
      '_private_data',
      'v1_api_resource',
      'my-entity-123',
      'a',
      '_',
    ];

    it.each(validNames)('should validate "%s" as a valid entity name', name => {
      expect(() => validateEntityName(name)).not.toThrow();
    });
  });

  describe('Reserved Keywords', () => {
    const reservedKeywords = [
      'all',
      'select',
      'table',
      'where',
      'group',
      'order',
      'primary',
      'user',
      'limit',
      'offset',
    ];

    it.each(reservedKeywords)(
      'should throw an error for reserved keyword "%s"',
      name => {
        expect(() => validateEntityName(name)).toThrow(
          `Entity name "${name}" is a reserved keyword`,
        );
      },
    );
  });

  describe('Invalid Formats', () => {
    const invalidFormats = [
      {
        name: '123_users',
        reason: 'must start with a letter or underscore',
      },
      {
        name: 'Users',
        reason: 'contain only lowercase letters',
      },
      {
        name: 'user profile',
        reason: 'contain only ... hyphens and underscores',
      },
      {
        name: 'user@domain',
        reason: 'contain only ... hyphens and underscores',
      },
      {
        name: 'user.name',
        reason: 'contain only ... hyphens and underscores',
      },
      {
        name: '-start-with-hyphen',
        reason: 'must start with a letter or underscore',
      },
      {
        name: '',
        reason: 'must start with a letter or underscore',
      },
    ];

    it.each(invalidFormats)(
      'should throw an error for invalid format "$name"',
      ({name}) => {
        expect(() => validateEntityName(name)).toThrow(
          `Entity name "${name}" is not valid, must start with a letter or underscore and contain only lowercase letters, numbers, hyphens and underscores`,
        );
      },
    );
  });
});
