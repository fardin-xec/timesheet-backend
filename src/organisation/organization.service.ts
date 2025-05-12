import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organizations.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private organizationsRepository: Repository<Organization>,
  ) {}

  findAll(): Promise<Organization[]> {
    return this.organizationsRepository.find();
  }

  findOne(id: number): Promise<Organization> {
    return this.organizationsRepository.findOneBy({ orgId: id });
  }

  async create(organizationData: Partial<Organization>): Promise<Organization> {
    const organization = this.organizationsRepository.create(organizationData);
    return this.organizationsRepository.save(organization);
  }

  async update(id: number, organizationData: Partial<Organization>): Promise<Organization> {
    await this.organizationsRepository.update(id, organizationData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.organizationsRepository.delete(id);
  }
}
