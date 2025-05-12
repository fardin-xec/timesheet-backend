import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Personal } from '../entities/personal.entity';
import { PersonalService } from './personal.service';
import { PersonalController } from './personal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Personal]),
  ],
  controllers: [PersonalController],
  providers: [PersonalService],
  exports: [PersonalService],
})
export class PersonalModule {}