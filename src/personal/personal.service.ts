import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Personal } from '../entities/personal.entity';
import { Document, DocumentType } from '../entities/document.entity';
import { BankInfo } from '../entities/bank-info.entity';
import { CreatePersonalDto, UpdateBankInfoDto } from './dto/personal.dto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from 'src/entities/employees.entity';

@Injectable()
export class PersonalService {
  private readonly uploadPath = process.env.UPLOAD_PATH || './uploads/documents';
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];

  constructor(
    @InjectRepository(Personal)
    private readonly personalRepository: Repository<Personal>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(BankInfo)
    private readonly bankInfoRepository: Repository<BankInfo>,
    private readonly dataSource: DataSource,
  ) {
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory() {
    try {
      await fs.mkdir(this.uploadPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directory:', error);
    }
  }

  // ==================== PERSONAL INFORMATION ====================

  async findAll(): Promise<Personal[]> {
    try {
      return await this.personalRepository.find({
        relations: ['employee'],
        order: { createdAt: 'DESC' }
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve personal records');
    }
  }

  async findByEmployeeId(employeeId: number): Promise<Personal> {
    const personal = await this.personalRepository.findOne({
      where: { employeeId },
      relations: ['employee']
    });
    
    if (!personal) {
      throw new NotFoundException(
        `Personal information for employee ID ${employeeId} not found`
      );
    }
    
    return personal;
  }

  async findOne(id: number): Promise<Personal> {
    const personal = await this.personalRepository.findOne({
      where: { id },
      relations: ['employee'],
    });
    
    if (!personal) {
      throw new NotFoundException(`Personal information with ID ${id} not found`);
    }
    
    return personal;
  }

  async findEmployeeOne(employeeId: number): Promise<Personal | null> {
    try {
      return await this.personalRepository.findOne({
        where: { employeeId },
        relations: ['employee'],
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve personal information');
    }
  }

 async updateEmployeeAndPersonal(
  employeeId: number,
  dto: { employeeFields: Partial<Employee>, personalFields: Partial<Personal> },
  modifiedBy?: string | number
): Promise<{ success: boolean; message: string; data: { employee: Employee; personal: Personal } }> {
  if (!employeeId || employeeId <= 0) {
    throw new BadRequestException('Invalid employee ID');
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Update Employee
    const cleanedEmployee = Object.fromEntries(
      Object.entries(dto.employeeFields).map(([k, v]) => [k, v === '' ? null : v])
    );
    await queryRunner.manager.update(Employee, { id: employeeId }, cleanedEmployee);
    const updatedEmployee = await queryRunner.manager.findOne(Employee, {
      where: { id: employeeId },
    });

    // 2. Update/Create Personal (foreign key by employeeId)
    let personal = await queryRunner.manager.findOne(Personal, { where: { employeeId } });
    const cleanedPersonal = Object.fromEntries(
      Object.entries(dto.personalFields).map(([k, v]) => [k, v === '' ? null : v])
    );
    if (personal) {
      await queryRunner.manager.update(Personal, { employeeId }, cleanedPersonal);
      personal = await queryRunner.manager.findOne(Personal, { where: { employeeId } });
    } else {
      personal = queryRunner.manager.create(Personal, {
        ...cleanedPersonal,
        employeeId,
      });
      personal = await queryRunner.manager.save(personal);
    }

    await queryRunner.commitTransaction();

    return {
      success: true,
      message: 'Employee and personal information updated successfully',
      data: { employee: updatedEmployee, personal },
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw new InternalServerErrorException(
      `Failed to update employee or personal data: ${error.message}`
    );
  } finally {
    await queryRunner.release();
  }
}
async  handleUpdateRequest(
  employeeId: number,
  requestBody: any
) {
  const employeeFields = {};
  const personalFields = {};

  // Map incoming fields to entity fields
  for (const [key, value] of Object.entries(requestBody)) {
    // Logic to determine which entity the field belongs to
      if ([
      'bio', 'firstName', 'lastName', 'midName', 'phone', 'designation',
      'department', 'jobTitle', 'employmentType', 'joiningDate', 'dob', 'email' // add email if you want employee.email updated
    ].includes(key)) {
      employeeFields[key] = value;
    } else if ([
      'alternativePhone', 'bloodGroup', 'currentAddress', 'email', 'emergencyContactName', 
      'emergencyContactPhone', 'maritalStatus', 'nationality', 'permanentAddress', 'weddingAnniversary'
    ].includes(key)) {
      personalFields[key] = value;
    } else {
      // Skip or handle other keys if needed
    }
  }

  // Call your existing update function
  const result =  this.updateEmployeeAndPersonal(employeeId, {
    employeeFields,
    personalFields,
  });

  return result;
}




  async remove(
    id: number,
    deletedBy?: string | number
  ): Promise<{ success: boolean; message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const personal = await queryRunner.manager.findOne(Personal, {
        where: { id }
      });

      if (!personal) {
        throw new NotFoundException(`Personal information with ID ${id} not found`);
      }

      const oldValues = { ...personal };
      const result = await queryRunner.manager.delete(Personal, id);

      if (result.affected === 0) {
        throw new NotFoundException(`Personal information with ID ${id} not found`);
      }

     

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Personal information deleted successfully'
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to delete personal information: ${error.message}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== BANK ACCOUNT ====================

  async getBankInfo(employeeId: number): Promise<BankInfo> {
    const account = await this.bankInfoRepository.findOne({
      where: { employeeId: employeeId }
    });

    if (!account) {
      return {
        id: null,
        userId: employeeId.toString(),
        accountHolderName: null,
        bankName: null,
        city: null,
        branchName: null,
        ifscCode: null,
        accountNumber: null,
        createdAt: null,
        updatedAt: null
      } as any;
    }

    return account;
  }

  async updateBankInfo(
    employeeId: number,
    dto: UpdateBankInfoDto,
    modifiedBy?: string | number
  ): Promise<{ success: boolean; message: string; data: BankInfo }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let bankInfo = await queryRunner.manager.findOne(BankInfo, {
        where: { employeeId: employeeId }
      });

      const action = bankInfo ? 'UPDATE' : 'CREATE';

      if (!bankInfo) {
        bankInfo = queryRunner.manager.create(BankInfo, {
          userId: employeeId.toString(),
          ...dto
        });
      } else {
        Object.assign(bankInfo, dto);
      }

      const saved = await queryRunner.manager.save(BankInfo, bankInfo);

      
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Bank account ${action === 'CREATE' ? 'created' : 'updated'} successfully`,
        data: saved
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        `Failed to update bank account: ${error.message}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== DOCUMENT MANAGEMENT ====================

 async getDocuments(employeeId: number): Promise<Document[]> {
  const documents = await this.documentRepository.find({
    where: {
      employeeId: employeeId,
      isDeleted: false
    },
    order: { createdAt: 'DESC' }
  });

  if (!documents || documents.length === 0) {
    throw new NotFoundException('No documents found for this employee');
  }

  return documents;
}

  async getDocumentById(documentId: string, employeeId: number): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: {
        id: documentId,
        employeeId: employeeId,
        isDeleted: false
      }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async uploadDocument(
    employeeId: number,
    file: Express.Multer.File,
    documentType: DocumentType,
    uploadedBy?: number
  ): Promise<{ success: boolean; message: string; data: Document }> {
    this.validateFile(file);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fileExtension = path.extname(file.originalname);
      const filename = `${employeeId}_${documentType}_${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadPath, filename);

      await fs.writeFile(filePath,new Uint8Array(file.buffer) );

      const document = queryRunner.manager.create(Document, {
        employeeId: employeeId,
        originalName: file.originalname,
        filePath,
        mimeType: file.mimetype,
        size: file.size,
        documentType,
        uploadedBy: uploadedBy ,
        isDeleted: false
      });

      const saved = await queryRunner.manager.save(Document, document);

      
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Document uploaded successfully',
        data: saved
      };
    } catch (error) {
      console.log(error);
      
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException(
        `Failed to upload document: ${error.message}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  async replaceDocument(
    documentId: string,
    employeeId: number,
    file: Express.Multer.File,
    uploadedBy?:  number
  ): Promise<{ success: boolean; message: string; data: Document }> {
    this.validateFile(file);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const oldDocument = await queryRunner.manager.findOne(Document, {
        where: {
          id: documentId,
          employeeId: employeeId,
          isDeleted: false
        }
      });

      if (!oldDocument) {
        throw new NotFoundException('Document not found');
      }

      const oldFilePath = oldDocument.filePath;

      const fileExtension = path.extname(file.originalname);
      const filename = `${employeeId}_${oldDocument.documentType}_${uuidv4()}${fileExtension}`;
      const newFilePath = path.join(this.uploadPath, filename);

      await fs.writeFile(newFilePath, new Uint8Array(file.buffer));

      oldDocument.originalName = file.originalname;
      oldDocument.filePath = newFilePath;
      oldDocument.mimeType = file.mimetype;
      oldDocument.size = file.size;
      oldDocument.uploadedBy = uploadedBy;

      const saved = await queryRunner.manager.save(Document, oldDocument);

      try {
        await fs.unlink(oldFilePath);
      } catch (error) {
        console.error('Failed to delete old file:', error);
      }

    
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Document replaced successfully',
        data: saved
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to replace document: ${error.message}`
      );
    } finally {
      await queryRunner.release();
    }
  }

  async deleteDocument(
    documentId: string,
    employeeId: number,
    // deletedBy?: string | number
  ): Promise<{ success: boolean; message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const document = await queryRunner.manager.findOne(Document, {
        where: {
          id: documentId,
          employeeId: employeeId,
          isDeleted: false
        }
      });

      if (!document) {
        throw new NotFoundException('Document not found');
      }

      const oldValues = { ...document };

      document.isDeleted = true;
      await queryRunner.manager.save(Document, document);

     
      await queryRunner.commitTransaction();

      fs.unlink(document.filePath).catch(err =>
        console.error('Failed to delete file:', err)
      );

      return {
        success: true,
        message: 'Document deleted successfully'
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to delete document: ${error.message}`
      );
    } finally {
      await queryRunner.release();
    }
  }

 

  // ==================== PRIVATE HELPERS ====================

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed types: PDF, JPG, PNG, DOCX'
      );
    }
  }

  
 
}


