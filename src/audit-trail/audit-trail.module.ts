import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrail } from 'src/entities/audit-trail.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditTrail])],
  providers: [AuditTrailService],
  exports: [AuditTrailService],
})
export class AuditTrailModule {}