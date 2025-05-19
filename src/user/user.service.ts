import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcrypt';
import { User } from '../entities/users.entity';
import { CreateUserDto } from './dto/user.dto';

import { OrganizationService } from '../organisation/organization.service';

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
    const hashedPassword = await hash(User.password, 10);
    
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
        User.password = await hash(User.password, 10);
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
}