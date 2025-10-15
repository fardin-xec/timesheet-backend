import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DocumentsService {
  private readonly uploadPath = './uploads';

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
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

  async uploadDocument(file: Express.Multer.File): Promise<Document> {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(this.uploadPath, fileName);

    // Save file to disk
    await fs.writeFile(filePath, new Uint8Array(file.buffer));

    // Save document info to database
    const document = this.documentRepository.create({
      originalName: file.originalname,
      filePath,
      mimeType: file.mimetype,
      size: file.size,
    });

    return await this.documentRepository.save(document);
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