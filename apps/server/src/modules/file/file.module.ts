import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ObjectStorageService } from '../../common/object-storage.service'
import { AuditModule } from '../audit/audit.module'
import { FileController } from './file.controller'
import { FileService } from './file.service'
import { FileEntity } from './entities/file.entity'

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity]), AuditModule],
  controllers: [FileController],
  providers: [FileService, ObjectStorageService],
  exports: [FileService, ObjectStorageService, TypeOrmModule]
})
export class FileModule {}
