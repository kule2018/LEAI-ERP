import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Sse, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { RequireFeature } from '../feature/decorators/require-feature.decorator'
import { FeatureGuard } from '../feature/guards/feature.guard'
import { AiService } from './ai.service'
import {
  AiAnomalyDto,
  AiCsDto,
  AiDocParseDto,
  AiFileParseDto,
  AiForecastDto,
  ConfirmForecastSuggestionDto,
  QueryForecastSuggestionDto,
  TestModelEndpointDto,
  AiGrayModelDto,
  AiLabelDto,
  AiOcrDto,
  AiReconcileDto,
  AiRecommendDto,
  AiReportDrillDto,
  AiReportExportDto,
  AiReportInsightDto,
  AiRerecognizeDto,
  AiResumeDto,
  AiRagFeedbackDto,
  AiRagQueryDto,
  AiRagUpsertDto,
  AiSubjectMatchDto,
  ConfirmAiDto,
  CopilotDto,
  CreateAiModelConfigDto,
  CreateAiPromptDto,
  QueryAiPromptDto,
  QueryAiTaskDto,
  UpdateAiConfigDto,
  UpdateAiModelConfigDto,
  UpdateAiPromptDto
} from './dto'

@Controller('ai')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard, FeatureGuard)
@RequireFeature('ai.enabled')
@DataScope({ org: 'dept', level: 'SELF' })
export class AiController {
  constructor(private readonly service: AiService) {}

  @Get('prompts')
  @RequirePerm('ai:config:view')
  listPrompts(@Query() query: QueryAiPromptDto, @CurrentUser() user: JwtUser) {
    return this.service.listPrompts(query, user)
  }

  @Post('prompts')
  @RequirePerm('ai:config:create')
  createPrompt(@Body() dto: CreateAiPromptDto, @CurrentUser() user: JwtUser) {
    return this.service.createPrompt(dto, user)
  }

  @Put('prompts/:id')
  @RequirePerm('ai:config:update')
  updatePrompt(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAiPromptDto, @CurrentUser() user: JwtUser) {
    return this.service.updatePrompt(id, dto, user)
  }

  @Delete('prompts/:id')
  @RequirePerm('ai:config:delete')
  removePrompt(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removePrompt(id, user)
  }

  @Get('prompts/versions')
  @RequirePerm('ai:config:view')
  listPromptVersions(@Query('code') code: string, @CurrentUser() user: JwtUser) {
    return this.service.listPromptVersions(code, user)
  }

  @Post('prompts/:id/publish')
  @RequirePerm('ai:config:update')
  publishPrompt(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.publishPrompt(id, user)
  }

  @Post('prompts/:id/rollback')
  @RequirePerm('ai:config:update')
  rollbackPrompt(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.rollbackPrompt(id, user)
  }

  @Get('tasks')
  @RequirePerm('ai:task:view')
  listTasks(@Query() query: QueryAiTaskDto, @CurrentUser() user: JwtUser) {
    return this.service.listTasks(query, user)
  }

  @Get('config')
  @RequirePerm('ai:config:view')
  getConfig(@CurrentUser() user: JwtUser) {
    return this.service.getConfig(user)
  }

  @Put('config')
  @RequirePerm('ai:config:update')
  updateConfig(@Body() dto: UpdateAiConfigDto, @CurrentUser() user: JwtUser) {
    return this.service.updateConfig(dto, user)
  }

  @Get('models')
  @RequirePerm('ai:model:view')
  listModels(@CurrentUser() user: JwtUser) {
    return this.service.listModelConfigs(user)
  }

  @Post('models')
  @RequirePerm('ai:model:create')
  createModel(@Body() dto: CreateAiModelConfigDto, @CurrentUser() user: JwtUser) {
    return this.service.createModelConfig(dto, user)
  }

  @Put('models/:id')
  @RequirePerm('ai:model:create')
  updateModel(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAiModelConfigDto, @CurrentUser() user: JwtUser) {
    return this.service.updateModelConfig(id, dto, user)
  }

  @Post('copilot')
  @RequirePerm('ai:chat')
  copilot(@Body() dto: CopilotDto, @CurrentUser() user: JwtUser) {
    return this.service.copilot(dto, user)
  }

  @Sse('copilot/stream')
  @RequirePerm('ai:chat')
  stream(
    @Query('prompt') prompt: string,
    @Query('conversationId') conversationId: string | undefined,
    @CurrentUser() user: JwtUser
  ) {
    const dto: CopilotDto = {
      prompt,
      ...(conversationId ? { conversationId: Number(conversationId) } : {})
    }
    return this.service.stream(dto, user)
  }

  @Post('confirm/:auditId')
  @RequirePerm('ai:confirm')
  confirm(
    @Param('auditId', ParseIntPipe) auditId: number,
    @Body() dto: ConfirmAiDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.confirm(auditId, dto, user)
  }

  @Post('doc-parse')
  @RequirePerm('ai:doc:parse')
  docParse(@Body() dto: AiDocParseDto, @CurrentUser() user: JwtUser) {
    return this.service.docParse(dto, user)
  }

  @Post('ocr')
  @RequirePerm('ai:ocr')
  ocr(@Body() dto: AiOcrDto, @CurrentUser() user: JwtUser) {
    return this.service.ocr(dto, user)
  }

  @Post('file/parse')
  @RequirePerm('ai:doc:parse')
  parseFile(@Body() dto: AiFileParseDto, @CurrentUser() user: JwtUser) {
    return this.service.parseFile(dto, user)
  }

  @Post('ocr/rerecognize')
  @RequirePerm('ai:ocr')
  rerecognize(@Body() dto: AiRerecognizeDto, @CurrentUser() user: JwtUser) {
    return this.service.rerecognize(dto, user)
  }

  @Post('models/gray-select')
  @RequirePerm('ai:model:view')
  selectGrayModel(@Body() dto: AiGrayModelDto, @CurrentUser() user: JwtUser) {
    return this.service.selectGrayModel(dto, user)
  }

  @Post('recommend')
  @RequirePerm('ai:recommend')
  recommend(@Body() dto: AiRecommendDto, @CurrentUser() user: JwtUser) {
    return this.service.recommend(dto, user)
  }

  @Post('forecast/run')
  @RequirePerm('ai:forecast')
  forecast(@Body() dto: AiForecastDto, @CurrentUser() user: JwtUser) {
    return this.service.forecast(dto, user)
  }

  /** 补货建议列表（待确认/已确认/已拒绝） */
  @Get('forecast/suggestions')
  @RequirePerm('ai:forecast')
  listForecastSuggestions(@Query() query: QueryForecastSuggestionDto, @CurrentUser() user: JwtUser) {
    return this.service.listForecastSuggestions(query, user)
  }

  /** 人工确认/拒绝补货建议：确认后写回采购需求 */
  @Post('forecast/suggestions/:id/confirm')
  @RequirePerm('ai:forecast')
  confirmForecastSuggestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmForecastSuggestionDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.confirmForecastSuggestion(id, dto, user)
  }

  /** 外部模型服务接入连通性测试 */
  @Post('models/test-endpoint')
  @RequirePerm('ai:model:view')
  testModelEndpoint(@Body() dto: TestModelEndpointDto, @CurrentUser() user: JwtUser) {
    return this.service.testModelEndpoint(dto, user)
  }

  @Post('anomaly/scan')
  @RequirePerm('ai:anomaly')
  anomaly(@Body() dto: AiAnomalyDto, @CurrentUser() user: JwtUser) {
    return this.service.anomalyScan(dto, user)
  }

  @Get('anomalies')
  @RequirePerm('ai:anomaly')
  anomalies(@Query() query: { page?: number; pageSize?: number; status?: string }, @CurrentUser() user: JwtUser) {
    return this.service.listAnomalies(query, user)
  }

  @Post('anomalies/:id/assign')
  @RequirePerm('ai:anomaly')
  assignAnomaly(@Param('id', ParseIntPipe) id: number, @Body() body: { assigneeId: number }, @CurrentUser() user: JwtUser) {
    return this.service.assignAnomaly(id, body.assigneeId, user)
  }

  @Post('anomalies/:id/close')
  @RequirePerm('ai:anomaly')
  closeAnomaly(@Param('id', ParseIntPipe) id: number, @Body() body: { note: string }, @CurrentUser() user: JwtUser) {
    return this.service.closeAnomaly(id, body.note, user)
  }

  @Post('reconcile')
  @RequirePerm('ai:reconcile')
  reconcile(@Body() dto: AiReconcileDto, @CurrentUser() user: JwtUser) {
    return this.service.reconcile(dto, user)
  }

  @Post('subject-match')
  @RequirePerm('ai:subject.match')
  subjectMatch(@Body() dto: AiSubjectMatchDto, @CurrentUser() user: JwtUser) {
    return this.service.subjectMatch(dto, user)
  }

  @Post('report/insight')
  @RequirePerm('ai:report')
  reportInsight(@Body() dto: AiReportInsightDto, @CurrentUser() user: JwtUser) {
    return this.service.reportInsight(dto, user)
  }

  @Post('report/export')
  @RequirePerm('ai:report')
  exportReport(@Body() dto: AiReportExportDto, @CurrentUser() user: JwtUser) {
    return this.service.exportReport(dto, user)
  }

  @Post('report/drill')
  @RequirePerm('ai:report')
  reportDrill(@Body() dto: AiReportDrillDto, @CurrentUser() user: JwtUser) {
    return this.service.reportDrill(dto, user)
  }

  @Get('knowledge/docs')
  @RequirePerm('ai:rag')
  listKnowledge(@CurrentUser() user: JwtUser) {
    return this.service.listKnowledgeDocs(user)
  }

  @Post('knowledge/docs')
  @RequirePerm('ai:rag')
  upsertKnowledge(@Body() dto: AiRagUpsertDto, @CurrentUser() user: JwtUser) {
    return this.service.upsertKnowledge(dto, user)
  }

  @Post('rag/query')
  @RequirePerm('ai:rag')
  ragQuery(@Body() dto: AiRagQueryDto, @CurrentUser() user: JwtUser) {
    return this.service.queryKnowledge(dto, user)
  }

  @Post('rag/feedback')
  @RequirePerm('ai:rag')
  ragFeedback(@Body() dto: AiRagFeedbackDto, @CurrentUser() user: JwtUser) {
    return this.service.feedbackKnowledge(dto, user)
  }

  @Post('resume/parse')
  @RequirePerm('ai:resume')
  resume(@Body() dto: AiResumeDto, @CurrentUser() user: JwtUser) {
    return this.service.resumeParse(dto, user)
  }

  @Post('label/recognize')
  @RequirePerm('ai:label')
  label(@Body() dto: AiLabelDto, @CurrentUser() user: JwtUser) {
    return this.service.labelRecognize(dto, user)
  }

  @Post('cs/reply')
  @RequirePerm('ai:cs')
  csReply(@Body() dto: AiCsDto, @CurrentUser() user: JwtUser) {
    return this.service.csReply(dto, user)
  }
}
