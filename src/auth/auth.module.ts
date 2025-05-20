import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { TokenController } from './token.controller';
import { User} from '../entities/users.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.sevice';
import { EmailModule } from 'src/email/email.module';
import { UsersModule } from 'src/user/user.module';
import { AttendanceModule } from 'src/attendance/attendance.module';
import { Attendance } from 'src/entities/attendances.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User,Attendance]),
    EmailModule,
    UsersModule,
    
  ],
  providers: [AuthService, JwtStrategy,OtpService],
  controllers: [AuthController, TokenController,OtpController],
})
export class AuthModule {}
