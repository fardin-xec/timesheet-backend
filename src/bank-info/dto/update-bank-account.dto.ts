import { IsString, IsNotEmpty, Matches, Length, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateBankAccountDto {
  @ApiProperty({ description: 'Account holder name' })
  @IsNotEmpty({ message: 'Account holder name is required' })
  @IsString()
  @MaxLength(255)
  accountHolderName: string;

  @ApiProperty({ description: 'Bank name' })
  @IsNotEmpty({ message: 'Bank name is required' })
  @IsString()
  @MaxLength(255)
  bankName: string;

  @ApiProperty({ description: 'City' })
  @IsNotEmpty({ message: 'City is required' })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({ description: 'Branch name' })
  @IsNotEmpty({ message: 'Branch name is required' })
  @IsString()
  @MaxLength(255)
  branchName: string;

  @ApiProperty({ description: 'IFSC code', example: 'SBIN0001234' })
  @IsNotEmpty({ message: 'IFSC code is required' })
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'Invalid IFSC code format. Example: SBIN0001234'
  })
  ifscCode: string;

  @ApiProperty({ description: 'Account number' })
  @IsNotEmpty({ message: 'Account number is required' })
  @IsString()
  @Length(9, 18, { message: 'Account number must be between 9 and 18 characters' })
  accountNo: string;
}
