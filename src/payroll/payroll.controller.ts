import { Controller, Post, Param, Patch, Body, Get,Delete, Res, Query, ParseIntPipe, HttpException, HttpStatus, UseGuards, DefaultValuePipe, StreamableFile } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { Response } from 'express';
import { ResponseDto } from '../dto/response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate/:orgId/:year/:month')
  async generateMonthlyPayroll(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ): Promise<ResponseDto<void>> {
    try {
      const payrollMonth = new Date(year, month - 1, 1);
      await this.payrollService.generateMonthlyPayroll(orgId, payrollMonth);
      return new ResponseDto(HttpStatus.OK, 'Payroll generation initiated', null);
    } catch (error) {
      console.error('Controller error generating payroll:', error);
      throw new HttpException(error.message || 'Failed to generate payroll', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orgId')
  async getPayroll(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('employeeId') employeeId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number = 100,
  ): Promise<ResponseDto<{ data: any[]; total: number }>> {
    try {
      const data = await this.payrollService.getPayroll({
        orgId,
        month,
        year,
        employeeId,
        page,
        limit,
      });
      if (!data.data || data.data.length === 0) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'No payroll records found', data);
      }
      return new ResponseDto(HttpStatus.OK, 'Payroll records retrieved successfully', data);
    } catch (error) {
      console.error('Controller error retrieving payroll:', error);
      throw new HttpException('Failed to retrieve payroll records', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updatePayroll(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePayrollDto: UpdatePayrollDto,
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.payrollService.updatePayroll(id, updatePayrollDto);
      if (!data) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Payroll record not found', null);
      }
      return new ResponseDto(HttpStatus.OK, 'Payroll updated successfully', data);
    } catch (error) {
      console.error('Controller error updating payroll:', error);
      throw new HttpException(error.message || 'Failed to update payroll', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('approve/:id')
  async approvePayroll(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.payrollService.approvePayroll(id);
      if (!data) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Payroll record not found', null);
      }
      return new ResponseDto(HttpStatus.OK, 'Payroll approved successfully', data);
    } catch (error) {
      console.error('Controller error approving payroll:', error);
      throw new HttpException(error.message || 'Failed to approve payroll', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('reject/:id')
  async rejectPayroll(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ResponseDto<any>> {
    try {
      const data = await this.payrollService.rejectPayroll(id);
      if (!data) {
        return new ResponseDto(HttpStatus.NOT_FOUND, 'Payroll record not found', null);
      }
      return new ResponseDto(HttpStatus.OK, 'Payroll rejected successfully', data);
    } catch (error) {
      console.error('Controller error rejecting payroll:', error);
      throw new HttpException(error.message || 'Failed to reject payroll', HttpStatus.BAD_REQUEST);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('presignedUrl/:id')
  @ApiOperation({ summary: 'Get presigned URL for payslip PDF by ID' })
  @ApiParam({ name: 'id', description: 'Payslip ID', type: Number })
  @ApiResponse({ status: HttpStatus.OK, description: 'Presigned URL retrieved successfully', type: Object })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Payslip not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve payslip URL' })
  async getPayslipPdf(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ url: string; size: number }> {
    try {
      console.log(`Retrieving presigned URL for payslip ID: ${id}`);
      const result = await this.payrollService.getPayslipPdf(id);

      // Set response headers for JSON
      res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300', // 5 minutes cache
      });

      return result; // Return { url: string, size: number }
    } catch (error) {
      console.log(`Error in getPayslipPdf: ${error.message}`, error.stack);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('payslip/download/:id')
  async downloadPayslip(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { stream, filename } = await this.payrollService.downloadPayslipPdf(id);
      res.set({
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/pdf',
      });
      stream.pipe(res);
    } catch (error) {
      console.error('Controller error downloading payslip:', error);
      throw new HttpException('Failed to download payslip', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete payroll record' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Payroll record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Payroll not found' })
  async deletePayroll(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    await this.payrollService.deletePayroll(id);
    return res.status(HttpStatus.NO_CONTENT).send();
  }
}