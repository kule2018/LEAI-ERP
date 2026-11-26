import { Global, Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor'
import { RedisModule } from './common/redis.module'
import { RealtimeModule } from './common/realtime/realtime.module'
import { AppLoggerService } from './common/observability/app-logger.service'
import { env } from './config/env'
import { AiModule } from './modules/ai/ai.module'
import { AlertModule } from './modules/alert/alert.module'
import { AuditModule } from './modules/audit/audit.module'
import { AuthModule } from './modules/auth/auth.module'
import { CollaborationModule } from './modules/collaboration/collaboration.module'
import { ConfigModule } from './modules/config/config.module'
import { CurrencyModule } from './modules/currency/currency.module'
import { CustomFieldModule } from './modules/customization/custom-field.module'
import { DataScopeModule } from './modules/data-scope/data-scope.module'
import { DictModule } from './modules/dict/dict.module'
import { DocsModule } from './modules/docs/docs.module'
import { DomainEventModule } from './modules/events/domain-event.module'
import { FeatureModule } from './modules/feature/feature.module'
import { FileModule } from './modules/file/file.module'
import { FinanceModule } from './modules/finance/finance.module'
import { ExportTaskModule } from './modules/export-task/export-task.module'
import { IntegrationModule } from './modules/integration/integration.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { IoModule } from './modules/io/io.module'
import { ManufacturingModule } from './modules/manufacturing/manufacturing.module'
import { MasterDataModule } from './modules/master-data/master-data.module'
import { NotifyModule } from './modules/notify/notify.module'
import { OpenApiModule } from './modules/openapi/openapi.module'
import { OpsModule } from './modules/ops/ops.module'
import { PlatformModule } from './modules/platform/platform.module'
import { ProcurementAdviceModule } from './modules/procurement-advice/procurement-advice.module'
import { PrintModule } from './modules/print/print.module'
import { PurchaseModule } from './modules/purchase/purchase.module'
import { RevisionModule } from './modules/revision/revision.module'
import { RiskModule } from './modules/risk/risk.module'
import { SalesModule } from './modules/sales/sales.module'
import { SequenceModule } from './modules/sequence/sequence.module'
import { ShopModule } from './modules/shop/shop.module'
import { SystemModule } from './modules/system/system.module'
import { SystemBackupModule } from './modules/system-backup/system-backup.module'
import { SystemLangModule } from './modules/system-lang/system-lang.module'
import { UserPreferenceModule } from './modules/user-preference/user-preference.module'
import { WorkbenchModule } from './modules/workbench/workbench.module'

@Global()
@Module({
  imports: [JwtModule.register({})],
  exports: [JwtModule]
})
class GlobalJwtModule {}

@Module({
  imports: [
    GlobalJwtModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: env.db.host,
      port: env.db.port,
      username: env.db.username,
      password: env.db.password,
      database: env.db.database,
      autoLoadEntities: true,
      synchronize: false,
      charset: 'utf8mb4',
      timezone: '+08:00',
      logging: env.nodeEnv === 'development' ? ['error', 'warn'] : ['error']
    }),
    RedisModule,
    RealtimeModule,
    ConfigModule,
    PlatformModule,
    AuditModule,
    CollaborationModule,
    CurrencyModule,
    DataScopeModule,
    DomainEventModule,
    DictModule,
    DocsModule,
    FeatureModule,
    SequenceModule,
    NotifyModule,
    OpsModule,
    OpenApiModule,
    AlertModule,
    CustomFieldModule,
    RevisionModule,
    UserPreferenceModule,
    FileModule,
    FinanceModule,
    MasterDataModule,
    ManufacturingModule,
    InventoryModule,
    IoModule,
    ExportTaskModule,
    IntegrationModule,
    PrintModule,
    ProcurementAdviceModule,
    PurchaseModule,
    RiskModule,
    SalesModule,
    ShopModule,
    SystemModule,
    SystemBackupModule,
    SystemLangModule,
    WorkbenchModule,
    AiModule,
    AuthModule
  ],
  providers: [
    AppLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor
    }
  ]
})
export class AppModule {}
