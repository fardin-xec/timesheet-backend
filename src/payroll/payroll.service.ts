import { Injectable, NotFoundException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payroll, PayrollStatus } from '../entities/payrolls.entity';
import { Payslip } from '../entities/payslips.entity';
import { Employee, EmployeeStatus } from '../entities/employees.entity';
import { Attendance, AttendanceStatus } from '../entities/attendances.entity';
import { Leave, LeaveStatus, LeaveType } from '../entities/leave.entity';
import { TaxRegime } from '../entities/tax-regime.entity';
import { PdfService } from './pdf.service';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { Organization } from '../entities/organizations.entity';
// import { S3 } from 'aws-sdk';
// import { Readable } from 'stream';
// import { integer } from 'aws-sdk/clients/cloudfront';
import path from 'path';
import { promises as fs } from 'fs';


// In-memory cache for presigned URLs
const presignedUrlCache = new Map<string, { url: string; expires: number; size: number }>();

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    @InjectRepository(Payroll)
    private payrollRepository: Repository<Payroll>,
    @InjectRepository(Payslip)
    private payslipRepository: Repository<Payslip>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Leave)
    private leaveRepository: Repository<Leave>,
    @InjectRepository(TaxRegime)
    private taxRegimeRepository: Repository<TaxRegime>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private pdfService: PdfService,
  ) {}
// EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT,
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'monthlyPayrollGeneration',
    timeZone: 'UTC',
  })
  async handleMonthlyPayrollCron() {
    this.logger.log('Starting monthly payroll generation');
    
    const organizations = await this.organizationRepository.find();
    const currentDate = new Date();
    // Calculate payroll for the previous month
    const payrollMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

    for (const org of organizations) {
      try {
        await this.generateMonthlyPayroll(org.orgId, payrollMonth);
        this.logger.log(`Payroll generated successfully for organization ${org.orgId}`);
      } catch (error) {
        this.logger.error(`Failed to generate payroll for organization ${org.orgId}: ${error.message}`);
      }
    }
  }

  async generateMonthlyPayroll(orgId: number, payrollMonth: Date) {
    const employees = await this.employeeRepository.find({
      where: { orgId, status: EmployeeStatus.ACTIVE },
    });

    const startDate = new Date(payrollMonth.getFullYear(), payrollMonth.getMonth(), 1);
    const endDate = new Date(payrollMonth.getFullYear(), payrollMonth.getMonth() + 1, 0);

    for (const employee of employees) {
      await this.generatePayrollForEmployee(employee, startDate, endDate);
    }
  }

  async generatePayrollForEmployee(employee: Employee, startDate: Date, endDate: Date) {
    const attendances = await this.attendanceRepository.find({
      where: {
        employeeId: employee.id,
        attendanceDate: Between(startDate, endDate),
      },
    });

    const leaves = await this.leaveRepository.find({
      where: {
        employeeId: employee.id,
        status: LeaveStatus.APPROVED,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });

    const workingDays = attendances.filter(
      (att) => att.status === AttendanceStatus.PRESENT || att.status === AttendanceStatus.HALF_DAY,
    ).length;

    const leaveDays = leaves.reduce((total, leave) => {
      const leaveStartDate = leave.startDate instanceof Date ? leave.startDate : new Date(leave.startDate);
      const leaveEndDate = leave.endDate instanceof Date ? leave.endDate : new Date(leave.endDate);

      if (isNaN(leaveStartDate.getTime()) || isNaN(leaveEndDate.getTime())) {
        this.logger.warn(`Invalid leave dates for employee ${employee.id}: startDate=${leave.startDate}, endDate=${leave.endDate}`);
        return total;
      }

      const leaveStart = new Date(Math.max(leaveStartDate.getTime(), startDate.getTime()));
      const leaveEnd = new Date(Math.min(leaveEndDate.getTime(), endDate.getTime()));
      const days = Math.ceil((leaveEnd.getTime() - leaveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return total + days;
    }, 0);

    const leavesLossOfpay = await this.leaveRepository.count({
      where: {
        employeeId: employee.id,
        status: LeaveStatus.APPROVED,
        leaveType: LeaveType.LOSSOFPAY,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });


    const monthlySalary = employee.ctc / 12;
    const basicSalary = monthlySalary * 0.5;
    const allowances = monthlySalary * 0.4;
    const specialAllowances=monthlySalary * 0.1;


   
    const grossSalary = basicSalary + allowances + specialAllowances;

    const currency= employee.currency;

    const DaySalary = monthlySalary/30;
    let deductions=0;
    if(leavesLossOfpay>0){
      deductions=leavesLossOfpay*DaySalary;
      console.log(DaySalary);
    }
    console.log(deductions);


    const taxRegime = await this.taxRegimeRepository.findOne({
      where: { orgId: employee.orgId, isActive: true , currency: employee.currency},
    });

    // const taxDeductions = taxRegime
    //   ? this.calculateTax(grossSalary, taxRegime.taxBrackets)
    //   : this.defaultTaxCalculation(grossSalary);

    const netSalary = (grossSalary - deductions);

    const payroll = this.payrollRepository.create({
      employeeId: employee.id,
      orgId: employee.orgId,
      payrollMonth: startDate,
      basicSalary,
      allowances,
      deductions,
      bonuses: 0,
      taxDeductions: 0,
      netSalary,
      workingDays,
      leaveDays,
      currency,
      status: PayrollStatus.PENDING,
      specialAllowances,
    });

    const savedPayroll = await this.payrollRepository.save(payroll);
    await this.generatePayslip(savedPayroll);
  }

 

  private async generatePayslip(payroll: Payroll) {
    const employee = await this.employeeRepository.findOne({ 
      where: { id: payroll.employeeId },
      relations: ['bankAccounts']
    });    
    
    const org = await this.organizationRepository.findOne({ where: { orgId: employee.orgId } });
    const pdfUrl = await this.pdfService.generatePayslipPdf(payroll, employee,org);
    const paySlip= await this.payslipRepository.findOne({where:{payrollId:payroll.id}})
    
    if(paySlip===null||paySlip===undefined){
    
      const payslip = this.payslipRepository.create({
        payrollId: payroll.id,
        employeeId: payroll.employeeId,
        generatedDate: new Date(),
        pdfUrl,
    });
      await this.payslipRepository.save(payslip);

    }
    

  }

  private calculateTax(grossSalary: number, taxBrackets: Array<{ minAmount: number; maxAmount: number | null; rate: number }>): number {
    let tax = 0;
    for (const bracket of taxBrackets) {
      if (grossSalary >= bracket.minAmount && (!bracket.maxAmount || grossSalary <= bracket.maxAmount)) {
        tax = grossSalary * bracket.rate;
        break;
      }
    }
    return tax;
  }

  private defaultTaxCalculation(grossSalary: number): number {
    if (grossSalary <= 25000) return grossSalary * 0.1;
    if (grossSalary <= 50000) return grossSalary * 0.2;
    return grossSalary * 0.3;
  }



  async getPayroll({
    orgId,
    month,
    year,
    employeeId,
    page,
    limit,
}: {
    orgId: number;
    month: number;
    year: number;
    employeeId?: string;
    page: number;
    limit: number;
}): Promise<{ data: Payroll[]; total: number }> {
    try {
        const query = this.payrollRepository
            .createQueryBuilder('payroll')
            .leftJoinAndSelect('payroll.employee', 'employee')
            .leftJoinAndSelect('payroll.payslip', 'payslip') // Updated to singular 'payslip' for OneToOne relationship
            .where('payroll.orgId = :orgId', { orgId })
            .andWhere(
                "EXTRACT(YEAR FROM payroll.payrollMonth) = :year AND EXTRACT(MONTH FROM payroll.payrollMonth) = :month",
                { year, month }
            );

        if (employeeId) {
            query.andWhere('payroll.employeeId = :employeeId', { employeeId });
        }

        const [data, total] = await query
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        
        return { data, total };
    } catch (error) {
        console.error('Service error retrieving payroll:', error);
        throw new HttpException('Failed to retrieve payroll records', HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
  async updatePayroll(id: number, updatePayrollDto: UpdatePayrollDto): Promise<Payroll> {
    try {
      const payroll = await this.payrollRepository.findOne({ where: { id } });
      if (!payroll) {
        throw new NotFoundException('Payroll not found');
      }

   
   
    if(updatePayrollDto.otherAllowances){
      payroll.otherAllowances=updatePayrollDto.otherAllowances;
    }


    const basicSalary = +payroll.basicSalary;
    const allowances = +payroll.allowances;
    const otherAllowances = +payroll.otherAllowances;
    const specialAllowances = +payroll.specialAllowances;

    const deductions = +payroll.deductions;
    const taxDeductions = +payroll.taxDeductions;



    
      const grossSalary = basicSalary + allowances+specialAllowances +otherAllowances;



      const netSalary = (grossSalary - deductions) - taxDeductions;


      payroll.netSalary=netSalary;

      const result=await this.payrollRepository.save(payroll);
      
      await this.generatePayslip(result);


      return result
    } catch (error) {
      console.error('Service error updating payroll:', error);
      throw new HttpException(
        error.message || 'Failed to update payroll',
        error instanceof NotFoundException ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
  }

  async approvePayroll(id: number): Promise<Payroll> {
    try {
      const payroll = await this.payrollRepository.findOne({ where: { id } });
      if (!payroll) {
        throw new NotFoundException('Payroll not found');
      }

      payroll.status = PayrollStatus.APPROVED;
      return await this.payrollRepository.save(payroll);
    } catch (error) {
      console.error('Service error approving payroll:', error);
      throw new HttpException(
        error.message || 'Failed to approve payroll',
        error instanceof NotFoundException ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
  }

  async rejectPayroll(id: number): Promise<Payroll> {
    try {
      const payroll = await this.payrollRepository.findOne({ where: { id } });
      if (!payroll) {
        throw new NotFoundException('Payroll not found');
      }

      payroll.status = PayrollStatus.REJECTED;
      return await this.payrollRepository.save(payroll);
    } catch (error) {
      console.error('Service error rejecting payroll:', error);
      throw new HttpException(
        error.message || 'Failed to reject payroll',
        error instanceof NotFoundException ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST,
      );
    }
  }

  async getPayslipPdf(id: number): Promise<{ url: string; size: number }> {
    try {
      // Fetch payslip metadata from the database
      const payslip = await this.payslipRepository.findOne({ where: { id } });
      if (!payslip) {
        throw new NotFoundException('Payslip not found');
      }
      const url = payslip.pdfUrl;
     // Check if file exists and get its stats
    let fileSize: number;
    try {
      const stats = await fs.stat(url);
      
      // Verify it's a file and not a directory
      if (!stats.isFile()) {
        throw new HttpException('Path is not a file', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      fileSize = stats.size;
      
      this.logger.log(`Found payslip file at: ${url}, size: ${fileSize} bytes`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('PDF file not found in file system');
      }
      throw new HttpException(
        `Error accessing file: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Optionally verify it's a PDF by checking file extension
    const ext = path.extname(url).toLowerCase();
    if (ext !== '.pdf') {
      this.logger.warn(`File is not a PDF: ${url}`);
    }

    return { url, size: fileSize };
    } catch (error) {
      this.logger.error('Error generating presigned URL for payslip:', error.message, error.stack);
      throw new HttpException(
        error.message || 'Failed to retrieve payslip URL',
        error instanceof NotFoundException ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async downloadPayslipPdf(id: number): Promise<{ stream: Readable; filename: string }> {
  //   try {
  //     const payroll = await this.payrollRepository.findOne({ where: { id } });
  //     if (!payroll) {
  //       throw new NotFoundException('Payroll not found');
  //     }

  //     const payslip = await this.payslipRepository.findOne({ where: { id } });
  //     if (!payslip) {
  //       throw new NotFoundException('Payroll not found');
  //     }
  //     const year = payroll.payrollMonth.getFullYear();
  //     const month = payroll.payrollMonth.getMonth() + 1;      
  //     const key = payslip.pdfUrl.split('/').slice(-2).join('/');
     
  //     const s3 = new S3();
  //     const params = {
  //       Bucket: process.env.S3_BUCKET,
  //       Key: key,
  //       Expires: 60 * 5, // 5 minutes
  //     };
  //     const filename = `payslip-${payroll.employeeId}-${year}-${month}.pdf`;
  //     const stream = s3.getObject(params).createReadStream();

  //     return { stream, filename };
  //   } catch (error) {
  //     console.error('Service error downloading payslip:', error);
  //     throw new HttpException(
  //       error.message || 'Failed to download payslip',
  //       error instanceof NotFoundException ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }


// async deletePayroll(id: number): Promise<void> {
//   try {
//     const payroll = await this.payrollRepository.findOne({ where: { id } });
//     if (!payroll) {
//       throw new NotFoundException('Payroll not found');
//     }

//     // First check if there's an associated payslip
//     const payslip = await this.payslipRepository.findOne({ where: { payrollId: id } });
//     if (payslip) {
//       // Extract local file path from the URL (assuming URL is relative, e.g. /uploads/payslips/file.pdf)
//       // Adjust process cwd and remove leading slash as needed
//       let filePath = payslip.pdfUrl;
//       if (filePath.startsWith('/')) {
//         filePath = filePath.slice(1);
//       }
//       filePath = path.join(process.cwd(), filePath);

//       // Delete file from filesystem
//       try {
//         await fs.unlink(filePath);
//         this.logger.log(`Deleted payslip PDF from filesystem: ${filePath}`);

//         // Remove from cache if exists
//         if (presignedUrlCache.has(filePath)) {
//           presignedUrlCache.delete(filePath);
//         }
//       } catch (fsErr: any) {
//         if (fsErr.code !== 'ENOENT') { // Ignore if file doesn't exist
//           this.logger.error(`Failed to delete payslip PDF file: ${fsErr.message}`, fsErr.stack);
//         }
//       }

//       // Delete the payslip record
//       await this.payslipRepository.delete(payslip.id);
//     }

//     // Delete the payroll record
//     await this.payrollRepository.delete(id);
//     this.logger.log(`Payroll with ID ${id} has been deleted`);

//   } catch (error: any) {
//     this.logger.error(`Service error deleting payroll: ${error.message}`, error.stack);
//     throw new HttpException(
//       error.message || 'Failed to delete payroll',
//       error instanceof NotFoundException ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR,
//     );
//   }
// }


//   async bulkUpdatePayroll(updates: { id: integer; status?: string; otherAllowances?: number }[]): Promise<Payroll[]> {
//     if (!updates || updates.length === 0) {
//       throw new HttpException('No updates provided', HttpStatus.BAD_REQUEST);
//     }

//     const ids = updates.map((item) => item.id);
//     const payrolls = await this.payrollRepository.find({
//       where: { id: In(ids) },
//     });

//     if (payrolls.length !== ids.length) {
//       throw new HttpException('One or more payroll records not found', HttpStatus.NOT_FOUND);
//     }

//     const updatedPayrolls: Payroll[] = [];


    
//     await this.payrollRepository.manager.transaction(async (transactionalEntityManager) => {
//       for (const update of updates) {
//         const payroll = payrolls.find((p) => p.id ===update.id);
//         if (!payroll) continue;
//         let updatedPayroll;

//         // Apply updates
//         if (update.status && ['approved', 'pending'].includes(update.status)) {
//           if(update.status==='approved'){
//            payroll.status = PayrollStatus.APPROVED;
//           }else{
//            payroll.status = PayrollStatus.PENDING;

//           }
//          updatedPayroll = await transactionalEntityManager.save(Payroll, payroll);

//         }
//         if (update.otherAllowances !== undefined) {
//           payroll.otherAllowances = update.otherAllowances;
//           const basicSalary = +payroll.basicSalary;
//           const allowances = +payroll.allowances;
//           const otherAllowances = +payroll.otherAllowances;
//           const specialAllowances = +payroll.specialAllowances;
//           const grossSalary = basicSalary + allowances+specialAllowances +otherAllowances;
//           payroll.netSalary=grossSalary;
//           console.log(grossSalary);
          
//           updatedPayroll = await transactionalEntityManager.save(Payroll, payroll);
      
//           await this.generatePayslip(updatedPayroll);
//         }

//         updatedPayrolls.push(updatedPayroll);
//       }
//     });

//     return updatedPayrolls;
//   }


async deletePayrollsByEmployeeId(employeeId: number): Promise<void> {
  try {
    // Find all payrolls for the employee
    const payrolls = await this.payrollRepository.find({
      where: { employee: { id: employeeId } }
    });

    if (!payrolls.length) {
      this.logger.log(`No payrolls found for employee ID ${employeeId}`);
      return;
    }

    // For each payroll, handle payslip file & record deletion
    for (const payroll of payrolls) {
      const payslip = await this.payslipRepository.findOne({ where: { payrollId: payroll.id } });
      if (payslip) {
        let filePath = payslip.pdfUrl;
        if (filePath.startsWith('/')) {
          filePath = filePath.slice(1);
        }
        filePath = path.join(process.cwd(), filePath);

        try {
          await fs.unlink(filePath);
          this.logger.log(`Deleted payslip PDF from filesystem: ${filePath}`);

          if (presignedUrlCache.has(filePath)) {
            presignedUrlCache.delete(filePath);
          }
        } catch (fsErr: any) {
          if (fsErr.code !== 'ENOENT') {
            this.logger.error(`Failed to delete payslip PDF file: ${fsErr.message}`, fsErr.stack);
          }
        }
        await this.payslipRepository.delete(payslip.id);
      }
    }

    // Bulk delete all payroll records for employee
    await this.payrollRepository.delete({ employee: { id: employeeId } });
    this.logger.log(`Deleted all payrolls for employee ID ${employeeId}`);

  } catch (error: any) {
    this.logger.error(`Error deleting payrolls for employee ID ${employeeId}: ${error.message}`, error.stack);
    throw new HttpException(
      `Failed to delete payrolls for employee ID ${employeeId}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

}