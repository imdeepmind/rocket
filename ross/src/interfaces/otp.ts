export interface OtpData {
  hashedOtp: string;
  email: string;
  createdAt: number;
  ulid: string;
}

export interface IOtpService {
  sendOTPForVerification(email: string): Promise<string>;
  verify(email: string, otp: string, ulid: string): Promise<boolean>;
}
