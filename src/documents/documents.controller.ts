import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    const document = await this.documentsService.uploadDocument(file);
    return {
      id: document.id,
      originalName: document.originalName,
      size: document.size,
      createdAt: document.createdAt,
    };
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    return await this.documentsService.getDocument(id);
  }

  @Get(':id/download')
  async downloadDocument(@Param('id') id: string, @Res() res: Response) {
    const { buffer, document } = await this.documentsService.getFileBuffer(id);

    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.originalName}"`,
      'Content-Length': document.size,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @Delete(':id')
  async deleteDocument(@Param('id') id: string) {
    await this.documentsService.deleteDocument(id);
    return { message: 'Document deleted successfully' };
  }
}
