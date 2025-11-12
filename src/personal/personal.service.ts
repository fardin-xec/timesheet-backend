import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { Personal } from '../entities/personal.entity';
import { Document, DocumentType } from '../entities/document.entity';
import { BankInfo } from '../entities/bank-info.entity';
import { CreatePersonalDto, UpdateBankInfoDto } from './dto/personal.dto';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from 'src/entities/employees.entity';
import { LeaveRule } from 'src/entities/leave-rule.entity';
import { EmployeeLeaveRule } from 'src/entities/employee-leave-rule.entity';
import { LeaveService } from 'src/LeaveManagementModule/leave.service';
import { LeaveFilterDto } from 'src/LeaveManagementModule/dto/create-leave.dto';
import { LeaveStatus } from 'src/entities/leave.entity';

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
  @InjectRepository(Employee)
  private readonly employeeRepository: Repository<Employee>,
  @InjectRepository(LeaveRule) 
  private leaveRuleRepository: Repository<LeaveRule>,
  @InjectRepository(EmployeeLeaveRule) 
  private employeeLeaveRuleRepository: Repository<EmployeeLeaveRule>,
  private readonly dataSource: DataSource,
  private leaveService:LeaveService,
  
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
        const employee = await this.employeeRepository.findOne({
          where: { id: employeeId }
        });
        
        if (!employee) {
          throw new NotFoundException(`Employee with ID ${employeeId} not found`);
        }
        
        return {
             employee: employee
          } as any;
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

  async createEmptyPersonal(
  employeeId: number
): Promise<{ success: boolean; message: string; data: Personal }> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Check if personal record already exists
    const existingPersonal = await queryRunner.manager.findOne(Personal, {
      where: { employeeId }
    });

    if (existingPersonal) {
      throw new BadRequestException(
        `Personal information for employee ID ${employeeId} already exists`
      );
    }

    // Verify employee exists
    const employee = await queryRunner.manager.findOne(Employee, {
      where: { id: employeeId }
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    // Create empty personal record
    const personal = queryRunner.manager.create(Personal, {
      employeeId,
      alternativePhone: null,
      bloodGroup: null,
      currentAddress: null,
      email: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      maritalStatus: null,
      nationality: null,
      permanentAddress: null,
      weddingAnniversary: null
    });

    const saved = await queryRunner.manager.save(Personal, personal);

    await queryRunner.commitTransaction();

    return {
      success: true,
      message: 'Empty personal record created successfully',
      data: saved
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }
    throw new InternalServerErrorException(
      `Failed to create personal record: ${error.message}`
    );
  } finally {
    await queryRunner.release();
  }
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
    const employee = await queryRunner.manager.findOne(Employee, {
      where: { id: employeeId },
    });
    await queryRunner.manager.update(Employee, { id: employeeId }, cleanedEmployee);
    const updatedEmployee = await queryRunner.manager.findOne(Employee, {
      where: { id: employeeId },
    });
    
     const isGenderChanged = dto.employeeFields.gender !== undefined && 
                             employee.gender !== updatedEmployee.gender

    if(isGenderChanged){
const filter: LeaveFilterDto ={
        status: LeaveStatus.APPROVED
      }
      const employeeLeave = await this.leaveService.getEmployeeLeaves(employeeId,filter)
      if(employeeLeave.length===0){
        await this.reassignLeaveRules(updatedEmployee);
      }

    }

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
async reassignLeaveRules(employee: Employee): Promise<void> {
   
  const currentYear = new Date().getFullYear();
  // Step 1: Remove all existing leave rule assignments for this employee
  await this.employeeLeaveRuleRepository.delete({
    employee: { id: employee.id },
  });

  await this.leaveService.deleteLeaveBalance(employee.id,currentYear)

  // Step 2: Get all active leave rules
  const leaveRules = await this.leaveRuleRepository.find({
    where: { isActive: true },
  });

  let rulesToAssign: LeaveRule[] = [];

  // Step 3: Decide which rules to assign
  if (employee.isProbation) {
    // If on probation, assign only lossOfPay
    const lossOfPayRule = leaveRules.find(
      (rule) => rule.leaveType === 'lossOfPay',
    );
    if (lossOfPayRule) rulesToAssign = [lossOfPayRule];
  } else {
    // Not on probation
    if (employee.gender === 'female') {
      // Female: assign all leave types
      rulesToAssign = leaveRules;
    } else {
      // Male: assign all except maternity leave
      rulesToAssign = leaveRules.filter(
        (rule) => rule.leaveType !== 'maternity',
      );
    }
  }

  // Step 4: Create new employee leave rule entries
  const employeeLeaveRules = rulesToAssign.map((rule) =>
    this.employeeLeaveRuleRepository.create({
      employee: employee,
      rule: rule,
      assignedAt: new Date(),
    }),
  );

  // Step 5: Save the new rules
  const savedRules = await this.employeeLeaveRuleRepository.save(
    employeeLeaveRules,
  );

  // Step 6: Initialize or update leave balances for the current year
  

  for (const assignedRule of savedRules) {
    const totalAllowed =
      assignedRule.customMaxAllowed ??
      assignedRule.rule.maxAllowed ??
      0;

    await this.leaveService.initializeLeaveBalance(
      employee.id,
      assignedRule.rule.leaveType,
      currentYear,
      Number(totalAllowed),
    );
  }
}
async handleUpdateRequest(
  employeeId: number,
  requestBody: Record<string, any>
) {
  const employeeFields: Partial<Employee> = {};
  const personalFields: Partial<Personal> = {};

  // Define field mappings
  const employeeFieldNames = [
    'bio', 'firstName', 'lastName', 'midName', 'phone', 'designation',
    'department', 'jobTitle', 'employmentType', 'joiningDate', 'dob','gender'
  ] as const;

  const personalFieldNames = [
    'alternativePhone', 'bloodGroup', 'currentAddress', 'email', 
    'emergencyContactName', 'emergencyContactPhone', 'maritalStatus', 
    'nationality', 'permanentAddress', 'weddingAnniversary'
  ] as const;

  // Map incoming fields to entity fields
  for (const [key, value] of Object.entries(requestBody)) {
    // Skip null, undefined, or empty string values
    if (value === null || value === undefined || value === '') {
      continue;
    }

    if (employeeFieldNames.includes(key as any)) {
      employeeFields[key] = value;
    } else if (personalFieldNames.includes(key as any)) {
      personalFields[key] = value;
    }
    // Unknown fields are silently ignored
  }

  // Validate that at least some fields are being updated
  if (Object.keys(employeeFields).length === 0 && Object.keys(personalFields).length === 0) {
    throw new BadRequestException('No valid fields provided for update');
  }

  // Call your existing update function
  const result = await this.updateEmployeeAndPersonal(employeeId, {
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
      isDeleted: false,
      documentType: Not(DocumentType.LEAVE)

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


