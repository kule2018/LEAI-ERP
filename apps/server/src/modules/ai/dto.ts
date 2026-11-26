import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class CreateAiPromptDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  model?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number
}

export class UpdateAiPromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  model?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number

  @IsOptional()
  @IsIn(['YES', 'NO'])
  isActive?: string
}

export class QueryAiPromptDto extends PaginationDto {}

export class CopilotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  prompt!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  conversationId?: number
}

export class ConfirmAiDto {
  @IsIn(['YES', 'NO'])
  accepted!: string
}

export class QueryAiTaskDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  capability?: string

  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string
}

export class AiOcrDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  docType?: string
}

export class AiDocParseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  text!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetType?: string

  @IsOptional()
  @IsArray()
  lines?: Array<Record<string, unknown>>
}

export class AiForecastDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periods?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  availableQty?: number

  @IsOptional()
  @IsArray()
  history?: Array<Record<string, unknown>>

  /** 安全库存 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  safetyStock?: number

  /** 采购提前期（天） */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(365)
  leadTimeDays?: number

  /** 最小起订量 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderQty?: number

  /** 批量倍数（包装规格） */
  @IsOptional()
  @IsNumber()
  @Min(0)
  lotSize?: number
}

export class AiAnomalyDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  scope?: string
}

export class AiReportInsightDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  reportType?: string

  @IsObject()
  metrics!: Record<string, unknown>
}

export class AiRagUpsertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  docCode!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  content!: string

  @IsOptional()
  @IsString()
  @MaxLength(24)
  docType?: string

  @IsOptional()
  @IsIn(['PUBLIC', 'DEPT', 'PRIVATE'])
  visibility?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  orgId?: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string
}

export class AiRagQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  topK?: number
}

export class AiRagFeedbackDto {
  @IsInt()
  @Min(1)
  chunkId!: number

  @IsIn(['GOOD', 'BAD'])
  feedback!: string
}

export class AiRecommendDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number
}

export class AiReconcileDto {
  @IsArray()
  left!: Array<Record<string, unknown>>

  @IsArray()
  right!: Array<Record<string, unknown>>
}

export class AiSubjectMatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  summary!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number
}

export class AiResumeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  text!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string
}

export class AiLabelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  text!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string
}

export class AiCsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question!: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderNo?: string
}

export class CreateAiModelConfigDto {
  @IsOptional() @IsString() @MaxLength(60) capability?: string
  @IsOptional() @IsInt() @Min(0) @Max(100) grayPercent?: number
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  provider!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  model!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiKey?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64000)
  maxTokens?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimit?: number

  @IsOptional()
  @IsIn(['YES', 'NO'])
  isDefault?: string
}

export class AiFileParseDto {
  @IsString() @IsNotEmpty() @MaxLength(50000) text!: string
  @IsString() @IsNotEmpty() @MaxLength(200) fileName!: string
  @IsOptional() @IsString() @MaxLength(100) mimeType?: string
  @IsOptional() @IsString() @MaxLength(40) targetType?: string
}

/** 人工确认/拒绝 AI 补货建议 */
export class ConfirmForecastSuggestionDto {
  @IsIn(['YES', 'NO'])
  accepted!: 'YES' | 'NO'

  /** 确认时实际采用的补货量，不传则采用建议量 */
  @IsOptional()
  @IsNumber()
  qty?: number

  /** 拒绝时必填的原因 */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

/** 补货建议查询 */
export class QueryForecastSuggestionDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsInt()
  productId?: number
}

/** 外部模型服务接入连通性测试 */
export class TestModelEndpointDto {
  @IsOptional()
  @IsInt()
  configId?: number

  @IsOptional()
  @IsString()
  endpoint?: string

  @IsOptional()
  @IsString()
  apiKey?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsInt()
  timeoutMs?: number
}

export class AiRerecognizeDto {
  @IsInt() @Min(1) taskId!: number
  @IsObject() corrections!: Record<string, string>
}

export class AiGrayModelDto {
  @IsString() @IsNotEmpty() @MaxLength(60) capability!: string
  @IsOptional() @IsString() @MaxLength(100) seed?: string
}

export class AiReportExportDto {
  @IsObject() metrics!: Record<string, unknown>
  @IsOptional() @IsArray() diagnoses?: string[]
  @IsOptional() @IsArray() citations?: Array<Record<string, unknown>>
}

export class AiReportDrillDto {
  @IsObject() metrics!: Record<string, unknown>
  @IsString() @IsNotEmpty() @MaxLength(40) dimension!: string
}

export class UpdateAiModelConfigDto {
  @IsOptional() @IsString() @MaxLength(60) capability?: string
  @IsOptional() @IsInt() @Min(0) @Max(100) grayPercent?: number
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  apiKey?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64000)
  maxTokens?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimit?: number

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: string

  @IsOptional()
  @IsIn(['YES', 'NO'])
  isDefault?: string
}

/** AI 运行时配置：租户级开关与默认生成参数 */
export class UpdateAiConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultModelId?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(64000)
  maxTokens?: number

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(600000)
  timeoutMs?: number

  @IsOptional()
  @IsBoolean()
  sseEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  confirmWriteRequired?: boolean
}
