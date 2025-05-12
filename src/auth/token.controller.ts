import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('token')
export class TokenController {
  @UseGuards(JwtAuthGuard)
  @Get('check')
  checkToken(@Request() req): any {
    return {
      message: 'Token is valid',
      user: req.user,
    };
  }
}
