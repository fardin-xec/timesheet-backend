import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpException, HttpStatus, Query, DefaultValuePipe } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Attendance } from '../entities/attendances.entity';
import { ResponseDto } from '../dto/response.dto'; // Adjust path to match your project structure
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Adjust path to match your project structure
import { UseGuards } from '@nestjs/common';

@Controller('attendances')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createAttendanceDto: CreateAttendanceDto): Promise<ResponseDto<Attendance>> {
    try {
      const data = await this.attendanceService.create(createAttendanceDto);
      return new ResponseDto(HttpStatus.CREATED, 'Attendance created successfully', data);
    } catch (error) {
      console.error('Controller error creating attendance:', error);
      throw new HttpException(error.message || 'Failed to create attendance', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('bulk')
  async createBulk(@Body() createAttendanceDtos: CreateAttendanceDto[]): Promise<ResponseDto<Attendance[]>> {
    try {
      const data = await this.attendanceService.createBulk(createAttendanceDtos);
      return new ResponseDto(HttpStatus.CREATED, 'Attendances created successfully', data);
    } catch (error) {
      console.error('Controller error creating bulk attendance:', error);
      throw new HttpException(error.message || 'Failed to create bulk attendance', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('employeeId', ParseIntPipe) employeeId?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ResponseDto<{ data: Attendance[]; total: number }>> {
    try {
      const data = await this.attendanceService.findAllWithFilters({ page, limit, employeeId, startDate, endDate });
      if (!data.data || data.data.length === 0) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'No attendance records found', data);
      }
      return new ResponseDto(HttpStatus.OK, 'Attendances retrieved successfully', data);
    } catch (error) {
      console.error('Controller error finding all attendances:', error);
      throw new HttpException('Failed to retrieve attendances', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ResponseDto<Attendance>> {
    try {
      const data = await this.attendanceService.findOne(id);
      if (!data) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Attendance record not found', null);
      }
      return new ResponseDto(HttpStatus.OK, 'Attendance retrieved successfully', data);
    } catch (error) {
      console.error('Controller error finding attendance:', error);
      throw new HttpException('Failed to retrieve attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put('/employees/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ): Promise<ResponseDto<Attendance>> {
    try {
      const data = await this.attendanceService.update(id, updateAttendanceDto);
      if (!data) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Attendance record not found', null);
      }
      return new ResponseDto(HttpStatus.OK, 'Attendance updated successfully', data);
    } catch (error) {
      console.error('Controller error updating attendance:', error);
      if(error.message==="Reset Check in button"){
        return new ResponseDto(HttpStatus.OK,error,null);
      }else{
      throw new HttpException(error.message || 'Failed to update attendance', HttpStatus.BAD_REQUEST);
      }
    }
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
  ): Promise<ResponseDto<Attendance>> {
    try {
      const data = await this.attendanceService.updateAttendance(id, updateAttendanceDto);
      if (!data) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Attendance record not found', null);
      }
      return new ResponseDto(HttpStatus.OK, 'Attendance updated successfully', data);
    } catch (error) {
      console.error('Controller error updating attendance:', error);
      throw new HttpException(error.message || 'Failed to update attendance', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<ResponseDto<void>> {
    try {
      const result = await this.attendanceService.remove(id);
      if (!result) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Attendance record not found', null);
      }
      return new ResponseDto(HttpStatus.OK, 'Attendance deleted successfully', null);
    } catch (error) {
      console.error('Controller error removing attendance:', error);
      throw new HttpException('Failed to remove attendance', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }



 

 

 
}