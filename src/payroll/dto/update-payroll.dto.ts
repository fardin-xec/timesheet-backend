import { IsNumber, IsOptional, IsEnum } from 'class-validator';
import { PayrollStatus } from '../../entities/payrolls.entity';

export class UpdatePayrollDto {
  @IsNumber()
  @IsOptional()
  basicSalary?: number;

  @IsNumber()
  @IsOptional()
  allowances?: number;

  @IsNumber()
  @IsOptional()
  bonuses?: number;

  @IsNumber()
  @IsOptional()
  deductions?: number;

  @IsNumber()
  @IsOptional()
  taxDeductions?: number;

  @IsEnum(PayrollStatus)
  @IsOptional()
  status?: PayrollStatus;
}