import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DropdownType } from '../entities/dropdown-types.entity';
import { DropdownValue } from '../entities/dropdown-values.entity';

@Injectable()
export class DropdownService {
  constructor(
    @InjectRepository(DropdownType)
    private DropdownTypesRepository: Repository<DropdownType>,
    @InjectRepository(DropdownValue)
    private DropdownValuesRepository: Repository<DropdownValue>,
  ) {}

  findAllTypes(): Promise<DropdownType[]> {
    return this.DropdownTypesRepository.find();
  }

  findOneType(id: number): Promise<DropdownType> {
    return this.DropdownTypesRepository.findOneBy({ typeId: id });
  }

  async createType(typeData: Partial<DropdownType>): Promise<DropdownType> {
    const type = this.DropdownTypesRepository.create(typeData);
    return this.DropdownTypesRepository.save(type);
  }

  async updateType(id: number, typeData: Partial<DropdownType>): Promise<DropdownType> {
    await this.DropdownTypesRepository.update(id, typeData);
    return this.findOneType(id);
  }

  async removeType(id: number): Promise<void> {
    await this.DropdownTypesRepository.delete(id);
  }

  findAllValues(): Promise<DropdownValue[]> {
    return this.DropdownValuesRepository.find();
  }

  findOneValue(id: number): Promise<DropdownValue> {
    return this.DropdownValuesRepository.findOneBy({ valueId: id });
  }

  async createValue(valueData: Partial<DropdownValue>): Promise<DropdownValue> {
    const value = this.DropdownValuesRepository.create(valueData);
    return this.DropdownValuesRepository.save(value);
  }

  async updateValue(id: number, valueData: Partial<DropdownValue>): Promise<DropdownValue> {
    await this.DropdownValuesRepository.update(id, valueData);
    return this.findOneValue(id);
  }

  async removeValue(id: number): Promise<void> {
    await this.DropdownValuesRepository.delete(id);
  }

  async findByType(id: number): Promise<DropdownValue[]> {
    return await this.DropdownValuesRepository.find({
      where: {
        type: {
          typeId: id
        }
      },
      relations: ['type'] // Include the 'org' relation if needed
    });
  }
}
