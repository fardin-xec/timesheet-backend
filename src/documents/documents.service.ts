import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentType } from '../entities/document.entity';
import * as fs from 'fs/promises';
import { PersonalService } from 'src/personal/personal.service';

@Injectable()
export class DocumentsService {
  private readonly uploadPath = './uploads';

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @Inject(forwardRef(() => PersonalService))
    private personalService:PersonalService,

  ) {
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory() {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
    }
  }

  async uploadDocument(file: Express.Multer.File,employeeId: number,uploadedBy: number): Promise<Document> {
   
   const document = await this.personalService.uploadDocument(employeeId,file,DocumentType.LEAVE,uploadedBy)
    return document.data;
  }

  

  async getDocument(id: string): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  async getFileBuffer(id: string): Promise<{ buffer: Buffer; document: Document }> {
    const document = await this.getDocument(id);
    const buffer = await fs.readFile(document.filePath);
    return { buffer, document };
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.getDocument(id);
    await fs.unlink(document.filePath);
    await this.documentRepository.remove(document);
  }
}