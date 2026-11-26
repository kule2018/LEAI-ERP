import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { FeatureController } from './feature.controller'
import { FeatureService } from './feature.service'
import { FeatureFlagEntity } from './entities/feature-flag.entity'
import { FeatureGuard } from './guards/feature.guard'

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([FeatureFlagEntity, TenantEntity]),
    AuditModule
  ],
  controllers: [FeatureController],
  providers: [FeatureService, FeatureGuard],
  exports: [FeatureService, FeatureGuard]
})
export class FeatureModule {}
