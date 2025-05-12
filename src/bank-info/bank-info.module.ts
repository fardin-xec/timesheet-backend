import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankInfo } from '../entities/bank-info.entity';
import { BankInfoService } from './bank-info.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BankInfo]),
  ],
  providers: [BankInfoService],
  exports: [BankInfoService],
})
export class BankInfoModule {}