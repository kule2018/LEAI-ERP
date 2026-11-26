import { request, streamSse } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface AiPrompt {
  id: number
  code: string
  name: string
  content: string
  model: string | null
  temperature: string
  version: number
  status?: string
  parentId?: number | null
  publishedAt?: string | null
  isActive: number
}

export interface CreateAiPrompt {
  code: string
  name: string
  content: string
  model?: string
  temperature?: number
}

export function fetchPrompts(params: PageQuery) {
  return request<PageResult<AiPrompt>>({ url: '/ai/prompts', method: 'get', params })
}

export function createPrompt(data: CreateAiPrompt) {
  return request<AiPrompt>({ url: '/ai/prompts', method: 'post', data })
}

export function fetchPromptVersions(code: string) {
  return request<AiPrompt[]>({ url: '/ai/prompts/versions', method: 'get', params: { code } })
}

export function publishPrompt(id: number) {
  return request<AiPrompt>({ url: `/ai/prompts/${id}/publish`, method: 'post' })
}

export function rollbackPrompt(id: number) {
  return request<AiPrompt>({ url: `/ai/prompts/${id}/rollback`, method: 'post' })
}

export interface AiConfig {
  enabled: boolean
  defaultModelId: number | null
  temperature: number
  maxTokens: number
  timeoutMs: number
  sseEnabled: boolean
  confirmWriteRequired: boolean
}

/** AI 运行时配置：开关、默认模型与生成参数 */
export function fetchAiConfig() {
  return request<AiConfig>({ url: '/ai/config', method: 'get' })
}

export function updateAiConfig(data: Partial<AiConfig>) {
  return request<AiConfig>({ url: '/ai/config', method: 'put', data })
}

export function runCopilot(prompt: string) {
  return request<{ auditId: number; suggestion: string }>({
    url: '/ai/copilot',
    method: 'post',
    data: { prompt }
  })
}

/** SSE 流式对话：逐段返回 delta，结束时给出 auditId（可确认写入） */
export function streamCopilot(
  prompt: string,
  onDelta: (delta: string) => void,
  onDone: (auditId?: number) => void
): Promise<void> {
  return streamSse(
    '/ai/copilot/stream',
    { prompt },
    (payload) => {
      const delta = payload.delta
      if (typeof delta === 'string' && delta) onDelta(delta)
      if (payload.done === true) onDone(typeof payload.auditId === 'number' ? payload.auditId : undefined)
    }
  )
}

export function confirmCopilot(auditId: number, accepted: 'YES' | 'NO') {
  return request<{
    id: number
    accepted: string
    appliedBizType: string | null
    appliedBizId: number | null
    applyError: string | null
  }>({
    url: `/ai/confirm/${auditId}`,
    method: 'post',
    data: { accepted }
  })
}

export interface AiExecution<T> {
  taskId: number
  taskNo: string
  auditId: number
  capability: string
  confidence: string
  evidence: Record<string, unknown>[]
  result: T
}

export interface AiTask {
  id: number
  taskNo: string
  capability: string
  confidence: string
  status: string
  createdAt: string
  inputText: string | null
  resultJson: Record<string, unknown> | null
}

export interface OcrField {
  key: string
  label: string
  value: string | null
  confidence: number
}

export interface OcrResult {
  docType: string
  fields: OcrField[]
  needsReview: string[]
  originalFile: string | null
  note: string
}

export interface ForecastResult {
  model: string
  history: Array<{ period: string; qty: number }>
  forecast: Array<{ period: string; qty: number }>
  avgQty: number
  trendRate: number
  suggestedQty: number
  mape: number | null
  note: string
  suggestionId?: number
  suggestionStatus?: string
  suggestion?: {
    suggestQty: number
    netQty: number
    demandQty: number
    coverDays: number
    level: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    confidence: number
    reason: string
  }
  accuracy?: { mape: number; accuracy: number; sampleSize: number; level: 'GOOD' | 'FAIR' | 'POOR' }
}

/** 补货建议（需人工确认后写回采购需求） */
export interface ForecastSuggestion {
  id: number
  tenantId: number
  productId: number
  model: string
  avgQty: string
  trendRate: string
  availableQty: string
  suggestQty: string
  confirmQty: string
  coverDays: string
  level: string
  confidence: string
  mape: string
  accuracy: string
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED'
  appliedBizType: string | null
  appliedBizId: number | null
  rejectReason: string | null
  reason: string | null
  evidence: Record<string, unknown>[] | null
  taskId: number | null
  confirmedBy: number | null
  confirmedAt: string | null
  createdAt: string
}

export interface ForecastSuggestionQuery extends PageQuery {
  status?: string
  productId?: number
}

export function fetchForecastSuggestions(params: ForecastSuggestionQuery) {
  return request<PageResult<ForecastSuggestion>>({ url: '/ai/forecast/suggestions', method: 'get', params })
}

export function confirmForecastSuggestion(
  id: number,
  data: { accepted: 'YES' | 'NO'; qty?: number; reason?: string }
) {
  return request<{
    suggestion: ForecastSuggestion
    demand?: { id: number; demandNo: string; qty: string }
  }>({ url: `/ai/forecast/suggestions/${id}/confirm`, method: 'post', data })
}

export function testModelEndpoint(data: {
  configId?: number
  endpoint?: string
  apiKey?: string
  model?: string
  timeoutMs?: number
}) {
  return request<{ ok: boolean; reason?: string; status?: number; latencyMs?: number; url?: string }>({
    url: '/ai/models/test-endpoint',
    method: 'post',
    data
  })
}

export interface AnomalyFinding {
  type: string
  severity: string
  target: string
  message: string
  evidence: Record<string, unknown>
  suggestion: string
}

export interface AnomalyResult {
  findings: AnomalyFinding[]
  count: number
  scannedAt: string
  scope: string
}

export interface RagCitation {
  docId: number
  docTitle: string
  chunkId: number
  chunkNo: number
  score: number
  snippet: string
}

export interface RagResult {
  answer: string
  citations: RagCitation[]
  filteredDocs: number
}

export interface KnowledgeDoc {
  id: number
  docCode: string
  title: string
  docType: string
  visibility: string
  chunkCount: number
  status: string
  createdAt: string
}

export interface AiModelConfig {
  id: number
  code: string
  name: string
  provider: string
  capability: string
  grayPercent: number
  model: string
  endpoint: string | null
  apiKeyMask: string | null
  temperature: string
  maxTokens: number
  rateLimit: number
  status: string
  isDefault: number
}

export interface AiTaskQuery extends PageQuery {
  capability?: string
  status?: string
}

export function fetchAiTasks(params: AiTaskQuery) {
  return request<PageResult<AiTask>>({ url: '/ai/tasks', method: 'get', params })
}

export function runOcr(data: { fileName?: string; fileUrl?: string; text?: string; docType?: string }) {
  return request<AiExecution<OcrResult>>({ url: '/ai/ocr', method: 'post', data })
}

export function parseDocument(data: {
  text: string
  fileName?: string
  fileUrl?: string
  targetType?: string
  lines?: Array<Record<string, unknown>>
}) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/doc-parse', method: 'post', data })
}

export function runRecommend(data: { customerId?: number; limit?: number }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/recommend', method: 'post', data })
}

export function runForecast(data: {
  productId?: number
  periods?: number
  availableQty?: number
  safetyStock?: number
  leadTimeDays?: number
  minOrderQty?: number
  lotSize?: number
  history?: Array<Record<string, unknown>>
}) {
  return request<AiExecution<ForecastResult>>({ url: '/ai/forecast/run', method: 'post', data })
}

export function scanAnomaly(data: { scope?: string }) {
  return request<AiExecution<AnomalyResult>>({ url: '/ai/anomaly/scan', method: 'post', data })
}

export function runReconcile(data: { left: Array<Record<string, unknown>>; right: Array<Record<string, unknown>> }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/reconcile', method: 'post', data })
}

export function matchSubject(data: { summary: string; limit?: number }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/subject-match', method: 'post', data })
}

export function reportInsight(data: { reportType?: string; metrics: Record<string, unknown> }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/report/insight', method: 'post', data })
}

export function fetchKnowledgeDocs() {
  return request<KnowledgeDoc[]>({ url: '/ai/knowledge/docs', method: 'get' })
}

export function upsertKnowledgeDoc(data: {
  docCode: string
  title: string
  content: string
  docType?: string
  visibility?: string
  orgId?: number
  fileUrl?: string
}) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/knowledge/docs', method: 'post', data })
}

export function queryKnowledge(data: { question: string; topK?: number }) {
  return request<AiExecution<RagResult>>({ url: '/ai/rag/query', method: 'post', data })
}

export function feedbackKnowledge(chunkId: number, feedback: 'GOOD' | 'BAD') {
  return request<{ id: number }>({ url: '/ai/rag/feedback', method: 'post', data: { chunkId, feedback } })
}

export function parseResume(data: { text: string; fileName?: string }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/resume/parse', method: 'post', data })
}

export function recognizeLabel(data: { text: string; fileName?: string }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/label/recognize', method: 'post', data })
}

export function csReply(data: { question: string; orderNo?: string }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/cs/reply', method: 'post', data })
}

export function fetchAiModels() {
  return request<AiModelConfig[]>({ url: '/ai/models', method: 'get' })
}

export function createAiModel(data: Record<string, unknown>) {
  return request<AiModelConfig>({ url: '/ai/models', method: 'post', data })
}

export function updateAiModel(id: number, data: Record<string, unknown>) {
  return request<AiModelConfig>({ url: `/ai/models/${id}`, method: 'put', data })
}

export function parseAiFile(data: { text: string; fileName: string; mimeType?: string; targetType?: string }) {
  return request<AiExecution<Record<string, unknown>>>({ url: '/ai/file/parse', method: 'post', data })
}

export function rerecognizeOcr(taskId: number, corrections: Record<string, string>) {
  return request<AiExecution<OcrResult>>({ url: '/ai/ocr/rerecognize', method: 'post', data: { taskId, corrections } })
}

export function selectGrayModel(capability: string, seed?: string) {
  return request<{ capability: string; model: AiModelConfig | null }>({ url: '/ai/models/gray-select', method: 'post', data: { capability, seed } })
}

export function exportAiReport(data: {
  metrics: Record<string, unknown>
  diagnoses?: string[]
  citations?: Array<Record<string, unknown>>
}) {
  return request<{ filename: string; content: string }>({ url: '/ai/report/export', method: 'post', data })
}

export function drillAiReport(metrics: Record<string, unknown>, dimension: string) {
  return request<Array<Record<string, unknown>>>({ url: '/ai/report/drill', method: 'post', data: { metrics, dimension } })
}
