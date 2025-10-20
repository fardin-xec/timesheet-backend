import { 
    IsEmail, IsEnum, IsISO8601, IsNotEmpty, IsNumber, 
    IsOptional, IsString, Length, 
    Matches, 
    MaxLength
  } from 'class-validator';
  import { ApiProperty } from '@nestjs/swagger';
  import { Type } from 'class-transformer';
import { DocumentType } from 'src/entities/document.entity';
  
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

    @ApiProperty({ required: false, example: 'Raju' })
    @IsString()
    @IsOptional()
    emergencyContactName?: string;

    @ApiProperty({ required: false, example: '+917788678778' })
    @IsString()
    @IsOptional()
    emergencyContactPhone?: string;

    @ApiProperty({ required: false, example: 'Indian' })
    @IsString()
    @IsOptional()
    nationality?: string;
  }

  export class UpdateBankInfoDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  accountHolderName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  bankName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  branchName: string;

  @ApiProperty({ example: 'SBIN0001234' })
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'Invalid IFSC code format'
  })
  ifscCode: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(9, 18)
  accountNo: string;
}

export class UploadDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;
}