import { Global, Module } from '@nestjs/common'
import { RealtimeService } from './websocket.gateway'

@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService]
})
export class RealtimeModule {}
