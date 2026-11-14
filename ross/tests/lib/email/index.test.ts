import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createEmailSender} from '@/lib/email';
import {createDummyEmailSender} from '@/lib/email/dummy';
import {createSendgridEmailSender} from '@/lib/email/sendgrid';
import {createSesEmailSender} from '@/lib/email/ses';

import {EmailConfig} from '@/interfaces/config';
import {EmailSender} from '@/interfaces/email';

vi.mock('@/lib/email/dummy', () => ({createDummyEmailSender: vi.fn()}));
vi.mock('@/lib/email/sendgrid', () => ({
  createSendgridEmailSender: vi.fn(),
}));
vi.mock('@/lib/email/ses', () => ({createSesEmailSender: vi.fn()}));

describe('createEmailSender', () => {
  const sender = vi.fn() as EmailSender;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDummyEmailSender).mockReturnValue(sender);
    vi.mocked(createSesEmailSender).mockReturnValue(sender);
    vi.mocked(createSendgridEmailSender).mockReturnValue(sender);
  });

  it('creates a dummy sender for the dummy provider', () => {
    const config: EmailConfig = {provider: 'dummy'};

    expect(createEmailSender(config)).toBe(sender);
    expect(createDummyEmailSender).toHaveBeenCalledTimes(1);
    expect(createSesEmailSender).not.toHaveBeenCalled();
  });

  it('creates an SES sender with the provider options', () => {
    const options = {
      region: 'eu-west-1',
      fromEmail: 'noreply@example.com',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'secret',
    };
    const config: EmailConfig = {provider: 'aws-ses', config: options};

    expect(createEmailSender(config)).toBe(sender);
    expect(createSesEmailSender).toHaveBeenCalledWith(options);
    expect(createDummyEmailSender).not.toHaveBeenCalled();
  });

  it('creates an SES sender when credentials are omitted', () => {
    const options = {
      region: 'us-east-1',
      fromEmail: 'noreply@example.com',
    };

    createEmailSender({provider: 'aws-ses', config: options});

    expect(createSesEmailSender).toHaveBeenCalledWith(options);
  });

  it('creates a SendGrid sender with the provider options', () => {
    const options = {
      apiKey: 'SG.super-secret-api-key',
      fromEmail: 'noreply@example.com',
    };
    const config: EmailConfig = {provider: 'sendgrid', config: options};

    expect(createEmailSender(config)).toBe(sender);
    expect(createSendgridEmailSender).toHaveBeenCalledWith(options);
    expect(createDummyEmailSender).not.toHaveBeenCalled();
    expect(createSesEmailSender).not.toHaveBeenCalled();
  });

  it('throws for an unsupported provider', () => {
    const config = {provider: 'mailgun'} as unknown as EmailConfig;

    expect(() => createEmailSender(config)).toThrow(
      'Unsupported email provider: mailgun',
    );
  });
});
