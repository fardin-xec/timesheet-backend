import { Controller, Request, Post,Put, Body, HttpStatus,Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ResponseDto } from '../dto/response.dto';
import { User } from 'src/entities/users.entity';
import { UsersService } from 'src/user/user.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService,
    private userService: UsersService
  ) {}

  @Post('login')
  async login(@Request() req): Promise<ResponseDto<{ access_token: string }>> {
    const { email, password , mobile } = req.body;
    const user = await this.authService.validateUser(email, password,mobile);

    if (!user) {
      return new ResponseDto(HttpStatus.UNAUTHORIZED, 'Invalid credentials');
    }

    const loginResponse = await this.authService.login(user);
    return new ResponseDto(HttpStatus.OK, 'Login successful', loginResponse);
  }

  @Put('/user/:id')
  async updateUser(@Param('id') id: string, @Body() userData: Partial<User>): Promise<ResponseDto<User>> {
      const data = await this.userService.update(+id, userData);
      if (!data) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'User not found');
      }
      return new ResponseDto(HttpStatus.OK, 'User updated successfully', data);
    }

}
