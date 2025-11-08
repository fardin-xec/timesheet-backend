// src/controllers/leave.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveRuleService } from './leave-rule.service';
import {
  ApplyLeaveDto,
  UpdateLeaveDto,
  ApproveRejectLeaveDto,
  LeaveFilterDto,
} from './dto/create-leave.dto';
import {
  CreateLeaveRuleDto,
  UpdateLeaveRuleDto,
} from './dto/leave-rule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../entities/users.entity';
import { ResponseDto } from '../dto/response.dto';

@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly leaveRuleService: LeaveRuleService,
  ) {}

  // ==================== LEAVE RULES ====================

  @Post('rules')
  @Roles(UserRole.ADMIN)
  async createLeaveRule(@Request() req, @Body() dto: CreateLeaveRuleDto) {
    try {
      const data = await this.leaveRuleService.createLeaveRule(req.user.orgId, dto);
      return new ResponseDto(HttpStatus.CREATED, 'Leave rule created successfully', data);
    } catch (error) {
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to create leave rule', error.message);
    }
  }

  @Put('rules/:id')
  @Roles(UserRole.ADMIN)
  async updateLeaveRule(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeaveRuleDto,
  ) {
    try {
      const data = await this.leaveRuleService.updateLeaveRule(id, req.user.orgId, dto);
      return new ResponseDto(HttpStatus.OK, 'Leave rule updated successfully', data);
    } catch (error) {
      return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to update leave rule', error.message);
    }
  }

  @Get('rules')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getLeaveRules(@Request() req) {
    const data = await this.leaveRuleService.getLeaveRules(req.user.orgId);
    return new ResponseDto(HttpStatus.OK, 'Leave rules retrieved successfully', data);
  }

  @Get('rules/:leaveType')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getLeaveRuleByType(@Request() req, @Param('leaveType') leaveType: string) {
    const data = await this.leaveRuleService.getLeaveRuleByType(req.user.orgId, leaveType as any);
    return new ResponseDto(HttpStatus.OK, 'Leave rule retrieved successfully', data);
  }

  @Delete('rules/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLeaveRule(@Request() req, @Param('id', ParseIntPipe) id: number) {
    await this.leaveRuleService.deleteLeaveRule(id, req.user.orgId);
    return new ResponseDto(HttpStatus.NO_CONTENT, 'Leave rule deleted successfully', null);
  }

  @Post('rules/initialize')
  @Roles(UserRole.ADMIN)
  async initializeDefaultRules(@Request() req, @Body('location') location: 'India' | 'Qatar') {
    const data = await this.leaveRuleService.initializeDefaultRules(req.user.orgId, location);
    return new ResponseDto(HttpStatus.CREATED, 'Default leave rules initialized', data);
  }

  // ==================== LEAVE APPLICATIONS ====================

  @Post('apply')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async applyLeave(@Request() req, @Body() dto: ApplyLeaveDto) {
    const data = await this.leaveService.applyLeave(req.user.employeeId, dto);
    return new ResponseDto(HttpStatus.CREATED, 'Leave applied successfully', data);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async updateLeave(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeaveDto) {
    const data = await this.leaveService.updateLeave(id, req.user.employeeId, dto);
    return new ResponseDto(HttpStatus.OK, 'Leave updated successfully', data);
  }



  @Put(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async approveRejectLeave(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveRejectLeaveDto,
  ) {
    console.log(id);
    
    const data = await this.leaveService.approveRejectLeave(id, req.user.employeeId, dto);
    return new ResponseDto(HttpStatus.OK, 'Leave status updated successfully', data);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLeave(@Request() req, @Param('id', ParseIntPipe) id: number) {
    await this.leaveService.deleteLeave(id, req.user.employeeId);
    return new ResponseDto(HttpStatus.NO_CONTENT, 'Leave deleted successfully', null);
  }

  @Get('my-leaves')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async getMyLeaves(@Request() req, @Query() filter: LeaveFilterDto) {
    const data = await this.leaveService.getEmployeeLeaves(req.user.employeeId, filter);
    return new ResponseDto(HttpStatus.OK, 'Your leaves retrieved successfully', data);
  }

  @Get('employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getEmployeeLeaves(@Param('employeeId', ParseIntPipe) employeeId: number, @Query() filter: LeaveFilterDto) {
    const data = await this.leaveService.getEmployeeLeaves(employeeId, filter);
    return new ResponseDto(HttpStatus.OK, 'Employee leaves retrieved successfully', data);
  }
  @Get('rules/employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getEmployeeLeavesRules(@Param('employeeId', ParseIntPipe) employeeId: number) {
    const data = await this.leaveService.getEmployeeLeavesRules(employeeId);
    return new ResponseDto(HttpStatus.OK, 'Employee leaves rules retrieved successfully', data);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getAllLeaves(@Query() filter: LeaveFilterDto) {
    const data = await this.leaveService.getAllLeaves(filter);
    return new ResponseDto(HttpStatus.OK, 'All leaves retrieved successfully', data);
  }
@Get('subordinates')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
async getSubordinateLeaves(@Request() req, @Query() filter: LeaveFilterDto) {
  try {
    const data = await this.leaveService.getSubordinateLeaves(req.user.employeeId, filter);
    return new ResponseDto(HttpStatus.OK, 'Subordinate leaves retrieved successfully', data);
  } catch (error) {
    return new ResponseDto(
      HttpStatus.INTERNAL_SERVER_ERROR, 
      'Failed to retrieve subordinate leaves', 
      error.message
    );
  }
}
@Get('my-leave-types/balances')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
async getMyLeaveTypesWithBalances(@Request() req) {
  try {
    const data = await this.leaveService.getLeaveTypesWithBalances(req.user.employeeId);
    return new ResponseDto(HttpStatus.OK, 'Leave types with balances retrieved successfully', data);
  } catch (error) {
    return new ResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, 'Failed to retrieve leave types with balances', error.message);
  }
}
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async getLeaveById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.leaveService.getLeaveById(id);
    return new ResponseDto(HttpStatus.OK, 'Leave details retrieved successfully', data);
  }



// Optional: With pagination
@Get('subordinates/leaves/paginated')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
async getSubordinateLeavesWithPagination(
  @Request() req, 
  @Query() filter: LeaveFilterDto,
  @Query('page', ParseIntPipe) page: number = 1,
  @Query('limit', ParseIntPipe) limit: number = 10,
) {
  try {
    const data = await this.leaveService.getSubordinateLeavesWithDetails(
      req.user.employeeId, 
      filter,
      page,
      limit
    );
    return new ResponseDto(HttpStatus.OK, 'Subordinate leaves retrieved successfully', data);
  } catch (error) {
    return new ResponseDto(
      HttpStatus.INTERNAL_SERVER_ERROR, 
      'Failed to retrieve subordinate leaves', 
      error.message
    );
  }
}

  // ==================== REPORTS ====================

  @Get('/balance/employee/:employeeId')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async getLeaveBalanceEmployee( @Param('employeeId', ParseIntPipe) employeeId: number,
) {
    const data = await this.leaveService.getLeaveBalancesByEmployeeId(employeeId);
    return new ResponseDto(HttpStatus.OK, 'Leave details retrieved successfully', data);
  }

  @Get('reports/compliance')
  @Roles(UserRole.ADMIN)
  async getComplianceReport(@Request() req, @Query() filter: LeaveFilterDto) {
    return new ResponseDto(HttpStatus.OK, 'Compliance report fetched successfully', {
      message: 'Compliance report endpoint (to be implemented)',
      filter,
    });
  }

  @Get('reports/audit')
  @Roles(UserRole.ADMIN)
  async getAuditReport(@Request() req, @Query() filter: LeaveFilterDto) {
    return new ResponseDto(HttpStatus.OK, 'Audit report fetched successfully', {
      message: 'Audit report endpoint (to be implemented)',
      filter,
    });
  }

  
// ==================== ASSIGN/UNASSIGN LEAVE RULES ====================

@Post('assign-rule/:employeeId/:ruleId')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
async assignLeaveRule(
  @Request() req,
  @Param('employeeId', ParseIntPipe) employeeId: number,
  @Param('ruleId', ParseIntPipe) ruleId: number,
) {
  try {
    const data = await this.leaveService.assignLeaveRuleToEmployee(
      employeeId,
      ruleId,
      req.user.orgId
    );
    return new ResponseDto(
      HttpStatus.OK,
      'Leave rule assigned successfully',
      data
    );
  } catch (error) {
    return new ResponseDto(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to assign leave rule',
      error.message
    );
  }
}

@Delete('unassign-rule/:employeeId/:ruleId')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@HttpCode(HttpStatus.OK)
async unassignLeaveRule(
  @Request() req,
  @Param('employeeId', ParseIntPipe) employeeId: number,
  @Param('ruleId', ParseIntPipe) ruleId: number,
) {
  try {
    await this.leaveService.unassignLeaveRuleFromEmployee(
      employeeId,
      ruleId,
      req.user.orgId
    );
    return new ResponseDto(
      HttpStatus.OK,
      'Leave rule unassigned successfully',
      null
    );
  } catch (error) {
    return new ResponseDto(
      HttpStatus.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
}
}
