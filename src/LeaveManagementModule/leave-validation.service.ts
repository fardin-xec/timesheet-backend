import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Holiday } from '../entities/holiday.entity';
import { LeaveDateValidationDto } from './dto/create-leave.dto';

@Injectable()
export class LeaveValidationService {
  constructor(
    @InjectRepository(Holiday)
    private holidayRepository: Repository<Holiday>,
  ) {}

  /**
   * Check if leave dates are valid (not sandwiching weekends/holidays)
   * Organization weekends: Friday and Saturday
   */
  async validateLeaveDates(
    startDate: Date,
    endDate: Date,
    orgId: number,
  ): Promise<LeaveDateValidationDto> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Get all holidays in the date range (including buffer for sandwich check)
    const bufferStart = this.addDays(start, -5);
    const bufferEnd = this.addDays(end, 5);
    
    const holidays = await this.holidayRepository.find({
      where: {
        orgId,
        date: Between(bufferStart, bufferEnd),
      },
    });

    const holidayDatesMap = new Map<string, string>();
    holidays.forEach(holiday => {
      const dateKey = this.formatDateKey(new Date(holiday.date));
      holidayDatesMap.set(dateKey, holiday.name);
    });

    // Check for weekends and holidays within the leave period
    const weekendDates: Date[] = [];
    const holidayDates: { date: Date; name: string }[] = [];
    const leaveDates: Date[] = [];

    let currentDate = new Date(start);
    while (currentDate <= end) {
      leaveDates.push(new Date(currentDate));
      
      if (this.isWeekend(currentDate)) {
        weekendDates.push(new Date(currentDate));
      }
      
      const dateKey = this.formatDateKey(currentDate);
      if (holidayDatesMap.has(dateKey)) {
        holidayDates.push({
          date: new Date(currentDate),
          name: holidayDatesMap.get(dateKey),
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Check for sandwiching
    const sandwichCheck = this.checkSandwiching(
      start,
      end,
      holidayDatesMap,
    );

    const hasWeekends = weekendDates.length > 0;
    const hasHolidays = holidayDates.length > 0;
    const isSandwiching = sandwichCheck.isSandwiching;

    let isValid = true;
    let message = 'Leave dates are valid';

    if (isSandwiching) {
      isValid = true;
      message = 'Leave dates are valid)';
    } else if (hasHolidays||hasWeekends) {
      isValid = false;
      message = 'Leave dates include organization holidays or weekend days (Friday/Saturday)';
    } 

    return {
      isValid,
      message,
      details: {
        hasWeekends,
        hasHolidays,
        isSandwiching,
        weekendDates: hasWeekends ? weekendDates : undefined,
        holidayDates: hasHolidays ? holidayDates : undefined,
        sandwichingDates: isSandwiching ? sandwichCheck.sandwichingDates : undefined,
      },
    };
  }

  /**
   * Check if dates are sandwiching weekends or holidays
   * Sandwiching means: leave dates surround weekend/holiday but don't include them
   */
//   private checkSandwiching(
//     startDate: Date,
//     endDate: Date,
//     holidayDatesMap: Map<string, string>,
//   ): { isSandwiching: boolean; sandwichingDates: Date[] } {
//     const sandwichingDates: Date[] = [];
    
//     // Check dates between start and end (but after leave period)
//     let currentDate = this.addDays(endDate, 1);
//     const maxCheckDate = this.addDays(endDate, 5);
    
//     let consecutiveNonWorkingDays: Date[] = [];
    
//     while (currentDate <= maxCheckDate) {
//       const isWeekend = this.isWeekend(currentDate);
//       const isHoliday = holidayDatesMap.has(this.formatDateKey(currentDate));
      
//       if (isWeekend || isHoliday) {
//         consecutiveNonWorkingDays.push(new Date(currentDate));
//       } else {
//         // Hit a working day after non-working days
//         if (consecutiveNonWorkingDays.length > 0) {
//           // This means leave ends just before weekend/holiday
//           sandwichingDates.push(...consecutiveNonWorkingDays);
//           break;
//         }
//       }
      
//       currentDate.setDate(currentDate.getDate() + 1);
//     }
    
//     // Check dates before start (but before leave period)
//     currentDate = this.addDays(startDate, -1);
//     const minCheckDate = this.addDays(startDate, -5);
    
//     consecutiveNonWorkingDays = [];
    
//     while (currentDate >= minCheckDate) {
//       const isWeekend = this.isWeekend(currentDate);
//       const isHoliday = holidayDatesMap.has(this.formatDateKey(currentDate));
      
//       if (isWeekend || isHoliday) {
//         consecutiveNonWorkingDays.unshift(new Date(currentDate));
//       } else {
//         // Hit a working day before non-working days
//         if (consecutiveNonWorkingDays.length > 0) {
//           // This means leave starts just after weekend/holiday
//           sandwichingDates.unshift(...consecutiveNonWorkingDays);
//           break;
//         }
//       }
      
//       currentDate.setDate(currentDate.getDate() - 1);
//     }
    
//     return {
//       isSandwiching: sandwichingDates.length > 0,
//       sandwichingDates,
//     };
//   }
/**
 * Improved Sandwich Leave Check
 * If leave starts and ends on working days, include all intervening weekends/holidays as leave.
 */
private checkSandwiching(
    startDate: Date,
    endDate: Date,
    holidayDatesMap: Map<string, string>
): { isSandwiching: boolean, sandwichingDates: Date[] } {
    let sandwichingDates: Date[] = [];
    let currentDate = new Date(startDate);

    // Check if leave starts and ends on working days
    const isStartWorking = !this.isWeekend(currentDate) && !holidayDatesMap.has(this.formatDateKey(currentDate));
    const isEndWorking = !this.isWeekend(endDate) && !holidayDatesMap.has(this.formatDateKey(endDate));
    
    // Only sandwich if start/end are working days (not a weekend/holiday)
    if (isStartWorking && isEndWorking) {
        currentDate.setDate(currentDate.getDate() + 1); // move past start date
        while (currentDate < endDate) {
            if (this.isWeekend(currentDate) || holidayDatesMap.has(this.formatDateKey(currentDate))) {
                sandwichingDates.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return {
            isSandwiching: sandwichingDates.length > 0,
            sandwichingDates,
        };
    }

    return {
        isSandwiching: false,
        sandwichingDates: [],
    };
}

  /**
   * Check if a date is a weekend (Friday or Saturday)
   */
  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    // 5 = Friday, 6 = Saturday
    return day === 5 || day === 6;
  }

  /**
   * Format date as YYYY-MM-DD for comparison
   */
  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Add days to a date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Get all holidays for an organization and year
   */
  async getHolidays(orgId: number, year?: number): Promise<Holiday[]> {
    const whereClause: any = { orgId };
    
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      whereClause.date = Between(startDate, endDate);
    }
    
    return this.holidayRepository.find({
      where: whereClause,
      order: { date: 'ASC' },
    });
  }

  /**
   * Create a holiday
   */
  async createHoliday(
    orgId: number,
    name: string,
    date: Date,
    description?: string,
  ): Promise<Holiday> {
    const holiday = this.holidayRepository.create({
      orgId,
      name,
      date,
      description,
    });
    
    return this.holidayRepository.save(holiday);
  }

  /**
   * Delete a holiday
   */
  async deleteHoliday(holidayId: number, orgId: number): Promise<void> {
    await this.holidayRepository.delete({ id: holidayId, orgId });
  }
}
