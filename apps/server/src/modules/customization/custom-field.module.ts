import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { CustomFieldController } from './custom-field.controller'
import { CustomFieldService } from './custom-field.service'
import { CustomFieldEntity } from './entities/custom-field.entity'
import { CustomFieldValueEntity } from './entities/custom-field-value.entity'
import { CustomFormEntity } from './entities/custom-form.entity'

@Module({
  imports: [TypeOrmModule.forFeature([CustomFieldEntity, CustomFormEntity, CustomFieldValueEntity]), AuditModule],
  controllers: [CustomFieldController],
  providers: [CustomFieldService],
  exports: [CustomFieldService]
})
export class CustomFieldModule {}
