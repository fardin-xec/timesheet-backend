import { IsEnum, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../entities/document.entity';

export class UploadDocumentDto {
  @ApiProperty({ 
    description: 'Type of document',
    enum: DocumentType,
    example: DocumentType.AADHAR_CARD
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({ description: 'ID of user uploading (for admin use)' })
  @IsOptional()
  @IsNumber()
  uploadedBy?: number;
}