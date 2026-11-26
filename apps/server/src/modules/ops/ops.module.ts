import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RateLimitInterceptor } from '../../common/interceptors/rate-limit.interceptor'
import { AuditModule } from '../audit/audit.module'
import { SysSecurityAlertEntity } from './entities/security-alert.entity'
import { SysSlowSqlLogEntity } from './entities/slow-sql-log.entity'
import { MetricsInterceptor } from './metrics.interceptor'
import { MetricsService } from './metrics.service'
import { OpsController } from './ops.controller'
import { SchedulerController } from './scheduler.controller'
import { SchedulerService } from './scheduler.service'
import { SecurityGuardService } from './security-guard.service'
import { SlowSqlInterceptor } from './slow-sql.interceptor'

@Module({
  imports: [TypeOrmModule.forFeature([SysSecurityAlertEntity, SysSlowSqlLogEntity]), AuditModule],
  controllers: [OpsController, SchedulerController],
  providers: [
    MetricsService,
    SchedulerService,
    SecurityGuardService,
    SlowSqlInterceptor,
    RateLimitInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor
    }
  ],
  exports: [MetricsService, SchedulerService, SecurityGuardService]
})
export class OpsModule {}
