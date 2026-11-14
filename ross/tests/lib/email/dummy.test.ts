import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {createDummyEmailSender} from '@/lib/email/dummy';

describe('createDummyEmailSender', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the email instead of delivering it', async () => {
    const sender = createDummyEmailSender();

    await sender(
      'test@example.com',
      'Your OTP Code',
      '<h1>Hello</h1>',
      'Hello',
    );

    expect(consoleLogSpy).toHaveBeenCalledTimes(4);
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      1,
      'Email:',
      'test@example.com',
    );
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      2,
      'Subject:',
      'Your OTP Code',
    );
    expect(consoleLogSpy).toHaveBeenNthCalledWith(
      3,
      'HTML Body:',
      '<h1>Hello</h1>',
    );
    expect(consoleLogSpy).toHaveBeenNthCalledWith(4, 'Body:', 'Hello');
  });

  it('resolves without returning a value', async () => {
    const sender = createDummyEmailSender();

    await expect(
      sender('test@example.com', 'Subject', '<p>HTML</p>', 'Text'),
    ).resolves.toBeUndefined();
  });
});
