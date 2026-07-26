import Fastify, {FastifyInstance} from 'fastify';
import {afterEach, beforeEach, describe, expect, it, Mock, vi} from 'vitest';

import otpPlugin from '@/plugin/otp';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MockCache {
  get: Mock;
  set: Mock;
  delete: Mock;
  has: Mock;
  clear: Mock;
  raw: any;
}

interface MockCommunicate {
  sendEmail: Mock;
}

describe('OTP Plugin', () => {
  let app: FastifyInstance;
  let cacheMock: MockCache;
  let communicateMock: MockCommunicate;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock cache storage
    const cacheStorage = new Map<string, {value: unknown; expiry?: number}>();

    cacheMock = {
      get: vi.fn(async (key: string) => {
        const item = cacheStorage.get(key);
        if (!item) return null;
        if (item.expiry && item.expiry < Date.now()) {
          cacheStorage.delete(key);
          return null;
        }
        return item.value;
      }),
      set: vi.fn(async (key: string, value: unknown, ttlSeconds?: number) => {
        const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
        cacheStorage.set(key, {value, expiry});
      }),
      delete: vi.fn(async (key: string) => {
        cacheStorage.delete(key);
      }),
      has: vi.fn(async (key: string) => {
        return cacheStorage.has(key);
      }),
      clear: vi.fn(async () => {
        cacheStorage.clear();
      }),
      raw: {} as any,
    };

    communicateMock = {
      sendEmail: vi.fn(async () => {}),
    };
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Plugin Registration', () => {
    it('should decorate fastify with otp service', async () => {
      app = Fastify();
      (app as any).cache = cacheMock;
      (app as any).communicate = communicateMock;

      await app.register(otpPlugin);
      await app.ready();

      expect(app.hasDecorator('otp')).toBe(true);
      expect((app as any).otp).toBeDefined();
      expect(typeof (app as any).otp.sendOTPForVerification).toBe('function');
      expect(typeof (app as any).otp.verify).toBe('function');
    });
  });

  describe('sendOTPForVerification', () => {
    beforeEach(async () => {
      app = Fastify();
      (app as any).cache = cacheMock;
      (app as any).communicate = communicateMock;
      await app.register(otpPlugin);
      await app.ready();
    });

    it('should generate and hash OTP, store in cache, and send email', async () => {
      const email = 'test@example.com';

      const ulid = await (app as any).otp.sendOTPForVerification(email);

      // Verify ulid is returned
      expect(ulid).toBeDefined();
      expect(typeof ulid).toBe('string');
      expect(ulid.length).toBe(26); // ULID length

      // Verify cache.set was called with correct cache key
      expect(cacheMock.set).toHaveBeenCalledWith(
        `otp:${ulid}:${email}`,
        expect.objectContaining({
          email,
          hashedOtp: expect.any(String),
          createdAt: expect.any(Number),
          ulid,
        }),
        600, // 10 minutes TTL
      );

      // Verify email was sent
      expect(communicateMock.sendEmail).toHaveBeenCalledWith(
        email,
        expect.stringContaining('Your OTP Code'),
        expect.stringContaining('one-time password'),
      );
    });

    it('should send OTP with proper email format', async () => {
      const email = 'user@domain.com';

      await (app as any).otp.sendOTPForVerification(email);

      const [sentEmail, htmlBody, textBody] = (
        communicateMock.sendEmail as Mock
      ).mock.calls[0];

      expect(sentEmail).toBe(email);
      expect(htmlBody).toContain('<h2>Your OTP Code</h2>');
      expect(htmlBody).toContain('expire in 10 minutes');
      expect(textBody).toContain('one-time password');
      expect(textBody).toContain('expire in 10 minutes');
    });

    it('should generate 6-digit OTP', async () => {
      const email = 'test@example.com';

      // We'll verify indirectly by checking the email content
      await (app as any).otp.sendOTPForVerification(email);

      const [, htmlBody] = (communicateMock.sendEmail as Mock).mock.calls[0];

      // Extract OTP from HTML body (format: <strong>XXXXXX</strong>)
      const otpMatch = htmlBody.match(/<strong>(\d{6})<\/strong>/);
      expect(otpMatch).not.toBeNull();
      expect(otpMatch![1]).toMatch(/^\d{6}$/);
    });

    it('should handle multiple OTPs for different emails', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      const ulid1 = await (app as any).otp.sendOTPForVerification(email1);
      const ulid2 = await (app as any).otp.sendOTPForVerification(email2);

      expect(cacheMock.set).toHaveBeenCalledTimes(2);
      expect(cacheMock.set).toHaveBeenCalledWith(
        `otp:${ulid1}:${email1}`,
        expect.any(Object),
        600,
      );
      expect(cacheMock.set).toHaveBeenCalledWith(
        `otp:${ulid2}:${email2}`,
        expect.any(Object),
        600,
      );
    });
  });

  describe('verify', () => {
    beforeEach(async () => {
      app = Fastify();
      (app as any).cache = cacheMock;
      (app as any).communicate = communicateMock;
      await app.register(otpPlugin);
      await app.ready();
    });

    it('should successfully verify correct OTP and delete cache entry', async () => {
      const email = 'test@example.com';

      // First, send OTP
      const ulid = await (app as any).otp.sendOTPForVerification(email);

      // Extract the OTP from the email body to verify it
      const [, htmlBody] = (communicateMock.sendEmail as Mock).mock.calls[0];
      const otpMatch = htmlBody.match(/<strong>(\d{6})<\/strong>/);
      const correctOtp = otpMatch![1];

      // Now verify with correct OTP and ulid
      const result = await (app as any).otp.verify(email, correctOtp, ulid);

      expect(result).toBe(true);
      expect(cacheMock.delete).toHaveBeenCalledWith(`otp:${ulid}:${email}`);
    });

    it('should return false for incorrect OTP', async () => {
      const email = 'test@example.com';

      // Send OTP
      const ulid = await (app as any).otp.sendOTPForVerification(email);

      // Try to verify with wrong OTP
      const result = await (app as any).otp.verify(email, '000000', ulid);

      expect(result).toBe(false);
      // Cache should NOT be deleted for failed verification
      expect(cacheMock.delete).not.toHaveBeenCalled();
    });

    it('should return false when OTP not found in cache', async () => {
      const email = 'nonexistent@example.com';
      const fakeUlid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      const result = await (app as any).otp.verify(email, '123456', fakeUlid);

      expect(result).toBe(false);
      expect(cacheMock.get).toHaveBeenCalledWith(`otp:${fakeUlid}:${email}`);
    });

    it('should return false for expired OTP', async () => {
      const email = 'test@example.com';
      const fakeUlid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

      // Simulate cache returning null for expired entry
      (cacheMock.get as Mock).mockResolvedValueOnce(null);

      const result = await (app as any).otp.verify(email, '123456', fakeUlid);

      expect(result).toBe(false);
    });

    it('should verify multiple OTPs independently', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Send OTPs to both emails
      const ulid1 = await (app as any).otp.sendOTPForVerification(email1);
      const ulid2 = await (app as any).otp.sendOTPForVerification(email2);

      // Get OTPs from email bodies
      const calls = (communicateMock.sendEmail as Mock).mock.calls;
      const otp1Match = calls[0][1].match(/<strong>(\d{6})<\/strong>/);
      const otp2Match = calls[1][1].match(/<strong>(\d{6})<\/strong>/);

      const otp1 = otp1Match![1];
      const otp2 = otp2Match![1];

      // Reset mocks to get fresh tracking
      vi.clearAllMocks();

      // Verify first OTP
      const result1 = await (app as any).otp.verify(email1, otp1, ulid1);
      expect(result1).toBe(true);

      // Verify second OTP
      const result2 = await (app as any).otp.verify(email2, otp2, ulid2);
      expect(result2).toBe(true);

      // Both should have deleted their cache entries
      expect(cacheMock.delete).toHaveBeenCalledWith(`otp:${ulid1}:${email1}`);
      expect(cacheMock.delete).toHaveBeenCalledWith(`otp:${ulid2}:${email2}`);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      app = Fastify();
      (app as any).cache = cacheMock;
      (app as any).communicate = communicateMock;
      await app.register(otpPlugin);
      await app.ready();
    });

    it('should handle cache set errors in sendOTPForVerification', async () => {
      const email = 'test@example.com';
      const error = new Error('Cache error');

      (cacheMock.set as Mock).mockRejectedValueOnce(error);

      await expect(
        (app as any).otp.sendOTPForVerification(email),
      ).rejects.toThrow('Cache error');
    });

    it('should handle email send errors in sendOTPForVerification', async () => {
      const email = 'test@example.com';
      const error = new Error('Email send failed');

      (communicateMock.sendEmail as Mock).mockRejectedValueOnce(error);

      await expect(
        (app as any).otp.sendOTPForVerification(email),
      ).rejects.toThrow('Email send failed');
    });

    it('should handle cache get errors in verify', async () => {
      const email = 'test@example.com';
      const fakeUlid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
      const error = new Error('Cache error');

      (cacheMock.get as Mock).mockRejectedValueOnce(error);

      await expect(
        (app as any).otp.verify(email, '123456', fakeUlid),
      ).rejects.toThrow('Cache error');
    });
  });

  describe('Integration Tests', () => {
    beforeEach(async () => {
      app = Fastify();
      (app as any).cache = cacheMock;
      (app as any).communicate = communicateMock;
      await app.register(otpPlugin);
      await app.ready();
    });

    it('should complete full OTP flow: send and verify', async () => {
      const email = 'integration@example.com';

      // Step 1: Send OTP
      const ulid = await (app as any).otp.sendOTPForVerification(email);
      expect(communicateMock.sendEmail).toHaveBeenCalled();
      expect(ulid).toBeDefined();

      // Step 2: Extract OTP from email
      const [, htmlBody] = (communicateMock.sendEmail as Mock).mock.calls[0];
      const otpMatch = htmlBody.match(/<strong>(\d{6})<\/strong>/);
      const otp = otpMatch![1];

      // Step 3: Verify OTP with ulid
      const isValid = await (app as any).otp.verify(email, otp, ulid);
      expect(isValid).toBe(true);

      // Step 4: Verify cache was deleted with the new cache key format
      expect(cacheMock.delete).toHaveBeenCalledWith(`otp:${ulid}:${email}`);

      // Step 5: Trying to verify again should fail
      const secondVerify = await (app as any).otp.verify(email, otp, ulid);
      expect(secondVerify).toBe(false);
    });
  });
});
