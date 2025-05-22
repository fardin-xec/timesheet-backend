import { IsNumber, IsOptional, IsEnum } from 'class-validator';
import { PayrollStatus } from '../../entities/payrolls.entity';

export class UpdatePayrollDto {
  

  @IsNumber()
  @IsOptional()
  otherAllowances?: number;
}