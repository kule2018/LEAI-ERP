import { Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { QueryFileDto } from './dto'
import { FileService, type UploadedFileInput } from './file.service'

@Controller('system/file')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class FileController {
  constructor(private readonly service: FileService) {}

  @Get()
  @RequirePerm('system:file:view')
  list(@Query() query: QueryFileDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  @Post('upload')
  @RequirePerm('system:file:upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 52428800 } }))
  upload(@UploadedFile() file: UploadedFileInput | undefined, @CurrentUser() user: JwtUser) {
    return this.service.upload(file, user)
  }

  /** 下载/预览：返回带时效的存储地址，MinIO/OSS 为签名 URL */
  @Get(':id/signed-url')
  @RequirePerm('system:file:view')
  signedUrl(
    @Param('id', ParseIntPipe) id: number,
    @Query('expires') expires: string | undefined,
    @CurrentUser() user: JwtUser
  ) {
    const parsed = Number(expires)
    return this.service.signedUrl(id, user, Number.isFinite(parsed) && parsed > 0 ? parsed : 900)
  }
}
