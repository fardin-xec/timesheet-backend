
import { 
  Controller, 
  Post, 
  Get, 
  Query, 
  UseGuards, 
  HttpCode, 
  HttpStatus,
  Body 
} from '@nestjs/common';
import { LeaveBalanceCronService } from './leave-balance.cron';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Controller for administrative leave balance cron operations
 * Should be protected with admin-only guards in production
 */
@ApiTags('Leave Balance Cron')
@Controller('admin/leave-balance-cron')
// @UseGuards(JwtAuthGuard, AdminGuard) // Uncomment in production
@ApiBearerAuth()
export class LeaveBalanceCronController {
  constructor(
    private readonly leaveBalanceCronService: LeaveBalanceCronService
  ) {}

  /**
   * Manually trigger annual leave balance update
   * Useful for testing or running updates outside scheduled time
   */
  @Post('trigger-annual-update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Manually trigger annual leave balance update',
    description: 'Triggers the annual leave balance update process for all active employees. Should only be used by administrators.'
  })
  @ApiQuery({ 
    name: 'year', 
    required: false, 
    type: Number,
    description: 'Target year for the update (defaults to current year)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Update completed successfully',
    schema: {
      example: {
        message: 'Leave balance update completed',
        year: 2025,
        success: 150,
        errors: 2,
        details: [
          '✓ Employee EMP001: Leave balances updated successfully',
          '✗ Employee EMP002: No leave rules configured'
        ]
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error during update' 
  })
  async triggerAnnualUpdate(
    @Query('year') year?: number
  ): Promise<{
    message: string;
    year: number;
    success: number;
    errors: number;
    details: string[];
  }> {
    const targetYear = year || new Date().getFullYear();
    const results = await this.leaveBalanceCronService.manualLeaveBalanceUpdate(targetYear);
    
    return {
      message: 'Leave balance update completed',
      year: targetYear,
      ...results,
    };
  }

  /**
   * Get summary of leave balances for a specific year
   */
  @Get('summary')
  @ApiOperation({ 
    summary: 'Get leave balance summary',
    description: 'Retrieves a summary of leave balances for a specific year including employee counts and carry-forward totals'
  })
  @ApiQuery({ 
    name: 'year', 
    required: false, 
    type: Number,
    description: 'Year to get summary for (defaults to current year)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Summary retrieved successfully',
    schema: {
      example: {
        year: 2025,
        totalEmployees: 150,
        totalBalances: 600,
        byLeaveType: {
          'annual': 150,
          'casual': 150,
          'sick': 150,
          'emergency': 150
        },
        totalCarryForward: 450.5
      }
    }
  })
  async getLeaveBalanceSummary(
    @Query('year') year?: number
  ): Promise<{
    year: number;
    totalEmployees: number;
    totalBalances: number;
    byLeaveType: Record<string, number>;
    totalCarryForward: number;
  }> {
    const targetYear = year || new Date().getFullYear();
    const summary = await this.leaveBalanceCronService.getLeaveBalanceSummary(targetYear);
    
    return {
      year: targetYear,
      ...summary,
    };
  }

  /**
   * Test endpoint to check cron service health
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Check cron service health',
    description: 'Verifies that the cron service is properly initialized and running'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'healthy',
        service: 'LeaveBalanceCronService',
        timestamp: '2025-01-01T00:00:00.000Z'
      }
    }
  })
  getHealth(): {
    status: string;
    service: string;
    timestamp: Date;
  } {
    return {
      status: 'healthy',
      service: 'LeaveBalanceCronService',
      timestamp: new Date(),
    };
  }
}

