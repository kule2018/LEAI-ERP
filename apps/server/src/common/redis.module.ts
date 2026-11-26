import { Global, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { env } from '../config/env'

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: () =>
        new Redis({
          host: env.redis.host,
          port: env.redis.port,
          password: env.redis.password,
          lazyConnect: false,
          maxRetriesPerRequest: 2
        })
    }
  ],
  exports: ['REDIS_CLIENT']
})
export class RedisModule {}
