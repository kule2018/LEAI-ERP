import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  ExportJobDto,
  ImportCommitDto,
  ImportPreviewDto,
  QueryIoJobDto,
  QueryIoImportTaskDto,
  SaveMappingDto
} from './dto'
import { IoService } from './io.service'

@Controller('system/io')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class IoController {
  constructor(private readonly service: IoService) {}

  @Get('configs')
  @RequirePerm('system:io:view')
  configs(@CurrentUser() user: JwtUser) {
    return this.service.listImportConfigs(user)
  }

  @Get('template/:code')
  @RequirePerm('system:io:view')
  @Header('content-type', 'text/csv; charset=utf-8')
  async template(@Param('code') code: string, @CurrentUser() user: JwtUser) {
    return (await this.service.template(code, user)).content
  }

  @Post('preview')
  @RequirePerm('system:io:import')
  preview(@Body() dto: ImportPreviewDto, @CurrentUser() user: JwtUser) {
    return this.service.preview(dto.code, dto.content, user)
  }

  @Post('import')
  @RequirePerm('system:io:import')
  import(@Body() dto: ImportCommitDto, @CurrentUser() user: JwtUser) {
    return this.service.import(dto.code, dto.content, user, { skipInvalid: dto.skipInvalid })
  }

  @Post('export')
  @RequirePerm('system:io:export')
  exportJob(@Body() dto: ExportJobDto, @CurrentUser() user: JwtUser) {
    return this.service.createExportJob(dto.code, user)
  }

  @Get('jobs')
  @RequirePerm('system:io:view')
  jobs(@Query() query: QueryIoJobDto, @CurrentUser() user: JwtUser) {
    return this.service.listJobs(query, user)
  }

  @Get('jobs/:id/content')
  @RequirePerm('system:io:view')
  @Header('content-type', 'text/csv; charset=utf-8')
  jobContent(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.jobContent(id, user)
  }

  /** 字段映射：查询与保存 */
  @Get('imports/:code/mappings')
  @RequirePerm('system:io:view')
  mappings(@Param('code') code: string, @CurrentUser() user: JwtUser) {
    return this.service.listMappings(code, user)
  }

  @Put('imports/:code/mappings')
  @RequirePerm('system:io:import')
  saveMappings(@Param('code') code: string, @Body() dto: SaveMappingDto, @CurrentUser() user: JwtUser) {
    return this.service.saveMappings(code, dto.mappings ?? [], user)
  }

  /** 导入批次列表 */
  @Get('import-tasks')
  @RequirePerm('system:io:view')
  importTasks(@Query() query: QueryIoImportTaskDto, @CurrentUser() user: JwtUser) {
    return this.service.listImportTasks(query, user)
  }

  /** 导入错误行明细 */
  @Get('import-errors')
  @RequirePerm('system:io:view')
  importErrors(@Query() query: QueryIoImportTaskDto, @CurrentUser() user: JwtUser) {
    return this.service.listImportErrors(query, user)
  }

  /** 导入错误报告下载 */
  @Get('import-errors/report')
  @RequirePerm('system:io:view')
  @Header('content-type', 'text/csv; charset=utf-8')
  async importErrorReport(@Query() query: QueryIoImportTaskDto, @CurrentUser() user: JwtUser) {
    return (await this.service.exportImportErrors(query.code ?? '', query.batchNo ?? '', user)).content
  }

  @Post('jobs/process')
  @RequirePerm('system:io:export')
  processJobs() {
    return this.service.processPendingJobs()
  }
}
