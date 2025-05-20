import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/users.entity';
import { EmailService } from '../email/email.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MINUTES = 10; // OTP valid for 10 minutes
  private readonly MAX_OTP_ATTEMPTS = 5; // Maximum allowed verification attempts

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  /**
   * Generate a random numeric OTP of specified length
   */
  private generateOtp(length: number = 6): string {
    // Generate a random number and pad with zeros if needed
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return Math.floor(min + Math.random() * (max - min)).toString();
  }

  /**
   * Create and send an OTP to user's email
   */
  async createAndSendOtp(email: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      
      if (!user) {
        this.logger.warn(`OTP generation attempted for non-existent email: ${email}`);
        return false;
      }

      // Generate new OTP and set expiration
      const otp = this.generateOtp();
      const otpExpiresAt = new Date();
      otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);
      
      // Reset OTP attempts when generating a new OTP
      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;

      console.log(user);
      
      
      await this.userRepository.save(user);
      
      // Send OTP via email
      await this.sendOtpEmail(user.email, otp);
      
      this.logger.log(`OTP sent successfully to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to create and send OTP: ${error.message}`, error.stack);
      throw new Error('Failed to generate OTP');
    }
  }

  /**
   * Verify the OTP provided by the user
   */
  async verifyOtp(email: string, otpToVerify: string): Promise<{ verified: boolean; message: string ,data: User}> {
    try {
      let data=null;
      const user = await this.userRepository.findOne({ where: { email } });
      console.log(user);
      
      
      if (!user) {
        return { verified: false, message: 'User not found' ,data};
      }

      // Check if user has exceeded maximum attempts
      if (user.otpAttempts >= this.MAX_OTP_ATTEMPTS) {
        return { verified: false, message: 'Maximum verification attempts exceeded. Please request a new OTP.',data };
      }

      // Increment attempt counter
      user.otpAttempts += 1;
      await this.userRepository.save(user);
      
      // Check if OTP exists and hasn't expired
      if (!user.otp || !user.otpExpiresAt) {
        return { verified: false, message: 'No OTP found. Please request a new one.',data };
      }

      const now = new Date();
      if (now > user.otpExpiresAt) {
        return { verified: false, message: 'OTP has expired. Please request a new one.',data };
      }

      // Verify OTP
      if (user.otp !== otpToVerify) {
        return { 
          verified: false, 
          message: `Invalid OTP. ${this.MAX_OTP_ATTEMPTS - user.otpAttempts} attempts remaining.` ,
          data
        };
      }

      // OTP is valid - clear it and mark user as verified if needed
      user.otp = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      data = await this.userRepository.save(user);
      
      return { verified: true, message: 'OTP verified successfully' ,data};
    } catch (error) {
      this.logger.error(`OTP verification failed: ${error.message}`, error.stack);
      throw new Error('OTP verification failed');
    }
  }

  /**
   * Send OTP via email
   */
  private async sendOtpEmail(email: string, otp: string): Promise<void> {
    const subject = 'Your Verification Code';
    const text = `Your verification code is: ${otp}. This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Verification Code</h2>
        <p>Your verification code is:</p>
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px;">
          ${otp}
        </div>
        <p>This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      </div>
    `;

    await this.emailService.sendMail(email, subject, text, html);
  }

  /**
   * Request a new OTP (used for resending)
   */
  async requestNewOtp(email: string): Promise<boolean> {
    return this.createAndSendOtp(email);
  }
}