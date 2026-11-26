import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { SystemLangEntity } from './entities/system-lang.entity'
import { SystemLangController } from './system-lang.controller'
import { SystemLangService } from './system-lang.service'

@Module({
  imports: [TypeOrmModule.forFeature([SystemLangEntity]), AuditModule],
  controllers: [SystemLangController],
  providers: [SystemLangService]
})
export class SystemLangModule {}
