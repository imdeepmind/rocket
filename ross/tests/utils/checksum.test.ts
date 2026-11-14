import {describe, expect, it} from 'vitest';

import {computeChecksum} from '@/utils/checksum';

describe('utils/checksum', () => {
  it('computes 64-character sha256 hex checksum', () => {
    const checksum = computeChecksum('INSERT INTO users VALUES (1);');
    expect(checksum).toHaveLength(64);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalizes CRLF to LF so cross-platform content hashes match', () => {
    const crlfContent =
      'INSERT INTO users VALUES (1);\r\nUPDATE users SET x = 2;\r\n';
    const lfContent =
      'INSERT INTO users VALUES (1);\nUPDATE users SET x = 2;\n';

    expect(computeChecksum(crlfContent)).toBe(computeChecksum(lfContent));
  });

  it('computes different checksums for different content', () => {
    const hash1 = computeChecksum('SELECT 1;');
    const hash2 = computeChecksum('SELECT 2;');

    expect(hash1).not.toBe(hash2);
  });
});
