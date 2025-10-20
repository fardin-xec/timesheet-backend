import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personal } from '../entities/personal.entity';
import { PersonalService } from './personal.service';
import { PersonalController } from './personal.controller';
import { BankInfo } from 'src/entities/bank-info.entity';
import { Document } from 'src/entities/document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Personal,
      Document,
      BankInfo,
    ])
  ],
  controllers: [PersonalController],
  providers: [PersonalService],
  exports: [PersonalService],
})
export class PersonalModule {}