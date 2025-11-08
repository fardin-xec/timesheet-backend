import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaveRule } from '../entities/leave-rule.entity';
import { Organization } from '../entities/organizations.entity';
import { CreateLeaveRuleDto, UpdateLeaveRuleDto } from './dto/leave-rule.dto';
import { LeaveType } from '../entities/leave.entity';
import { Gender } from 'src/entities/employees.entity';

@Injectable()
export class LeaveRuleService {
  constructor(
    @InjectRepository(LeaveRule)
    private leaveRuleRepository: Repository<LeaveRule>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async createLeaveRule(orgId: number, dto: CreateLeaveRuleDto): Promise<LeaveRule> {
    const organization = await this.organizationRepository.findOne({
      where: { orgId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check if rule already exists for this leave type
    const existingRule = await this.leaveRuleRepository.findOne({
      where: {
        organization: { orgId },
        leaveType: dto.leaveType as any,
      },
    });

    if (existingRule) {
      throw new BadRequestException(
        `Leave rule for ${dto.leaveType} already exists. Use update instead.`
      );
    }

    // Set default values based on leave type
    const ruleDefaults = this.getLeaveTypeDefaults(dto.leaveType);

    const leaveRule = this.leaveRuleRepository.create({
      organization,
      leaveType: dto.leaveType as any,
      maxAllowed: dto.maxAllowed,
      carryForwardMax: dto.carryForwardMax ?? ruleDefaults.carryForwardMax,
      accrualRate: dto.accrualRate,
      isActive: dto.isActive ?? true,
      applicableGender: dto.applicableGender,
      minTenureMonths: dto.minTenureMonths ?? 0,
    });

    return this.leaveRuleRepository.save(leaveRule);
  }

  async updateLeaveRule(
    ruleId: number,
    orgId: number,
    dto: UpdateLeaveRuleDto
  ): Promise<LeaveRule> {
    const leaveRule = await this.leaveRuleRepository.findOne({
      where: { id: ruleId },
      relations: ['organization'],
    });

    if (!leaveRule) {
      throw new NotFoundException('Leave rule not found');
    }

    if (leaveRule.organization.orgId !== orgId) {
      throw new BadRequestException('Leave rule does not belong to your organization');
    }

    // Update only provided fields
    Object.assign(leaveRule, dto);

    return this.leaveRuleRepository.save(leaveRule);
  }

  async getLeaveRules(orgId: number): Promise<LeaveRule[]> {
    return this.leaveRuleRepository.find({
      where: { organization: { orgId: orgId } },
      relations: ['organization'],
      order: { leaveType: 'ASC' },
    });
  }

  async getLeaveRuleByType(orgId: number, leaveType: LeaveType): Promise<LeaveRule> {
    const rule = await this.leaveRuleRepository.findOne({
      where: {
        organization: { orgId: orgId },
        leaveType: leaveType as any,
      },
      relations: ['organization'],
    });

    if (!rule) {
      throw new NotFoundException(`Leave rule for ${leaveType} not found`);
    }

    return rule;
  }

  async deleteLeaveRule(ruleId: number, orgId: number): Promise<void> {
    const leaveRule = await this.leaveRuleRepository.findOne({
      where: { id: ruleId },
      relations: ['organization'],
    });

    if (!leaveRule) {
      throw new NotFoundException('Leave rule not found');
    }

    if (leaveRule.organization.orgId !== orgId) {
      throw new BadRequestException('Leave rule does not belong to your organization');
    }

    await this.leaveRuleRepository.remove(leaveRule);
  }

  async initializeDefaultRules(orgId: number, location: 'India' | 'Qatar'): Promise<LeaveRule[]> {
    const organization = await this.organizationRepository.findOne({
      where: { orgId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const defaultRules = this.getDefaultRulesByLocation(location);
    const createdRules: LeaveRule[] = [];

    for (const ruleData of defaultRules) {
      // Check if rule already exists
      const existing = await this.leaveRuleRepository.findOne({
        where: {
          organization: { orgId },
          leaveType: ruleData.leaveType as any,
        },
      });

      if (!existing) {
        const rule = this.leaveRuleRepository.create({
          organization,
          ...ruleData,
        });
        createdRules.push(await this.leaveRuleRepository.save(rule));
      }
    }

    return createdRules;
  }

 private getDefaultRulesByLocation(location: 'India' | 'Qatar') {
  type LeaveRule = {
    leaveType: LeaveType;
    maxAllowed: number;
    carryForwardMax: number;
    accrualRate: number;
    isActive: boolean;
    minTenureMonths: number;
    requiresDocument?: boolean;
    applicableGender?: Gender;  // Add this here
  };

  const baseRules: LeaveRule[] = [
      {
        leaveType: LeaveType.ANNUAL,
        maxAllowed: 11,
        carryForwardMax: 10,
        accrualRate: 0.92,
        isActive: true,
        minTenureMonths: 0,
      },
      {
        leaveType: LeaveType.CASUAL,
        maxAllowed: 11,
        carryForwardMax: 0,
        accrualRate: 0.92,
        isActive: true,
        minTenureMonths: 0,
      },
      {
        leaveType: LeaveType.SICK,
        maxAllowed: 2,
        carryForwardMax: 0,
        accrualRate: 0.17,
        isActive: true,
        minTenureMonths: 0,
      },
      {
        leaveType: LeaveType.EMERGENCY,
        maxAllowed: 3,
        carryForwardMax: 0,
        accrualRate: 0.25,
        isActive: true,
        minTenureMonths: 0,
        requiresDocument: true,
      },
      {
        leaveType: LeaveType.LOSSOFPAY,
        maxAllowed: 365,
        carryForwardMax: 0,
        accrualRate: 0,
        isActive: true,
        minTenureMonths: 0,
      },
    ];

    if (location === 'India') {
      baseRules.push({
        leaveType: LeaveType.MATERNITY,
        maxAllowed: 182, // 26 weeks
        carryForwardMax: 0,
        accrualRate: 0,
        isActive: true,
        minTenureMonths: 0,
        applicableGender: Gender.FEMALE

      });
    } else {
      baseRules.push({
        leaveType: LeaveType.MATERNITY,
        maxAllowed: 50,
        carryForwardMax: 0,
        accrualRate: 0,
        isActive: true,
        minTenureMonths: 0,
        applicableGender: Gender.FEMALE,

      });
    }

    return baseRules;
  }

  private getLeaveTypeDefaults(leaveType: LeaveType) {
    const defaults = {
      [LeaveType.ANNUAL]: { carryForwardMax: 10 },
      [LeaveType.CASUAL]: { carryForwardMax: 0 },
      [LeaveType.SICK]: { carryForwardMax: 0 },
      [LeaveType.EMERGENCY]: { carryForwardMax: 0 },
      [LeaveType.MATERNITY]: { carryForwardMax: 0 },
      [LeaveType.LOSSOFPAY]: { carryForwardMax: 0 },
    };

    return defaults[leaveType];
  }
}