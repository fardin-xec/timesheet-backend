import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  Res,
  HttpStatus,
  Request,
  HttpCode,
  UseInterceptors,
  Query,
  ParseIntPipe,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../entities/users.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadDocumentDto } from './dto/upload-document.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadDocument(
    @Query('employeeId', ParseIntPipe) employeeId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @Request() req: any,
  ) {
    const uploadedBy = req.user.userId;

    const document = await this.documentsService.uploadDocument(
      file,
      employeeId,
      uploadedBy
    );

    return {
      id: document.id,
      originalName: document.originalName,
      size: document.size,
      createdAt: document.createdAt,
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  async getDocument(@Param('id') id: string) {
    return await this.documentsService.getDocument(id);
  }

  @Get(':id/download')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
async downloadDocument(
  @Param('id') id: string, 
  @Query('inline') inline: string,
  @Res() res: Response
) {
  const { buffer, document } = await this.documentsService.getFileBuffer(id);

  // Use 'inline' for viewing in browser, 'attachment' for downloading
  const disposition = inline === 'true' ? 'inline' : 'attachment';

  res.set({
    'Content-Type': document.mimeType,
    'Content-Disposition': `${disposition}; filename="${document.originalName}"`,
    'Content-Length': document.size,
  });

  res.status(HttpStatus.OK).send(buffer);
}

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteDocument(@Param('id') id: string) {
    await this.documentsService.deleteDocument(id);
    return { message: 'Document deleted successfully' };
  }
}
