export interface OtpData {
  hashedOtp: string;
  email: string;
  createdAt: number;
}

export interface IOtpService {
  sendOTPForVerification(email: string): Promise<void>;
  verify(email: string, otp: string): Promise<boolean>;
}
