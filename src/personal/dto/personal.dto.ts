import { 
    IsEmail, IsISO8601, IsNotEmpty, IsNumber, 
    IsOptional, IsString, Length 
  } from 'class-validator';
  import { ApiProperty } from '@nestjs/swagger';
  import { Type } from 'class-transformer';
  
  export class CreatePersonalDto {
    @ApiProperty({ example: 1 })
    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    employeeId: number;
  
    @ApiProperty({ required: false, example: 'personal.email@example.com' })
    @IsEmail()
    @IsOptional()
    email?: string;
  
    @ApiProperty({ required: false, example: '+1987654321' })
    @IsString()
    @IsOptional()
    @Length(1, 20)
    alternativePhone?: string;
  
    @ApiProperty({ required: false, example: 'A+' })
    @IsString()
    @IsOptional()
    @Length(1, 10)
    bloodGroup?: string;
  
    @ApiProperty({ required: false, example: 'Married' })
    @IsString()
    @IsOptional()
    @Length(1, 20)
    maritalStatus?: string;
  
    @ApiProperty({ required: false, example: '2020-06-15' })
    @IsISO8601()
    @IsOptional()
    weddingAnniversary?: string;
  
    @ApiProperty({ required: false, example: '123 Apartment, Street, City, Country' })
    @IsString()
    @IsOptional()
    currentAddress?: string;
  
    @ApiProperty({ required: false, example: '456 Home, Street, City, Country' })
    @IsString()
    @IsOptional()
    permanentAddress?: string;
  }