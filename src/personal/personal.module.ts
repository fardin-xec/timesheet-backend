import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personal } from '../entities/personal.entity';
import { PersonalService } from './personal.service';
import { PersonalController } from './personal.controller';
import { BankInfo } from 'src/entities/bank-info.entity';
import { Document } from 'src/entities/document.entity';
import { Employee } from 'src/entities/employees.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Personal,
      Document,
      BankInfo,
      Employee,
    ])
  ],
  controllers: [PersonalController],
  providers: [PersonalService],
  exports: [PersonalService],
})
export class PersonalModule {}