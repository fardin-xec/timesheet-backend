import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Personal } from '../entities/personal.entity';
import { CreatePersonalDto } from './dto/personal.dto';
import { EmployeeService } from '../employee/employee.service';

@Injectable()
export class PersonalService {
  constructor(
    @InjectRepository(Personal)
    private personalRepository: Repository<Personal>,
  ) {}

 

  async findAll(): Promise<Personal[]> {
    return this.personalRepository.find({
      relations: ['employee'],
    });
  }

  async findByEmployeeId(employeeId: number): Promise<Personal> {
    const personal = await this.personalRepository.findOne({
      where: { employeeId },
    });
    
    if (!personal) {
      throw new NotFoundException(`Personal info for employee ID ${employeeId} not found`);
    }
    
    return personal;
  }

  async findOne(id: number): Promise<Personal> {
    const personal = await this.personalRepository.findOne({
      where: { id },
      relations: ['employee'],
    });
    
    if (!personal) {
      throw new NotFoundException(`Personal info with ID ${id} not found`);
    }
    
    return personal;
  }

  async findEmployeeOne(employeeId: number): Promise<Personal> {
    const personal = await this.personalRepository.findOne({
      where: { employeeId },
      relations: ['employee'],
    });
    
    return personal;
  }

  async update(employeeId: number, updatePersonalDto: CreatePersonalDto): Promise<Personal> {
    try {
      // Get existing record
      const personal = await this.personalRepository.findOne({
        where: { employeeId },
      });
  
      if (personal) {
        // Update existing record
        await this.personalRepository.update(personal.id, updatePersonalDto);
        return this.findOne(personal.id);
      } else {
        // Create new record
        const newPersonal = this.personalRepository.create({
          ...updatePersonalDto,
          employeeId,
        });
        return this.personalRepository.save(newPersonal);
      }
    } catch (error) {
      throw new Error(`Failed to update personal data: ${error.message}`);
    }
  }

  async remove(id: number): Promise<void> {
    const result = await this.personalRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Personal info with ID ${id} not found`);
    }
  }
}