import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from '../entities/document.entity';
import { PersonalModule } from 'src/personal/personal.module';

@Module({
  imports: [TypeOrmModule.forFeature([Document]),
  forwardRef(() => PersonalModule)
  
],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}