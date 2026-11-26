import type { NestExpressApplication } from '@nestjs/platform-express'

declare const require: (id: string) => any

/** 动态挂载 Swagger UI；依赖未安装时降级到已有 /docs/api 静态清单 */
export async function setupOpenApi(app: NestExpressApplication): Promise<boolean> {
  try {
    const swagger = require('@nestjs/swagger')
    const ui = require('swagger-ui-express')
    const document = swagger.SwaggerModule.createDocument(
      app,
      new swagger.DocumentBuilder()
        .setTitle('LEAI ERP API')
        .setDescription('LEAI ERP 接口文档（Bearer Token 鉴权）')
        .setVersion('1.0')
        .addBearerAuth()
        .build()
    )
    app.use('/api/docs', ui.serve, ui.setup(document, { swaggerOptions: { persistAuthorization: true } }))
    return true
  } catch {
    return false
  }
}
