import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { BankInfo } from '../entities/bank-info.entity';

@Injectable()
export class BankInfoService {
  constructor(
    @InjectRepository(BankInfo)
    private bankInfoRepository: Repository<BankInfo>,
  ) {}

  async create(BankInfo: BankInfo): Promise<BankInfo> {

    
    
    // If marking as primary, unset any existing primary accounts for this employee
    if (BankInfo.isPrimary && BankInfo.employeeId) {
      await this.bankInfoRepository.update(
        { employeeId: BankInfo.employeeId, isPrimary: true },
        { isPrimary: false }
      );
    }

    const bankInfoData: Partial<BankInfo> = {
      bankName: BankInfo.bankName,
      accountHolderName:BankInfo.accountHolderName,
      branchName: BankInfo.branchName,
      city: BankInfo.city,
      ifscCode: BankInfo.ifscCode,
      accountNo: BankInfo.accountNo,
      employeeId:BankInfo.employeeId,
    };
    
    
    
    const bankInfo = this.bankInfoRepository.create(bankInfoData);
    return this.bankInfoRepository.save(bankInfo);
  }

  async findAll(): Promise<BankInfo[]> {
    return this.bankInfoRepository.find({
      relations: ['employee'],
    });
  }

  async findByEmployeeId(employeeId: number): Promise<BankInfo> {
    return this.bankInfoRepository.findOne({
      where: { employeeId },
      relations: ['employee'],
    });
  }

  async findOne(id: number): Promise<BankInfo> {
    const bankInfo = await this.bankInfoRepository.findOne({
      where: { bankId: id },
      relations: ['employee'],
    });
    
    if (!bankInfo) {
      throw new NotFoundException(`Bank info with ID ${id} not found`);
    }
    
    return bankInfo;
  }

  async update(id: number, BankInfo: BankInfo): Promise<BankInfo> {
    const bankInfo = await this.findOne(id);
    
    
    // If marking as primary, unset any existing primary accounts for this employee
    if (BankInfo.isPrimary && 
        (bankInfo.isPrimary !== BankInfo.isPrimary) && 
        (BankInfo.employeeId || bankInfo.employeeId)) {
      const employeeId = BankInfo.employeeId || bankInfo.employeeId;
      await this.bankInfoRepository.update(
        { employeeId, isPrimary: true, bankId: Not(id) },
        { isPrimary: false }
      );
    }
    
    await this.bankInfoRepository.update(id, BankInfo);
    return this.findOne(id);
  }

  async setPrimary(id: number): Promise<BankInfo> {
    const bankInfo = await this.findOne(id);
    
    // Unset any existing primary accounts for this employee
    if (bankInfo.employeeId) {
      await this.bankInfoRepository.update(
        { employeeId: bankInfo.employeeId, isPrimary: true },
        { isPrimary: false }
      );
    }
    
    bankInfo.isPrimary = true;
    await this.bankInfoRepository.save(bankInfo);
    
    return this.findOne(id);
  }

  async remove(employeeId: number): Promise<void> {
    try {
      const result = await this.bankInfoRepository.delete({ employeeId });
      if (result.affected === 0) {
        throw new NotFoundException(`Bank info for employee ID ${employeeId} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error; // Re-throw NotFoundException as-is
      }
      throw new Error(`Failed to delete bank info: ${error.message}`);
    }
  }
}