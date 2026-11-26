import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AiProcurementAdviceEntity } from './entities/procurement-advice.entity'
import { ProcurementAdviceController } from './procurement-advice.controller'
import { ProcurementAdviceService } from './procurement-advice.service'

@Module({
  imports: [TypeOrmModule.forFeature([AiProcurementAdviceEntity])],
  controllers: [ProcurementAdviceController],
  providers: [ProcurementAdviceService],
  exports: [ProcurementAdviceService, TypeOrmModule]
})
export class ProcurementAdviceModule {}
