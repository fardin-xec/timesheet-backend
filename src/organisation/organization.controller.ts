import { Controller, Get, Param, Post, Body, Put, Delete, UseGuards, HttpStatus } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Organization } from '../entities/organizations.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from '../dto/response.dto';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(): Promise<ResponseDto<Organization[]>> {
    const data = await this.organizationService.findAll();
    return new ResponseDto(HttpStatus.OK, 'Organizations retrieved successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ResponseDto<Organization>> {
    const data = await this.organizationService.findOne(+id);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Organization not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Organization retrieved successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() organizationData: Partial<Organization>): Promise<ResponseDto<Organization>> {
    const data = await this.organizationService.create(organizationData);
    return new ResponseDto(HttpStatus.CREATED, 'Organization created successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(@Param('id') id: string, @Body() organizationData: Partial<Organization>): Promise<ResponseDto<Organization>> {
    const data = await this.organizationService.update(+id, organizationData);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Organization not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Organization updated successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ResponseDto<void>> {
    await this.organizationService.remove(+id);
    return new ResponseDto(HttpStatus.OK, 'Organization deleted successfully');
  }
}
