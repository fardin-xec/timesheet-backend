import { Controller, Request, Post, UseGuards, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ResponseDto } from '../dto/response.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Request() req): Promise<ResponseDto<{ access_token: string }>> {
    const { email, password } = req.body;
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      return new ResponseDto(HttpStatus.UNAUTHORIZED, 'Invalid credentials');
    }

    const loginResponse = await this.authService.login(user);
    return new ResponseDto(HttpStatus.OK, 'Login successful', loginResponse);
  }
}
