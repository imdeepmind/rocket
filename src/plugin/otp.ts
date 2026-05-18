import crypto from 'crypto';

import {FastifyInstance} from 'fastify';
import fp from 'fastify-plugin';

import {IOtpService, OtpData} from '@/interfaces/otp';

import {compare, hash} from '@/utils/hash';
import {OTP_LENGTH, OTP_TTL_SECONDS} from '@/constants';

/**
 * Get the cache key for an OTP
 */
function getOtpCacheKey(email: string): string {
  return `otp:${email}`;
}

/**
 * Generate a cryptographically secure random OTP of specified length (default 6 digits)
 */
function generateOtp(length: number = OTP_LENGTH): string {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
}

export default fp(
  async (fastify: FastifyInstance) => {
    const otpService: IOtpService = {
      /**
       * Generate OTP, hash it, store in cache, and send via email
       */
      async sendOTPForVerification(email: string): Promise<void> {
        try {
          const otp = generateOtp();
          const hashedOtp = await hash(otp);

          const otpData: OtpData = {
            hashedOtp,
            email,
            createdAt: Date.now(),
          };

          const cacheKey = getOtpCacheKey(email);
          await fastify.cache.set(cacheKey, otpData, OTP_TTL_SECONDS);

          // Send email with OTP
          const htmlBody = `
            <h2>Your OTP Code</h2>
            <p>Your one-time password is: <strong>${otp}</strong></p>
            <p>This code will expire in 10 minutes.</p>
          `;

          const body = `Your one-time password is: ${otp}\nThis code will expire in 10 minutes.`;

          await fastify.communicate.sendEmail(email, htmlBody, body);

          fastify.log.info(`OTP sent to email: ${email}`);
        } catch (err) {
          fastify.log.error(`Failed to send OTP for email ${email}: ${err}`);
          throw err;
        }
      },

      /**
       * Verify OTP and remove from cache on success
       */
      async verify(email: string, otp: string): Promise<boolean> {
        try {
          const cacheKey = getOtpCacheKey(email);
          const otpData = await fastify.cache.get<OtpData>(cacheKey);

          if (!otpData) {
            fastify.log.warn(`OTP not found or expired for email: ${email}`);
            return false;
          }

          // Compare provided OTP with stored hash
          const isValid = await compare(otp, otpData.hashedOtp);

          if (isValid) {
            // Delete OTP from cache after successful verification
            await fastify.cache.delete(cacheKey);
            fastify.log.info(`OTP verified successfully for email: ${email}`);
            return true;
          } else {
            fastify.log.warn(`Invalid OTP provided for email: ${email}`);
            return false;
          }
        } catch (err) {
          fastify.log.error(`Error verifying OTP for email ${email}: ${err}`);
          throw err;
        }
      },
    };

    fastify.decorate('otp', otpService);
  },
  {
    name: 'otp-plugin',
  },
);
