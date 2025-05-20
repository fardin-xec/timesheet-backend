import { Body, Controller, Post, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { OtpService } from './otp.sevice';

class RequestOtpDto {
  email: string;
}

class VerifyOtpDto {
  email: string;
  otp: string;
}

@Controller('auth/otp')
export class OtpController {
  private readonly logger = new Logger(OtpController.name);

  constructor(private readonly otpService: OtpService) {}

  @Post('request')
  async requestOtp(@Body() requestOtpDto: RequestOtpDto) {
    try {
      const result = await this.otpService.createAndSendOtp(requestOtpDto.email);
      
      if (!result) {
        throw new HttpException('Failed to send OTP', HttpStatus.BAD_REQUEST);
      }
      
      return {
        success: true,
        message: 'OTP sent successfully to your email'
      };
    } catch (error) {
      this.logger.error(`OTP request failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to send OTP', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('verify')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    try {
      const { verified, message,data } = await this.otpService.verifyOtp(
        verifyOtpDto.email,
        verifyOtpDto.otp
      );
      
      if (!verified) {
        throw new HttpException(message, HttpStatus.BAD_REQUEST);
      }
      
      return {
        success: true,
        message,
        data,
      };
    } catch (error) {
      this.logger.error(`OTP verification failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to verify OTP', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('resend')
  async resendOtp(@Body() requestOtpDto: RequestOtpDto) {
    try {
      const result = await this.otpService.requestNewOtp(requestOtpDto.email);
      
      if (!result) {
        throw new HttpException('Failed to resend OTP', HttpStatus.BAD_REQUEST);
      }
      
      return {
        success: true,
        message: 'OTP resent successfully to your email'
      };
    } catch (error) {
      this.logger.error(`OTP resend failed: ${error.message}`, error.stack);
      throw new HttpException(
        error.message || 'Failed to resend OTP', 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}