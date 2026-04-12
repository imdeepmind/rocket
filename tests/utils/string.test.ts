import {describe, expect, test} from 'vitest';

import {capitalizeFirstLetter} from '@/utils/string';

describe('string utils', () => {
  test('capitalizeFirstLetter', () => {
    expect(capitalizeFirstLetter('hello')).toBe('Hello');
    expect(capitalizeFirstLetter('Hello')).toBe('Hello');
    expect(capitalizeFirstLetter('')).toBe('');
    expect(capitalizeFirstLetter('123')).toBe('123');
    expect(capitalizeFirstLetter('123hello')).toBe('123hello');
    expect(capitalizeFirstLetter('hello-world')).toBe('Hello-world');
    expect(capitalizeFirstLetter('hello_world')).toBe('Hello_world');
    expect(capitalizeFirstLetter('hello world')).toBe('Hello world');
    expect(capitalizeFirstLetter('hello-world_123')).toBe('Hello-world_123');
  });
});
