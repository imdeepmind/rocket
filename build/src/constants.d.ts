/**
 * Authentication and OTP constants.
 */
export declare const BCRYPT_SALT_ROUNDS = 10;
export declare const DUMMY_PASSWORD_HASH = "$2b$10$LUYnx9VkcYhz6kSygO0OZ.T5X1ItaO/kXrcQu.B7NWCkw8M/Jry2q";
export declare const OTP_TTL_SECONDS = 600;
export declare const OTP_LENGTH = 6;
export declare const OTP_EMAIL_SUBJECT = "Your OTP Code";
export declare const NODE_CACHE_OTP_WARNING = "No distributed cache configured; OTPs are stored in node-cache (in-memory). OTPs are not shared across processes and will be lost on restart.";
