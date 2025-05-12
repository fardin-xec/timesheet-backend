import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
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
  create(@Body() createLeaveDto: CreateLeaveDto): Promise<ResponseDto<Leave>>  {
    return this.leaveService.createLeave(createLeaveDto);
  }

  @Get()
  findAll(): Promise<ResponseDto<Leave[]>> {
    return this.leaveService.findAllLeaves();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ResponseDto<Leave>> {
    return this.leaveService.findLeaveById(id);
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
  findLeaveRules( @Param('orgId', ParseIntPipe) orgId: number,): Promise<ResponseDto<LeaveRule[]>> {
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
  ): Promise<ResponseDto<LeaveBalances[]>>  {
    return this.leaveService.findLeaveBalanceByEmp(employeeId);
  }

  @Put(':id/updateStatus')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,@Body() updateLeaveDto: UpdateLeaveDto
  ): Promise<ResponseDto<Leave>>  {
    return this.leaveService.updateStatusLeave(id,updateLeaveDto);
  }
}