// src/dto/create-user.dto.ts
import { UserRole } from '../../entities/users.entity';

export class CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  orgId?: number; // Optional if it can be null
}