import { Global, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigService } from './config.service'
import { SystemConfigEntity } from './entities/system-config.entity'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemConfigEntity])],
  providers: [ConfigService],
  exports: [ConfigService]
})
export class ConfigModule {}
