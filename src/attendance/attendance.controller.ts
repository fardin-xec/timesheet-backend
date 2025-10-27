import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  HttpStatus,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from '../dto/response.dto';

@Controller('attendances')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ------------ GET Endpoints ------------

  /**
   * GET /attendances/dashboard
   * Get attendance analytics/dashboard for a specific date
   * Query params: date (optional, defaults to today)
   * Returns: present, absent, on leave, half day counts
   */
  @Get('dashboard')
  async getDashboard(
    @Req() req: any,
    @Query('date') date?: string,
  ): Promise<ResponseDto<any>> {
    const orgId  = 1;
    
    if (!orgId) {
      throw new BadRequestException('Organization ID not found in user token');
    }

    const targetDate = date ? new Date(date) : new Date();
    const data = await this.attendanceService.getAttendanceDashboard(orgId, targetDate);
    
    return new ResponseDto(
      HttpStatus.OK,
      'Attendance dashboard fetched successfully',
      data
    );
  }

  /**
   * GET /attendances/export
   * Get attendance data for export (Excel/CSV)
   * Query params: start (required), end (required)
   * Returns: Array of attendance records with employee details
   */
  @Get('export')
  async getExportData(
    @Req() req: any,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ): Promise<ResponseDto<any>> {
    const { orgId } = req.user;

    if (!orgId) {
      throw new BadRequestException('Organization ID not found in user token');
    }

    if (!start || !end) {
      throw new BadRequestException('Both "start" and "end" date parameters are required');
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before or equal to end date');
    }

    const data = await this.attendanceService.getAttendanceForExport(
      orgId,
      startDate,
      endDate
    );

    return new ResponseDto(
      HttpStatus.OK,
      'Attendance data for export fetched successfully',
      data
    );
  }

  @Get('employees')
  async getAllEmployeesAttendance(
    @Req() req: any,
    @Query('date') date?: string,
  ): Promise<ResponseDto<any>> {
    const orgId  = 1;
    
    if (!orgId) {
      throw new BadRequestException('Organization ID not found in user token');
    }

    const targetDate = date ? new Date(date) : new Date();
    const data = await this.attendanceService.getAllEmployeesAttendance(orgId, targetDate);
    
    return new ResponseDto(
      HttpStatus.OK,
      'Attendance dashboard fetched successfully',
      data
    );
  }



  @UseGuards(JwtAuthGuard)
  @Get('tasks')
  async getTasksByDateRange(
    @Req() req: any,
    @Query('date') date?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('employeeId') employeeId?: number,
  ): Promise<ResponseDto<any>> {

    if (date) {
      const data = await this.attendanceService.getEntriesByDateRange(employeeId, new Date(date));
      return new ResponseDto(HttpStatus.OK, 'Entries fetched successfully', data);
    }

    if (start && end) {
      const data = await this.attendanceService.getEntriesByDateRange(
        employeeId,
        new Date(start),
        new Date(end),
      );
      return new ResponseDto(HttpStatus.OK, 'Entries fetched successfully', data);
    }

    throw new BadRequestException('Provide either "date" or both "start" and "end" query parameters.');
  }

  @UseGuards(JwtAuthGuard)
  @Get('today')
  async getToday(@Req() req: any): Promise<ResponseDto<any>> {
    const { userId } = req.user;
    const data = await this.attendanceService.getTodayEntries(userId);
    return new ResponseDto(HttpStatus.OK, "Today's entries fetched successfully", data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('monthly-logs')
  async getMonthlyLogs(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
        console.log(req)

     const { userId } = req.user || {};
    if (!userId) {
      throw new BadRequestException('Missing userId or orgId in JWT payload');
    }
    return this.attendanceService.getMonthlyLogs(
      userId,
      startDate,
      endDate,
    );
  }

  // ------------ POST Endpoints ------------

  @UseGuards(JwtAuthGuard)
  @Post('start')
  async start(@Req() req: any): Promise<ResponseDto<any>> {
    const { userId } = req.user || {};
    if (!userId) {
      throw new BadRequestException('Missing userId or orgId in JWT payload');
    }
    const data = await this.attendanceService.startTimer(userId);
    return new ResponseDto(HttpStatus.OK, 'Timer started successfully', data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stop')
  async stop(@Req() req: any, @Body() taskData: any): Promise<ResponseDto<any>> {
    const { employeeId } = req.user;
    const data = await this.attendanceService.stopTimer(employeeId, taskData);
    return new ResponseDto(HttpStatus.OK, 'Timer stopped successfully', data);
  }

  // ------------ PUT Endpoints ------------

  @UseGuards(JwtAuthGuard)
  @Put(':id/tasks')
  async updateTask(
    @Req() req: any,
    @Param('id') id: number,
    @Body() updates: any,
  ): Promise<ResponseDto<any>> {
    const { employeeId } = req.user;
    const data = await this.attendanceService.updateTaskDetails(id, employeeId, updates);
    return new ResponseDto(HttpStatus.OK, 'Task updated successfully', data);
  }
}
