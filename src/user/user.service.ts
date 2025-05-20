import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/users.entity';
import { CreateUserDto } from './dto/user.dto';

import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(User: CreateUserDto): Promise<User> {
    // Check if username or email already exists
    const existingUser = await this.usersRepository.findOne({
      where: [
        { email: User.email },
      ],
    });
    

    if (existingUser) {
      throw new BadRequestException('Username or email already exists');
    }


    // Hash password
    const hashedPassword = await bcrypt.hash(User.password, 10);
    
    const user = this.usersRepository.create({
      ...User,
      password: hashedPassword,
    });
    
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: ['id', 'username', 'email', 'role', 'orgId', 'createdAt', 'updatedAt'],
      relations: ['organization'],
    });
  }

  async findByOrgId(orgId: number): Promise<User[]> {
    return this.usersRepository.find({
      where: { orgId },
      select: ['id', 'username', 'email', 'role', 'orgId', 'createdAt', 'updatedAt'],
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: id },
      select: ['id', 'username', 'email', 'role', 'orgId', 'createdAt', 'updatedAt'],
      relations: ['organization'],
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return user;
  }

  async findById(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: id },
      select: ['id', 'username','password', 'email', 'role', 'orgId', 'createdAt', 'updatedAt'],
      relations: ['organization'],
    });
    
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    
    return user;
  }

  async findByUsername(username: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { username },
    });
    
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }
    
    return user;
  }

  async update(id: number, User: Partial<User>): Promise<User> {
    const user = await this.findOne(id); // Check if exists

    // Hash password if provided
    if (User.password) {
        User.password = await bcrypt.hash(User.password, 10);
    }

    

    await this.usersRepository.update(id, User);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }
  async updatePassword(id: number, oldPassword: string, newPassword: string): Promise<User> {
    try {
        const user = await this.findById(id); // Check if exists
        
        if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        
        // Check if user has a password (important for users created through OAuth or other methods)
        if (!user.password) {
            throw new BadRequestException('Cannot update password. User account does not have a password set.');
        }
        
        // If updating password, validate old password and check new password is different
        if (newPassword) {
            // If no oldPassword provided, throw error
            if (!oldPassword) {
                throw new UnauthorizedException('Old password is required to update password');
            }
            
            try {
                // Verify old password matches - ensure both arguments are strings
                if (typeof oldPassword !== 'string' || typeof user.password !== 'string') {
                    throw new BadRequestException('Invalid password format');
                }
                
                const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
                if (!isOldPasswordValid) {
                    throw new UnauthorizedException('Old password is incorrect');
                }
                
                // Check new password is different from old password
                const isNewPasswordSameAsOld = await bcrypt.compare(newPassword, user.password);
                if (isNewPasswordSameAsOld) {
                    throw new BadRequestException('New password must be different from old password');
                }
                
                // Hash new password
                user.password = await bcrypt.hash(newPassword, 10);
            } catch (error) {
                console.error('Password processing error:', error);
                if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                    throw error;
                }
                throw new InternalServerErrorException(`Error processing password: ${error.message}`);
            }
        }
        
        try {
            await this.usersRepository.update(id, { password: user.password });
            return this.findOne(id);
        } catch (error) {
            console.error('Database update error:', error);
            throw new InternalServerErrorException('Failed to update user: ' + error.message);
        }
    } catch (error) {
        console.error('Password update error:', error);
        // Re-throw NestJS exceptions as-is
        if (error instanceof UnauthorizedException || 
            error instanceof BadRequestException || 
            error instanceof NotFoundException ||
            error instanceof InternalServerErrorException) {
            throw error;
        }
        // Wrap other exceptions
        throw new InternalServerErrorException('Password update failed: ' + error.message);
    }
}

 
}

