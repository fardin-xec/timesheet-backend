import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DropdownService } from './dropdown.service';
import { DropdownController } from './dropdown.controller';
import { DropdownType } from '../entities/dropdown-types.entity';
import { DropdownValue } from '../entities/dropdown-values.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DropdownType, DropdownValue])],
  providers: [DropdownService],
  controllers: [DropdownController],
})
export class DropdownModule {}
