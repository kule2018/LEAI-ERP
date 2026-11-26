import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CreateExportTaskDto, QueryExportTaskDto } from './dto'
import { ExportTaskService } from './export-task.service'

@Controller('system/export-task')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class ExportTaskController {
  constructor(private readonly service: ExportTaskService) {}

  /** 创建导出任务（异步） */
  @Post()
  @RequirePerm('system:io:export')
  create(@Body() dto: CreateExportTaskDto, @CurrentUser() user: JwtUser) {
    return this.service.create({ code: dto.code, bizType: dto.bizType, params: dto.params }, user)
  }

  /** 导出任务列表 */
  @Get()
  @RequirePerm('system:io:view')
  list(@Query() query: QueryExportTaskDto, @CurrentUser() user: JwtUser) {
    return this.service.list(query, user)
  }

  /** 导出任务详情 */
  @Get(':id')
  @RequirePerm('system:io:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.detail(id, user)
  }

  /** 下载导出文件 */
  @Get(':id/content')
  @RequirePerm('system:io:view')
  @Header('content-type', 'text/csv; charset=utf-8')
  content(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.content(id, user)
  }

  /** 重新执行任务 */
  @Post(':id/retry')
  @RequirePerm('system:io:export')
  retry(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.retry(id, user)
  }
}
