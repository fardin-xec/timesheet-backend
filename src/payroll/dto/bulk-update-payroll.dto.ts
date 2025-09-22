import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class BulkUpdateItemDto {
  @ApiProperty({ description: 'Payroll record ID', example: 1 })
  @IsNumber({}, { message: 'ID must be a number' })
  id: number;

  @ApiProperty({ 
    description: 'Payroll status', 
    enum: ['approved', 'pending'], 
    required: false 
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ 
    description: 'Other allowances amount', 
    example: 1000, 
    required: false 
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherAllowances?: number;
}

export class BulkUpdatePayrollDto {
  @ApiProperty({ 
    type: [BulkUpdateItemDto], 
    description: 'Array of payroll updates' 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  data: BulkUpdateItemDto[];
}