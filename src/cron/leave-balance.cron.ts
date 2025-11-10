// src/cron/leave-balance.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LeaveBalances } from '../entities/leave-balance.entity';
import { Employee, EmployeeStatus } from '../entities/employees.entity';
import { LeaveRule } from '../entities/leave-rule.entity';
import { EmployeeLeaveRule } from '../entities/employee-leave-rule.entity';
import { LeaveType } from '../entities/leave.entity';

@Injectable()
export class LeaveBalanceCronService {
  private readonly logger = new Logger(LeaveBalanceCronService.name);
  private readonly MAX_ANNUAL_CARRYFORWARD = 10;

  constructor(
    @InjectRepository(LeaveBalances)
    private leaveBalanceRepository: Repository<LeaveBalances>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(LeaveRule)
    private leaveRuleRepository: Repository<LeaveRule>,
    @InjectRepository(EmployeeLeaveRule)
    private employeeLeaveRuleRepository: Repository<EmployeeLeaveRule>,
  ) {}

  /**
   * Runs every year on January 1st at 00:01 AM
   * Cron format: second minute hour day month dayOfWeek
   */
  @Cron('0 7 20 * * *', {
    name: 'annual-leave-balance-update',
    timeZone: 'Asia/Kolkata',
  })
  async handleAnnualLeaveBalanceUpdate() {
    console.log('Starting annual leave balance update...');
    
    try {
      const currentYear = 2027;
      const previousYear = currentYear - 1;

      // Get all active employees
      const activeEmployees = await this.employeeRepository.find({
        where: { 
          status: In([EmployeeStatus.ACTIVE, EmployeeStatus.ON_LEAVE]) 
        },
        relations: ['organization'],
      });

      console.log(`Found ${activeEmployees.length} active employees to process`);

      let successCount = 0;
      let errorCount = 0;

      for (const employee of activeEmployees) {
        try {
          await this.processEmployeeLeaveBalance(employee, currentYear, previousYear);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(
            `Error processing leave balance for employee ${employee.id} (${employee.employeeId}): ${error.message}`,
            error.stack
          );
        }
      }

      console.log(
        `Annual leave balance update completed. Success: ${successCount}, Errors: ${errorCount}`
      );

      // Optional: Archive old leave balances (older than 3 years)
      await this.archiveOldLeaveBalances(currentYear - 3);

    } catch (error) {
      console.error(
        `Critical error in annual leave balance update: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Manual trigger for testing or administrative purposes
   */
  async manualLeaveBalanceUpdate(year?: number): Promise<{
    success: number;
    errors: number;
    details: string[];
  }> {
    const currentYear = year || new Date().getFullYear();
    const previousYear = currentYear - 1;

    console.log(`Manual leave balance update triggered for year ${currentYear}`);

    const activeEmployees = await this.employeeRepository.find({
      where: { 
        status: In([EmployeeStatus.ACTIVE, EmployeeStatus.ON_LEAVE]) 
      },
      relations: ['organization'],
    });

    const results = {
      success: 0,
      errors: 0,
      details: [] as string[],
    };

    for (const employee of activeEmployees) {
      try {
        await this.processEmployeeLeaveBalance(employee, currentYear, previousYear);
        results.success++;
        results.details.push(
          `✓ Employee ${employee.employeeId}: Leave balances updated successfully`
        );
      } catch (error) {
        results.errors++;
        results.details.push(
          `✗ Employee ${employee.employeeId}: ${error.message}`
        );
      }
    }

    return results;
  }

  /**
   * Process leave balance for a single employee
   */
  private async processEmployeeLeaveBalance(
    employee: Employee,
    currentYear: number,
    previousYear: number
  ): Promise<void> {
    // Get all leave rules assigned to this employee
    const employeeLeaveRules = await this.employeeLeaveRuleRepository.find({
      where: { employee: { id: employee.id } },
      relations: ['rule'],
    });

    // If no specific rules assigned, get organization-wide active rules
    let leaveRulesToProcess: LeaveRule[] = [];

    if (employeeLeaveRules.length > 0) {
      leaveRulesToProcess = employeeLeaveRules.map(elr => elr.rule).filter(rule => rule.isActive);
    } else {
      leaveRulesToProcess = await this.leaveRuleRepository.find({
        where: {
          organization: { orgId: employee.orgId },
          isActive: true,
        },
      });
    }

    // Filter rules based on gender and tenure
    const applicableRules = this.filterApplicableRules(leaveRulesToProcess, employee);

    // Get previous year's balances
    const previousBalances = await this.leaveBalanceRepository.find({
      where: {
        employee: { id: employee.id },
        year: previousYear,
      },
    });

    const previousBalanceMap = new Map(
      previousBalances.map(balance => [balance.leaveType, balance])
    );

    // Process each applicable leave rule
    for (const rule of applicableRules) {
      await this.createOrUpdateLeaveBalance(
        employee,
        rule,
        currentYear,
        previousBalanceMap.get(rule.leaveType)
      );
    }

    console.debug(
      `Processed ${applicableRules.length} leave types for employee ${employee.employeeId}`
    );
  }

  /**
   * Filter leave rules based on employee's gender and tenure
   */
  private filterApplicableRules(rules: LeaveRule[], employee: Employee): LeaveRule[] {
    const tenureMonths = this.calculateTenureMonths(employee.joiningDate);

    return rules.filter(rule => {
      // Check gender eligibility
      if (rule.applicableGender && rule.applicableGender !== employee.gender) {
        return false;
      }

      // Check tenure eligibility
      if (tenureMonths < rule.minTenureMonths) {
        return false;
      }

      // Special handling for maternity leave
      if (rule.leaveType === LeaveType.MATERNITY && employee.gender !== 'female') {
        return false;
      }

      return true;
    });
  }

  /**
   * Create or update leave balance for the new year
   * 
   * IMPORTANT: For Annual Leave, unused leaves (max 10) are ADDED to totalAllowed
   * Example: 
   * - Rule maxAllowed: 20 days
   * - Previous year unused: 8 days
   * - New year totalAllowed: 20 + 8 = 28 days
   * - carryForwarded field: 8 (for tracking purposes)
   * 
   * If unused > 10:
   * - Rule maxAllowed: 20 days
   * - Previous year unused: 15 days
   * - New year totalAllowed: 20 + 10 = 30 days (capped at 10)
   * - carryForwarded field: 10 (for tracking purposes)
   */
 /**
 * Create or update leave balance for the new year
 * 
 * CORRECTED LOGIC FOR ANNUAL LEAVE:
 * - Check previous year's carryForwarded field (not unused leaves)
 * - If carryForwarded < 10: Add that amount to new year's totalAllowed
 * - If carryForwarded >= 10: Add only 10 to new year's totalAllowed
 * 
 * Example 1: Previous carryForwarded = 8 days
 * - Rule maxAllowed: 20 days
 * - Previous carryForwarded: 8 days
 * - New year totalAllowed: 20 + 8 = 28 days
 * - New carryForwarded: 8
 * 
 * Example 2: Previous carryForwarded = 15 days
 * - Rule maxAllowed: 20 days
 * - Previous carryForwarded: 15 days (but capped at 10)
 * - New year totalAllowed: 20 + 10 = 30 days
 * - New carryForwarded: 10
 */
private async createOrUpdateLeaveBalance(
  employee: Employee,
  rule: LeaveRule,
  currentYear: number,
  previousBalance?: LeaveBalances
): Promise<void> {
  // Check if balance already exists for current year
  let currentBalance = await this.leaveBalanceRepository.findOne({
    where: {
      employee: { id: employee.id },
      leaveType: rule.leaveType,
      year: currentYear,
    },
  });

  // Get the base max allowed from rule or custom assignment
  const customMaxAllowed = await this.getCustomMaxAllowed(employee.id, rule.id);
  const baseMaxAllowed = customMaxAllowed !== null ? customMaxAllowed : parseFloat(rule.maxAllowed.toString());

  // Calculate carry forward amount and new total allowed
  let carryForward = 0;
  let totalAllowed = baseMaxAllowed;

  if (rule.leaveType === LeaveType.ANNUAL && previousBalance) {
    // Calculate unused leaves from previous year
    const previousTotalAllowed = parseFloat(previousBalance.totalAllowed.toString());
    const previousUsed = parseFloat(previousBalance.used.toString());
    const unusedLeaves = previousTotalAllowed - previousUsed;
    
    // If unused <= 10: carry forward the exact amount
    // If unused > 10: carry forward only 10 (capped)
    if (unusedLeaves <= this.MAX_ANNUAL_CARRYFORWARD) {
      carryForward = Math.max(unusedLeaves, 0); // Ensure non-negative
    } else {
      carryForward = this.MAX_ANNUAL_CARRYFORWARD; // Cap at 10
    }
    
    // ADD carry forward to the base max allowed
    totalAllowed = baseMaxAllowed + carryForward;
    carryForward=10;

    console.log(
      `Employee ${employee.employeeId} Annual Leave Calculation:
      - Base Max Allowed: ${baseMaxAllowed}
      - Previous Year Total: ${previousTotalAllowed}
      - Previous Year Used: ${previousUsed}
      - Unused Leaves: ${unusedLeaves}
      - Carry Forward Applied (max 10): ${carryForward}
      - NEW Total Allowed: ${totalAllowed}`
    );
  }

  if (currentBalance) {
    // Update existing balance
    currentBalance.totalAllowed = totalAllowed;
    currentBalance.carryForwarded = carryForward;
    currentBalance.used = 0;
    currentBalance.pending = 0;
    
    await this.leaveBalanceRepository.save(currentBalance);
    
    console.log(
      `✓ Updated leave balance for employee ${employee.employeeId}, ` +
      `type: ${rule.leaveType}, totalAllowed: ${totalAllowed}, carryForward: ${carryForward}`
    );
  } else {
    // Create new balance
    const newBalance = this.leaveBalanceRepository.create({
      employee: { id: employee.id },
      leaveType: rule.leaveType,
      year: currentYear,
      totalAllowed: totalAllowed,
      used: 0,
      carryForwarded: carryForward,
      pending: 0,
    });

    await this.leaveBalanceRepository.save(newBalance);
    
    console.log(
      `✓ Created new leave balance for employee ${employee.employeeId}, ` +
      `type: ${rule.leaveType}, totalAllowed: ${totalAllowed}, carryForward: ${carryForward}`
    );
  }
}

  /**
   * Get custom max allowed for employee if exists
   */
  private async getCustomMaxAllowed(employeeId: number, ruleId: number): Promise<number | null> {
    const employeeLeaveRule = await this.employeeLeaveRuleRepository.findOne({
      where: {
        employee: { id: employeeId },
        rule: { id: ruleId },
      },
    });

    return employeeLeaveRule?.customMaxAllowed 
      ? parseFloat(employeeLeaveRule.customMaxAllowed.toString()) 
      : null;
  }

  /**
   * Calculate employee tenure in months
   */
  private calculateTenureMonths(joiningDate: Date | string): number {
    const today = new Date();
    const joinDate = typeof joiningDate === 'string' 
      ? new Date(joiningDate) 
      : joiningDate;
    
    if (isNaN(joinDate.getTime())) {
      console.warn('Invalid joining date, returning 0 tenure');
      return 0;
    }
    
    const months =
      (today.getFullYear() - joinDate.getFullYear()) * 12 +
      (today.getMonth() - joinDate.getMonth());
    
    return Math.max(months, 0);
  }

  /**
   * Archive or delete old leave balances
   */
  private async archiveOldLeaveBalances(cutoffYear: number): Promise<void> {
    try {
      const result = await this.leaveBalanceRepository
        .createQueryBuilder()
        .delete()
        .where('year < :cutoffYear', { cutoffYear })
        .execute();

      console.log(
        `Archived/deleted ${result.affected} leave balance records older than year ${cutoffYear}`
      );
    } catch (error) {
      console.error(
        `Error archiving old leave balances: ${error.message}`,
        error.stack
      );
    }
  }

  /**
   * Get summary of leave balances for a specific year
   */
  async getLeaveBalanceSummary(year: number): Promise<{
    totalEmployees: number;
    totalBalances: number;
    byLeaveType: Record<string, number>;
    totalCarryForward: number;
    averageAnnualLeaveAllowed: number;
  }> {
    const balances = await this.leaveBalanceRepository.find({
      where: { year },
      relations: ['employee'],
    });

    const summary = {
      totalEmployees: new Set(balances.map(b => b.employee.id)).size,
      totalBalances: balances.length,
      byLeaveType: {} as Record<string, number>,
      totalCarryForward: 0,
      averageAnnualLeaveAllowed: 0,
    };

    let annualLeaveCount = 0;
    let totalAnnualAllowed = 0;

    for (const balance of balances) {
      const leaveType = balance.leaveType;
      summary.byLeaveType[leaveType] = (summary.byLeaveType[leaveType] || 0) + 1;
      summary.totalCarryForward += parseFloat(balance.carryForwarded.toString());

      if (leaveType === LeaveType.ANNUAL) {
        annualLeaveCount++;
        totalAnnualAllowed += parseFloat(balance.totalAllowed.toString());
      }
    }

    summary.averageAnnualLeaveAllowed = annualLeaveCount > 0 
      ? totalAnnualAllowed / annualLeaveCount 
      : 0;

    return summary;
  }

  /**
   * Get detailed carry-forward report for all employees
   */
  async getCarryForwardReport(year: number): Promise<Array<{
    employeeId: string;
    employeeName: string;
    previousYearTotal: number;
    previousYearUsed: number;
    unused: number;
    carriedForward: number;
    newYearTotal: number;
  }>> {
    const previousYear = year - 1;
    
    const currentBalances = await this.leaveBalanceRepository.find({
      where: { 
        year,
        leaveType: LeaveType.ANNUAL 
      },
      relations: ['employee'],
    });

    const report = [];

    for (const currentBalance of currentBalances) {
      const previousBalance = await this.leaveBalanceRepository.findOne({
        where: {
          employee: { id: currentBalance.employee.id },
          leaveType: LeaveType.ANNUAL,
          year: previousYear,
        },
      });

      if (previousBalance) {
        const previousTotal = parseFloat(previousBalance.totalAllowed.toString());
        const previousUsed = parseFloat(previousBalance.used.toString());
        const unused = previousTotal - previousUsed;

        report.push({
          employeeId: currentBalance.employee.employeeId,
          employeeName: `${currentBalance.employee.firstName} ${currentBalance.employee.lastName}`,
          previousYearTotal: previousTotal,
          previousYearUsed: previousUsed,
          unused: unused,
          carriedForward: parseFloat(currentBalance.carryForwarded.toString()),
          newYearTotal: parseFloat(currentBalance.totalAllowed.toString()),
        });
      }
    }

    return report;
  }
}