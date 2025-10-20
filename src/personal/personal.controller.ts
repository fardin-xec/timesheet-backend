import { Controller, Get, Post, Body, Put, Param, Delete, UseGuards, HttpStatus, HttpCode, ParseIntPipe, ParseUUIDPipe, UploadedFile, UseInterceptors, Request, Query } from '@nestjs/common';
import { PersonalService } from './personal.service';
import { CreatePersonalDto, UploadDocumentDto } from './dto/personal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from '../dto/response.dto';
import { Personal } from '../entities/personal.entity';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateBankAccountDto } from 'src/bank-info/dto/update-bank-account.dto';

@Controller('personal')
export class PersonalController {
  constructor(private readonly personalService: PersonalService) {}

  // ========== PERSONAL INFO ==========

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
  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get personal information by employee ID' })
  @ApiParam({ name: 'employeeId', type: 'string' })
  async findByEmployeeId(@Param('employeeId') employeeId: string): Promise<ResponseDto<Personal>> {
    try {
      const data = await this.personalService.findByEmployeeId(+employeeId);
      return new ResponseDto(HttpStatus.OK, 'Personal information retrieved successfully', data);
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Personal information not found');
    }
  }

  // ========== BANK ACCOUNT ==========

  @Get('bank-account')
  @ApiOperation({ summary: 'Get bank account information' })
  @ApiQuery({ name: 'employeeId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Bank account retrieved' })
  async getBankAccount(@Query('employeeId', ParseIntPipe) employeeId: number) {
    const data = await this.personalService.getBankInfo(employeeId);
    return new ResponseDto(HttpStatus.OK, 'Bank information retrieved successfully', data);
  }

  @Put('bank-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update bank account information' })
  @ApiQuery({ name: 'employeeId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Bank account updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async updateBankAccount(
    @Query('employeeId', ParseIntPipe) employeeId: number,
    @Body() dto: UpdateBankAccountDto,
    @Request() req
  ) {
    const modifiedBy = req.user || req.headers['x-user-id'];
    console.log(dto);
    return this.personalService.updateBankInfo(employeeId, dto, modifiedBy);
  }

  // ========== DOCUMENTS ==========

  @Get('documents')
  @ApiOperation({ summary: 'Get all documents for employee' })
  @ApiQuery({ name: 'employeeId', type: 'number' })
  @ApiResponse({ status: 200, description: 'Documents retrieved' })
  async getDocuments(@Query('employeeId', ParseIntPipe) employeeId: number) {
    const data = await this.personalService.getDocuments(employeeId);
    return new ResponseDto(HttpStatus.OK, 'Documents retrieved successfully', data);
  }

  @Get('documents/:documentId')
  @ApiOperation({ summary: 'Get specific document' })
  @ApiQuery({ name: 'employeeId', type: 'number' })
  @ApiParam({ name: 'documentId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Document retrieved' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(
    @Query('employeeId', ParseIntPipe) employeeId: number,
    @Param('documentId', ParseUUIDPipe) documentId: string
  ) {
    const data = await this.personalService.getDocumentById(documentId, employeeId);
    return new ResponseDto(HttpStatus.OK, 'Document retrieved successfully', data);
  }

   @UseGuards(JwtAuthGuard)
  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a document' })
  @ApiQuery({ name: 'employeeId', type: 'number', description: 'Employee ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentType'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF, JPG, PNG, DOCX)'
        },
        documentType: {
          type: 'string',
          enum: ['AADHAR_CARD', 'PAN_CARD', 'PASSPORT', 'CERTIFICATE', 'OTHER']
        }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }
  }))
  async uploadDocument(
    @Query('employeeId', ParseIntPipe) employeeId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Request() req: any
  ) {

    const uploadedBy = req.user.userId;
    console.log(uploadedBy);
    console.log(employeeId);

    return this.personalService.uploadDocument(
      employeeId,
      file,
      dto.documentType,
      uploadedBy
    );
  }

  @Put('documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace a document' })
  @ApiQuery({ name: 'employeeId', type: 'number' })
  @ApiParam({ name: 'documentId', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Document replaced' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }
  }))
  async replaceDocument(
    @Query('employeeId', ParseIntPipe) employeeId: number,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    const uploadedBy = req.user?.id || req.headers['x-user-id'];
    return this.personalService.replaceDocument(
      documentId,
      employeeId,
      file,
      uploadedBy
    );
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiQuery({ name: 'employeeId', type: 'number' })
  @ApiParam({ name: 'documentId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteDocument(
    @Query('employeeId', ParseIntPipe) employeeId: number,
    @Param('documentId', ParseUUIDPipe) documentId: string
  ) {
    return this.personalService.deleteDocument(documentId, employeeId);
  }

  // ========== GENERIC PERSONAL INFO CRUD (Keep at the end) ==========

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get personal information by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  async findOne(@Param('id') id: string): Promise<ResponseDto<Personal>> {
    try {
      const data = await this.personalService.findOne(+id);
      return new ResponseDto(HttpStatus.OK, 'Personal information retrieved successfully', data);
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Personal information not found');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update personal information' })
  @ApiParam({ name: 'id', type: 'string' })
  async update(@Param('id') id: string, @Body() updatePersonalDto: CreatePersonalDto): Promise<ResponseDto<Personal>> {
    try {
      const data = await this.personalService.update(+id, updatePersonalDto);
      return new ResponseDto(HttpStatus.OK, 'Personal information updated successfully', data.data);
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Personal information not found');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete personal information' })
  @ApiParam({ name: 'id', type: 'string' })
  async remove(@Param('id') id: string): Promise<ResponseDto<void>> {
    try {
      await this.personalService.remove(+id);
      return new ResponseDto(HttpStatus.OK, 'Personal information deleted successfully');
    } catch (error) {
      return new ResponseDto(HttpStatus.NOT_FOUND, 'Failed to delete personal information');
    }
  }
}