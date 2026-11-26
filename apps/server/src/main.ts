import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { AppLoggerService } from './common/observability/app-logger.service'
import { setupOpenApi } from './common/openapi/swagger.setup'
import { attachWebSocketGateway, RealtimeService } from './common/realtime/websocket.gateway'
import { env } from './config/env'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.useLogger(app.get(AppLoggerService))

  app.useStaticAssets(env.storage.localRoot, { prefix: '/uploads/' })
  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: true, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  )
  app.useGlobalFilters(new AllExceptionsFilter())
  app.useGlobalInterceptors(new ResponseInterceptor())

  const swaggerEnabled = await setupOpenApi(app)
  if (!swaggerEnabled) {
    app.get(AppLoggerService).warn('Swagger 依赖未安装，继续使用 /docs/api 静态端点清单')
  }

  await app.listen(env.port)
  attachWebSocketGateway(app.getHttpServer(), app.get(RealtimeService), app.get(JwtService))
  app.get(AppLoggerService).log(`HTTP API 与 WebSocket(${env.websocket.path}) 已启动`)
}

void bootstrap()
