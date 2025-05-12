import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, HttpStatus } from '@nestjs/common';
import { PersonalService } from './personal.service';
import { CreatePersonalDto } from './dto/personal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from '../dto/response.dto';
import { Personal } from '../entities/personal.entity';

@Controller('personal')
export class PersonalController {
  constructor(private readonly personalService: PersonalService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(): Promise<ResponseDto<Personal[]>> {
    try {
      const data = await this.personalService.findAll();
      return new ResponseDto(HttpStatus.OK, 'Personal information retrieved successfully', data);
    } catch (error) {
      console.error('Controller error:', error);
      return new ResponseDto(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to retrieve personal information',
        null
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseDto<Personal>> {
    try {
      const data = await this.personalService.findOne(+id);
      return new ResponseDto(HttpStatus.OK, 'Personal information retrieved successfully', data);
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Personal information not found');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/employee/:employeeId')
  async findByEmployeeId(@Param('employeeId') employeeId: string): Promise<ResponseDto<Personal>> {
    try {
      const data = await this.personalService.findByEmployeeId(+employeeId);
      return new ResponseDto(HttpStatus.OK, 'Personal information retrieved successfully', data);
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Personal information not found');
    }
  }

 

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() updatePersonalDto: CreatePersonalDto): Promise<ResponseDto<Personal>> {
    try {
      const data = await this.personalService.update(+id, updatePersonalDto);
      return new ResponseDto(HttpStatus.OK, 'Personal information updated successfully', data);
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Personal information not found');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseDto<void>> {
    try {
      await this.personalService.remove(+id);
      return new ResponseDto(HttpStatus.OK, 'Personal information deleted successfully');
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Failed to delete personal information');
    }
  }
}