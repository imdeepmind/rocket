import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createSendgridEmailSender} from '@/lib/email/sendgrid';

import {SendgridEmailOptions} from '@/interfaces/config';

const {sendMock, setApiKeyMock} = vi.hoisted(() => ({
  sendMock: vi.fn(),
  setApiKeyMock: vi.fn(),
}));

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: setApiKeyMock,
    send: sendMock,
  },
}));

const baseOptions: SendgridEmailOptions = {
  apiKey: 'SG.super-secret-api-key',
  fromEmail: 'noreply@example.com',
};

describe('createSendgridEmailSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('client construction', () => {
    it('sets the API key exactly once per sender', () => {
      createSendgridEmailSender(baseOptions);

      expect(setApiKeyMock).toHaveBeenCalledTimes(1);
      expect(setApiKeyMock).toHaveBeenCalledWith('SG.super-secret-api-key');
      expect(sendMock).not.toHaveBeenCalled();
    });

    it('does not send anything until the sender is invoked', async () => {
      const sender = createSendgridEmailSender(baseOptions);

      await sender('one@example.com', 'One', '<p>1</p>', '1');
      await sender('two@example.com', 'Two', '<p>2</p>', '2');

      expect(setApiKeyMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendEmail', () => {
    it('sends the message with HTML and text bodies', async () => {
      const sender = createSendgridEmailSender(baseOptions);

      await sender(
        'recipient@example.com',
        'Your OTP Code',
        '<h1>123456</h1>',
        '123456',
      );

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledWith({
        to: 'recipient@example.com',
        from: 'noreply@example.com',
        subject: 'Your OTP Code',
        text: '123456',
        html: '<h1>123456</h1>',
      });
    });

    it('resolves without returning a value', async () => {
      const sender = createSendgridEmailSender(baseOptions);

      await expect(
        sender('a@example.com', 'Subject', '<p>Html</p>', 'Text'),
      ).resolves.toBeUndefined();
    });

    it('propagates SendGrid errors to the caller', async () => {
      sendMock.mockRejectedValueOnce(new Error('SendGrid is unavailable'));
      const sender = createSendgridEmailSender(baseOptions);

      await expect(
        sender('a@example.com', 'Subject', '<p>Html</p>', 'Text'),
      ).rejects.toThrow('SendGrid is unavailable');
    });

    it('supports multiple recipients across calls', async () => {
      const sender = createSendgridEmailSender(baseOptions);

      await sender('first@example.com', 'First', '<p>1</p>', '1');
      await sender('second@example.com', 'Second', '<p>2</p>', '2');

      const recipients = sendMock.mock.calls.map(
        ([message]) => (message as {to: string}).to,
      );

      expect(recipients).toEqual(['first@example.com', 'second@example.com']);
    });
  });
});
