import {SendEmailCommand, SESClient} from '@aws-sdk/client-ses';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createSesEmailSender} from '@/lib/email/ses';

import {AwsSesEmailOptions} from '@/interfaces/config';

const {sendMock} = vi.hoisted(() => ({sendMock: vi.fn()}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: vi.fn(function (
    this: {config: unknown; send: typeof sendMock},
    config: unknown,
  ) {
    this.config = config;
    this.send = sendMock;
  }),
  SendEmailCommand: vi.fn(function (this: {input: unknown}, input: unknown) {
    this.input = input;
  }),
}));

const baseOptions: AwsSesEmailOptions = {
  region: 'us-east-1',
  fromEmail: 'noreply@example.com',
};

describe('createSesEmailSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('client construction', () => {
    it('passes explicit credentials to the SES client', () => {
      createSesEmailSender({
        ...baseOptions,
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'super-secret-key',
      });

      expect(vi.mocked(SESClient)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(SESClient)).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'super-secret-key',
        },
      });
    });

    it('omits credentials so the AWS default chain is used when none are configured', () => {
      createSesEmailSender(baseOptions);

      expect(vi.mocked(SESClient)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(SESClient)).toHaveBeenCalledWith({region: 'us-east-1'});
    });

    it('only creates one client per sender', async () => {
      const sender = createSesEmailSender(baseOptions);

      await sender('one@example.com', 'One', '<p>1</p>', '1');
      await sender('two@example.com', 'Two', '<p>2</p>', '2');

      expect(vi.mocked(SESClient)).toHaveBeenCalledTimes(1);
      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendEmail', () => {
    it('builds a SendEmailCommand with HTML and text bodies', async () => {
      const sender = createSesEmailSender(baseOptions);

      await sender(
        'recipient@example.com',
        'Your OTP Code',
        '<h1>123456</h1>',
        '123456',
      );

      expect(vi.mocked(SendEmailCommand)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(SendEmailCommand)).toHaveBeenCalledWith({
        Source: 'noreply@example.com',
        Destination: {ToAddresses: ['recipient@example.com']},
        Message: {
          Subject: {Data: 'Your OTP Code', Charset: 'UTF-8'},
          Body: {
            Html: {Data: '<h1>123456</h1>', Charset: 'UTF-8'},
            Text: {Data: '123456', Charset: 'UTF-8'},
          },
        },
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sendMock.mock.calls[0][0]).toEqual({
        input: {
          Source: 'noreply@example.com',
          Destination: {ToAddresses: ['recipient@example.com']},
          Message: {
            Subject: {Data: 'Your OTP Code', Charset: 'UTF-8'},
            Body: {
              Html: {Data: '<h1>123456</h1>', Charset: 'UTF-8'},
              Text: {Data: '123456', Charset: 'UTF-8'},
            },
          },
        },
      });
    });

    it('sends the command through the SES client', async () => {
      const sender = createSesEmailSender(baseOptions);

      await sender('a@example.com', 'Subject', '<p>Html</p>', 'Text');

      const command = sendMock.mock.calls[0][0] as {input: unknown};
      expect(command.input).toEqual({
        Source: 'noreply@example.com',
        Destination: {ToAddresses: ['a@example.com']},
        Message: {
          Subject: {Data: 'Subject', Charset: 'UTF-8'},
          Body: {
            Html: {Data: '<p>Html</p>', Charset: 'UTF-8'},
            Text: {Data: 'Text', Charset: 'UTF-8'},
          },
        },
      });
    });

    it('propagates SES errors to the caller', async () => {
      sendMock.mockRejectedValueOnce(new Error('SES is unavailable'));
      const sender = createSesEmailSender(baseOptions);

      await expect(
        sender('a@example.com', 'Subject', '<p>Html</p>', 'Text'),
      ).rejects.toThrow('SES is unavailable');
    });

    it('supports multiple recipients across calls', async () => {
      const sender = createSesEmailSender(baseOptions);

      await sender('first@example.com', 'First', '<p>1</p>', '1');
      await sender('second@example.com', 'Second', '<p>2</p>', '2');

      const destinations = sendMock.mock.calls.map(
        ([command]) =>
          (command as {input: {Destination: {ToAddresses: string[]}}}).input
            .Destination.ToAddresses,
      );

      expect(destinations).toEqual([
        ['first@example.com'],
        ['second@example.com'],
      ]);
    });
  });
});
