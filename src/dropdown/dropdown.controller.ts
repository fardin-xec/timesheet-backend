import { Controller, Get, Param, Post, Body, Put, Delete, UseGuards, HttpStatus } from '@nestjs/common';
import { DropdownService } from './dropdown.service';
import { DropdownType } from '../entities/dropdown-types.entity';
import { DropdownValue } from '../entities/dropdown-values.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from '../dto/response.dto';

@Controller('dropdowns')
export class DropdownController {
  constructor(private readonly dropdownService: DropdownService) {}

  @UseGuards(JwtAuthGuard)
  @Get('types')
  async findAllTypes(): Promise<ResponseDto<DropdownType[]>> {
    const data = await this.dropdownService.findAllTypes();
    return new ResponseDto(HttpStatus.OK, 'Dropdown types retrieved successfully', data);
  }

 

  @UseGuards(JwtAuthGuard)
  @Post('types')
  async createType(@Body() typeData: Partial<DropdownType>): Promise<ResponseDto<DropdownType>> {
    const data = await this.dropdownService.createType(typeData);
    return new ResponseDto(HttpStatus.CREATED, 'Dropdown type created successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Put('types/:id')
  async updateType(@Param('id') id: string, @Body() typeData: Partial<DropdownType>): Promise<ResponseDto<DropdownType>> {
    const data = await this.dropdownService.updateType(+id, typeData);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Dropdown type not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Dropdown type updated successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('types/:id')
  async removeType(@Param('id') id: string): Promise<ResponseDto<void>> {
    await this.dropdownService.removeType(+id);
    return new ResponseDto(HttpStatus.OK, 'Dropdown type deleted successfully');
  }

  @UseGuards(JwtAuthGuard)
  @Get('values')
  async findAllValues(): Promise<ResponseDto<DropdownValue[]>> {
    const data = await this.dropdownService.findAllValues();
    return new ResponseDto(HttpStatus.OK, 'Dropdown values retrieved successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('types/:id')
  async findOneValue(@Param('id') id: string): Promise<ResponseDto<DropdownValue[]>> {
    const data = await this.dropdownService.findByType(+id);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Dropdown type not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Dropdown type retrieved successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('values')
  async createValue(@Body() valueData: Partial<DropdownValue>): Promise<ResponseDto<DropdownValue>> {
    const data = await this.dropdownService.createValue(valueData);
    return new ResponseDto(HttpStatus.CREATED, 'Dropdown value created successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Put('values/:id')
  async updateValue(@Param('id') id: string, @Body() valueData: Partial<DropdownValue>): Promise<ResponseDto<DropdownValue>> {
    const data = await this.dropdownService.updateValue(+id, valueData);
    if (!data) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Dropdown value not found');
    }
    return new ResponseDto(HttpStatus.OK, 'Dropdown value updated successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('values/:id')
  async removeValue(@Param('id') id: string): Promise<ResponseDto<void>> {
    await this.dropdownService.removeValue(+id);
    return new ResponseDto(HttpStatus.OK, 'Dropdown value deleted successfully');
  }
}
