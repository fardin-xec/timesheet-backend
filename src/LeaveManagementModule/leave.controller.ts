import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { Leave } from '../entities/leave.entity';
import { ResponseDto } from '../dto/response.dto';
import { LeaveRule } from 'src/entities/leave-rule.entity';
import { EmployeeLeaveRule } from 'src/entities/employee-leave-rule.entity';
import { LeaveBalances } from 'src/entities/leave-balance.entity';

@Controller('leaves')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  create(@Body() createLeaveDto: CreateLeaveDto): Promise<ResponseDto<Leave>> {
    return this.leaveService.createLeave(createLeaveDto);
  }

  @Post('upload-attachment')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, JPG, and PNG files are allowed');
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new BadRequestException('File size cannot exceed 5MB');
    }

    // Here you would implement your file upload logic to S3/storage
    // For now, returning a mock URL
    const uploadedUrl = await this.leaveService.uploadFile(file);
    
    return new ResponseDto(200, 'File uploaded successfully', { url: uploadedUrl });
  }

  @Get()
  findAll(): Promise<ResponseDto<Leave[]>> {
    return this.leaveService.findAllLeaves();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ResponseDto<Leave>> {
    return this.leaveService.findLeaveById(id);
  }

  @Post('/employees/pending-leaves')
  findPendingLeavesByEmployees(
    @Body() body: { employeeIds: number[] },
  ): Promise<ResponseDto<Leave[]>> {
    return this.leaveService.findPendingLeavesByEmployees(body.employeeIds);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeaveDto: UpdateLeaveDto,
  ): Promise<ResponseDto<Leave>> {
    return this.leaveService.updateLeave(id, updateLeaveDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<ResponseDto<void>> {
    return this.leaveService.deleteLeave(id);
  }

  @Get('/employees/:employeeId')
  findEmployeeLeaves(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ): Promise<ResponseDto<Leave[]>> {
    return this.leaveService.findLeaveByEmployee(employeeId);
  }

  @Get('/rules/:orgId')
  findLeaveRules(@Param('orgId', ParseIntPipe) orgId: number): Promise<ResponseDto<LeaveRule[]>> {
    return this.leaveService.findAllRules(orgId);
  }

  @Get('/rules/employees/:employeeId')
  findEmployeeLeavesRules(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ): Promise<ResponseDto<EmployeeLeaveRule[]>> {
    return this.leaveService.findLeaveRulesByEmployee(employeeId);
  }

  @Post('assign-rule/:employeeId/:ruleId')
  assignRule(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<any> {
    return this.leaveService.assignLeaveRule(employeeId, ruleId);
  }

  @Delete('unassign-rule/:employeeId/:ruleId')
  unassignRule(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ): Promise<any> {
    return this.leaveService.unassignLeaveRule(employeeId, ruleId);
  }

  @Get('balance/employees/:employeeId')
  findLeaveBalanceByEmp(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ): Promise<ResponseDto<LeaveBalances[]>> {
    return this.leaveService.findLeaveBalanceByEmp(employeeId);
  }

  @Put(':id/updateStatus')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeaveDto: UpdateLeaveDto,
  ): Promise<ResponseDto<Leave>> {
    return this.leaveService.updateStatusLeave(id, updateLeaveDto);
  }

  // @Get('/validate-leave-cycle/:employeeId')
  // validateLeaveCycle(
  //   @Param('employeeId', ParseIntPipe) employeeId: number,
  //   @Body() body: { leaveType: string; startDate: string; endDate: string },
  // ): Promise<ResponseDto<{ isValid: boolean; message?: string }>> {
  //   return this.leaveService.validateLeaveCycleForEmployee(employeeId, body.leaveType, body.startDate, body.endDate);
  // }
}