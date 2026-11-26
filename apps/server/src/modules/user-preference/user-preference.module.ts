import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { QuickSearchLogEntity } from './entities/quick-search-log.entity'
import { UserDraftEntity } from './entities/user-draft.entity'
import { UserFavoriteEntity } from './entities/user-favorite.entity'
import { UserViewConfigEntity } from './entities/user-view-config.entity'
import { UserPreferenceController } from './user-preference.controller'
import { UserPreferenceService } from './user-preference.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([UserViewConfigEntity, UserFavoriteEntity, QuickSearchLogEntity, UserDraftEntity]),
    AuditModule
  ],
  controllers: [UserPreferenceController],
  providers: [UserPreferenceService],
  exports: [UserPreferenceService]
})
export class UserPreferenceModule {}
