import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  BatchCreateLabelDto,
  CreateBarcodeRuleDto,
  CreatePrintJobDto,
  CreatePrintLabelDto,
  CreatePrintTemplateDto,
  QueryLabelInstanceDto,
  QueryPrintJobDto,
  QueryPrintRecordDto,
  QueryPrintTemplateDto,
  UpdateBarcodeRuleDto,
  UpdatePrintTemplateDto
} from './dto'
import { PrintService } from './print.service'

@Controller('print')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class PrintController {
  constructor(private readonly service: PrintService) {}

  @Get('templates')
  @RequirePerm('print:template:view')
  listTemplates(@Query() query: QueryPrintTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.listTemplates(query, user)
  }

  @Get('fields/:bizType')
  @RequirePerm('print:template:view')
  listFields(@Param('bizType') bizType: string, @CurrentUser() user: JwtUser) {
    return this.service.listFields(bizType, user)
  }

  @Post('templates')
  @RequirePerm('print:template:create')
  createTemplate(@Body() dto: CreatePrintTemplateDto, @CurrentUser() user: JwtUser) {
    return this.service.createTemplate(dto, user)
  }

  @Put('templates/:id')
  @RequirePerm('print:template:update')
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrintTemplateDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.updateTemplate(id, dto, user)
  }

  @Delete('templates/:id')
  @RequirePerm('print:template:delete')
  removeTemplate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeTemplate(id, user)
  }

  @Get('templates/:id/preview')
  @RequirePerm('print:template:view')
  previewTemplate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.previewTemplate(id, user)
  }

  @Get('templates/versions/:code')
  @RequirePerm('print:template:view')
  templateVersions(@Param('code') code: string, @CurrentUser() user: JwtUser) {
    return this.service.templateVersions(code, user)
  }

  @Post('templates/:id/rollback')
  @RequirePerm('print:template:update')
  rollbackTemplate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.rollbackTemplate(id, user)
  }

  @Post('templates/:id/publish')
  @RequirePerm('print:template:update')
  publishTemplate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.publishTemplate(id, user)
  }

  @Post('templates/:id/copy')
  @RequirePerm('print:template:create')
  copyTemplate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.copyTemplate(id, user)
  }

  @Post('jobs')
  @RequirePerm('print:job:create')
  createJob(@Body() dto: CreatePrintJobDto, @CurrentUser() user: JwtUser) {
    return this.service.createJob(dto, user)
  }

  @Post('jobs/batch')
  @RequirePerm('print:job:create')
  batchPrint(@Body() body: { items: CreatePrintJobDto[] }, @CurrentUser() user: JwtUser) {
    return this.service.batchPrint(body.items, user)
  }

  /** 静默打印：创建交给本地客户端执行的打印任务 */
  @Post('jobs/silent')
  @RequirePerm('print:job:create')
  createSilentJob(@Body() dto: CreatePrintJobDto, @CurrentUser() user: JwtUser) {
    return this.service.createSilentJob(dto, user)
  }

  @Post('records/:id/reprint')
  @RequirePerm('print:record:reprint')
  reprint(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.reprint(id, user)
  }

  @Get('records')
  @RequirePerm('print:record:view')
  listRecords(@Query() query: QueryPrintRecordDto, @CurrentUser() user: JwtUser) {
    return this.service.listRecords(query, user)
  }

  @Get('records/:id/pdf')
  @Header('content-type', 'application/pdf')
  @Header('content-disposition', 'inline; filename="print-record.pdf"')
  @RequirePerm('print:record:view')
  renderPdf(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.renderRecordPdf(id, user)
  }

  @Get('records/:id/html')
  @Header('content-type', 'text/html; charset=utf-8')
  @RequirePerm('print:record:view')
  renderHtml(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.renderRecordHtml(id, user)
  }

  @Get('jobs')
  @RequirePerm('print:job:view')
  listJobs(@Query() query: QueryPrintJobDto, @CurrentUser() user: JwtUser) {
    return this.service.listJobs(query, user)
  }

  @Post('jobs/:id/retry')
  @RequirePerm('print:job:retry')
  retryJob(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.retryJob(id, user)
  }

  @Get('labels')
  @RequirePerm('print:label:view')
  listLabels(@Query() query: QueryPrintRecordDto, @CurrentUser() user: JwtUser) {
    return this.service.listLabels(query, user)
  }

  @Post('labels')
  @RequirePerm('print:label:create')
  createLabel(@Body() dto: CreatePrintLabelDto, @CurrentUser() user: JwtUser) {
    return this.service.createLabel(dto, user)
  }

  @Post('labels/batch-generate')
  @RequirePerm('print:label:create')
  batchGenerateLabels(@Body() dto: BatchCreateLabelDto, @CurrentUser() user: JwtUser) {
    return this.service.batchCreateLabels(dto, user)
  }

  @Get('label-instances')
  @RequirePerm('print:label:view')
  listLabelInstances(@Query() query: QueryLabelInstanceDto, @CurrentUser() user: JwtUser) {
    return this.service.listLabelInstances(query, user)
  }

  @Post('label-instances/:id/print')
  @RequirePerm('print:label:create')
  printLabelInstance(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.printLabelInstance(id, user)
  }

  @Get('barcode-rules')
  @RequirePerm('print:label:view')
  listBarcodeRules(@CurrentUser() user: JwtUser) {
    return this.service.listBarcodeRules(user)
  }

  @Post('barcode-rules')
  @RequirePerm('print:label:create')
  createBarcodeRule(@Body() dto: CreateBarcodeRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.createBarcodeRule(dto, user)
  }

  @Put('barcode-rules/:id')
  @RequirePerm('print:label:update')
  updateBarcodeRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBarcodeRuleDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.updateBarcodeRule(id, dto, user)
  }
}
