import { IsString, IsEmail, IsPhoneNumber, IsOptional, IsEnum, IsDateString, IsNotEmpty, MinLength, Matches, isBoolean, IsBoolean } from 'class-validator';
import { EmployeeStatus, Gender } from '../../entities/employees.entity'
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeDto {
  // Mandatory Fields
  @IsNotEmpty({ message: 'First name is required' })
  @IsString({ message: 'First name must be a string' })
  firstName: string;

  @IsNotEmpty({ message: 'Last name is required' })
  @IsString({ message: 'Last name must be a string' })
  lastName: string;

  @IsOptional()
  @IsString({ message: 'Middle name must be a string' })
  midName?: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  @Matches(/^[0-9]{10,15}$/, {
    message: 'Phone number must be 10-15 digits',
  })
  phone: string;

  @IsNotEmpty({ message: 'Role is required' })
  @IsString({ message: 'Role must be a string' })
  role: string; // 'admin' | 'user' | 'manager'

  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(EmployeeStatus, {
    message: `Status must be one of: ${Object.values(EmployeeStatus).join(', ')}`,
  })
  status: EmployeeStatus;

  // Optional Fields
  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date' })
  dob?: string; // Will be validated to ensure not in future

  @IsOptional()
  @IsEnum(Gender, {
    message: `Gender must be one of: ${Object.values(Gender).join(', ')}`,
  })
  gender?: Gender;

  @IsOptional()
  @IsString({ message: 'Department must be a string' })
  department?: string;

  @IsOptional()
  @IsString({ message: 'Job title must be a string' })
  jobTitle?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string' })
  address?: string;

  // Salary Information
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'CTC must be a valid number',
  })
  ctc?: string;

  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  currency?: string;

  // Bank Information (Optional)
  @IsOptional()
  @IsString({ message: 'Account holder name must be a string' })
  accountHolderName?: string;

  @IsOptional()
  @IsString({ message: 'Bank name must be a string' })
  bankName?: string;

  @IsOptional()
  @IsString({ message: 'City must be a string' })
  city?: string;

  @IsOptional()
  @IsString({ message: 'Branch name must be a string' })
  branchName?: string;

  @IsOptional()
  @IsString({ message: 'IFSC code must be a string' })
  ifscCode?: string;

  @IsOptional()
  @IsString({ message: 'Swift code must be a string' })
  swiftCode?: string;

  @IsOptional()
  @IsString({ message: 'IBank No code must be a string' })
  ibankNo?: string;

  @IsOptional()
  @Matches(/^[0-9]{9,18}$/, {
    message: 'Account number must be 9-18 digits',
  })
  accountNumber?: string;

  // Document Information (Optional)
  @IsOptional()
  @IsString({ message: 'QID must be a string' })
  qid?: string;

  @IsOptional()
  @IsDateString({}, { message: 'QID expiration date must be a valid date' })
  qidExpirationDate?: string;

  @IsOptional()
  @IsString({ message: 'Passport number must be a string' })
  passportNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Passport valid till date must be a valid date' })
  passportValidTill?: string;

  // Additional Optional Fields
  @IsOptional()
  @IsString({ message: 'Designation must be a string' })
  designation?: string;

  @IsOptional()
  @IsString({ message: 'Employment type must be a string' })
  employmentType?: string;

  @IsOptional()
  @IsString({ message: 'Work Location must be a string' })
  workLocation?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Joining date must be a valid date' })
  joiningDate?: string;

  @IsOptional()
  @IsBoolean()
  isProbation?: boolean;

 @IsOptional()
 @IsDateString({}, { message: 'Confirmation date must be a valid date' })
 confirmationDate?: string;



  @IsOptional()
  @IsString({ message: 'Bio must be a string' })
  bio?: string;

  @IsOptional()
  reportTo?: number;

   @IsOptional()
  orgId?: number
}

export class CheckExistenceDto {
  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;
}