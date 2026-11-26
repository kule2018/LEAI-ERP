import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const AMOUNT = /^\d+(\.\d{1,4})?$/

export class QueryCollaborationDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsString() @MaxLength(20) period?: string
  /** 待办：按处理人过滤（需协作待办管理权限） */
  @IsOptional() @IsInt() @Min(1) assigneeId?: number
  /** 待办：仅看超时任务 */
  @IsOptional() @IsBoolean() @Type(() => Boolean) onlyOverdue?: boolean
  /** 待办：按单据编号/类型关键字过滤 */
  @IsOptional() @IsString() @MaxLength(64) declare keyword?: string
  /** 待办：按业务类型过滤 */
  @IsOptional() @IsString() @MaxLength(64) bizType?: string
}

export class FlowNodeDto {
  @IsString() @IsNotEmpty() @MaxLength(60) nodeCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) nodeName!: string
  @IsOptional() @IsString() @MaxLength(24) nodeType?: string
  @IsOptional() @IsString() @MaxLength(100) assigneeRule?: string
  @IsOptional() @IsString() @MaxLength(300) conditionExpr?: string
  @IsOptional() @IsIn(['ANY', 'ALL', 'SEQUENTIAL']) approvalMode?: string
  @IsOptional() @IsInt() @Min(1) @Max(720) timeoutHours?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
}

export class CreateFlowDefinitionDto {
  @IsString() @IsNotEmpty() @MaxLength(64) code!: string
  @IsString() @IsNotEmpty() @MaxLength(100) flowName!: string
  @IsString() @IsNotEmpty() @MaxLength(64) bizType!: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => FlowNodeDto) nodes!: FlowNodeDto[]
}

export class FormFieldDto {
  @IsString() @IsNotEmpty() @MaxLength(60) key!: string
  @IsString() @IsNotEmpty() @MaxLength(60) label!: string
  @IsOptional() @IsIn(['text', 'number', 'date', 'select', 'textarea']) type?: string
  @IsOptional() @IsBoolean() required?: boolean
  @IsOptional() @IsString() @MaxLength(200) options?: string
}

export class FormSchemaDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FormFieldDto) fields?: FormFieldDto[]
  @IsOptional() @IsString() @MaxLength(100) title?: string
}

export class UpdateFlowDefinitionDto {
  @IsOptional() @IsString() @MaxLength(100) flowName?: string
  @IsOptional() @IsString() @MaxLength(64) bizType?: string
  @IsOptional() @IsOptional() @ValidateNested() @Type(() => FormSchemaDto) formSchema?: FormSchemaDto
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => FlowNodeDto) nodes?: FlowNodeDto[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class StartFlowDto {
  @IsString() @IsNotEmpty() @MaxLength(64) bizType!: string
  @IsInt() @Min(1) bizId!: number
  @IsOptional() @IsString() @MaxLength(80) bizNo?: string
  @IsOptional() @IsInt() @Min(1) definitionId?: number
  @IsOptional() @IsObject() context?: Record<string, unknown>
}

export class FlowActionDto {
  @IsIn(['APPROVE', 'REJECT']) action!: string
  @ValidateIf((o: FlowActionDto) => o.action === 'REJECT')
  @IsNotEmpty() @IsString() @MaxLength(500) comment?: string
}

export class BatchActTaskDto extends FlowActionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsInt({ each: true }) @Min(1, { each: true })
  ids!: number[]
}

export class DelegateTaskDto {
  @IsInt() @Min(1) toUserId!: number
  @IsOptional() @IsString() @MaxLength(500) reason?: string
  @IsOptional() @IsDateString() startAt?: string
  @IsOptional() @IsDateString() endAt?: string
}

export class AddSignDto {
  @IsInt() @Min(1) userId!: number
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class CreateNoticeDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string
  @IsOptional() @IsString() content?: string
  @IsOptional() @IsString() @MaxLength(24) channel?: string
}

export class CreateChatDto {
  @IsString() @IsNotEmpty() @MaxLength(80) channel!: string
  @IsString() @IsNotEmpty() content!: string
  @IsOptional() @IsInt() @Min(1) receiverId?: number
}

export class CreateProjectDto {
  @IsString() @IsNotEmpty() @MaxLength(60) projectCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) projectName!: string
  @IsOptional() @IsInt() @Min(1) ownerId?: number
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
}

export class CreateOaTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(150) taskName!: string
  @IsOptional() @IsInt() @Min(1) projectId?: number
  @IsOptional() @IsInt() @Min(1) assigneeId?: number
  @IsOptional() @IsString() @MaxLength(10) dueDate?: string
}

export class CreateDocumentDto {
  @IsString() @IsNotEmpty() @MaxLength(60) docCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) title!: string
  @IsOptional() @IsInt() @Min(1) categoryId?: number
  @IsOptional() @IsString() @MaxLength(500) fileUrl?: string
}

export class CreateRecruitDto {
  @IsString() @IsNotEmpty() @MaxLength(100) positionName!: string
  @IsOptional() @IsInt() @Min(1) headcount?: number
}

export class CreateCandidateDto {
  @IsOptional() @IsInt() @Min(1) demandId?: number
  @IsString() @IsNotEmpty() @MaxLength(64) name!: string
  @IsOptional() @IsString() @MaxLength(30) mobile?: string
  @IsOptional() @IsInt() @Min(0) score?: number
}

export class CreateInterviewDto {
  @IsInt() @Min(1) candidateId!: number
  @IsInt() @Min(1) interviewerId!: number
  @IsOptional() @IsString() @MaxLength(30) interviewAt?: string
  @IsString() @IsNotEmpty() @MaxLength(500) feedback!: string
}

export class CreateSensitiveWordDto {
  @IsString() @IsNotEmpty() @MaxLength(120) word!: string
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) level?: string
  @IsOptional() @IsIn(['YES', 'NO']) enabled?: string
}

export class CreateMeetingDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string
  @IsOptional() @IsInt() @Min(1) projectId?: number
  @IsOptional() @IsString() @MaxLength(30) meetingAt?: string
  @IsOptional() @IsString() @MaxLength(200) location?: string
  @IsOptional() @IsString() @MaxLength(4000) minutes?: string
}

export class CreatePunchRequestDto {
  @IsInt() @Min(1) employeeId!: number
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) punchDate!: string
  @IsOptional() @IsIn(['MISSING', 'LATE', 'EARLY']) punchType?: string
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string
}

export class ApprovePunchRequestDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT'
  @ValidateIf((o: ApprovePunchRequestDto) => o.decision === 'REJECT')
  @IsNotEmpty() @IsString() @MaxLength(300) comment?: string
}

export class ApproveSalaryDto {
  @IsIn(['SUBMIT', 'APPROVE', 'REJECT', 'PAY']) decision!: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PAY'
  @ValidateIf((o: ApproveSalaryDto) => o.decision === 'REJECT')
  @IsNotEmpty() @IsString() @MaxLength(300) comment?: string
}

export class ResolveAppealDto {
  @IsIn(['ACCEPT', 'REJECT']) result!: 'ACCEPT' | 'REJECT'
  @ValidateIf((o: ResolveAppealDto) => o.result === 'REJECT')
  @IsNotEmpty() @IsString() @MaxLength(500) resolution?: string
}

export class CreateVehicleExpenseDto {
  @IsInt() @Min(1) vehicleId!: number
  @IsOptional() @IsInt() @Min(1) vehicleUseId?: number
  @IsOptional() @IsIn(['FUEL', 'TOLL', 'PARK', 'REPAIR', 'OTHER']) expenseType?: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) expenseDate!: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class CreateVehicleTrackDto {
  @IsInt() @Min(1) vehicleId!: number
  @IsOptional() @IsInt() @Min(1) vehicleUseId?: number
  @IsString() @Matches(/^-?\d{1,3}(\.\d{1,6})?$/) longitude!: string
  @IsString() @Matches(/^-?\d{1,2}(\.\d{1,6})?$/) latitude!: string
  @IsOptional() @IsString() @Matches(AMOUNT) speed?: string
  @IsOptional() @IsString() @MaxLength(30) trackedAt?: string
}

export class CreateShiftDto {
  @IsString() @IsNotEmpty() @MaxLength(50) shiftCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) shiftName!: string
  @IsString() @IsNotEmpty() @MaxLength(10) startTime!: string
  @IsString() @IsNotEmpty() @MaxLength(10) endTime!: string
}

export class CreatePunchDto {
  @IsInt() @Min(1) employeeId!: number
  @IsOptional() @IsString() @MaxLength(30) punchTime?: string
  @IsOptional() @IsString() @MaxLength(24) source?: string
}

export class CreateLeaveDto {
  @IsInt() @Min(1) employeeId!: number
  @IsString() @IsNotEmpty() @MaxLength(32) leaveType!: string
  @IsString() @IsNotEmpty() @MaxLength(30) startTime!: string
  @IsString() @IsNotEmpty() @MaxLength(30) endTime!: string
}

export class CreateOvertimeDto {
  @IsInt() @Min(1) employeeId!: number
  @IsString() @Matches(AMOUNT) hours!: string
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}

export class CreateSalaryDto {
  @IsInt() @Min(1) employeeId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsString() @Matches(AMOUNT) grossAmount!: string
  @IsOptional() @IsString() @Matches(AMOUNT) netAmount?: string
}

export class CreatePerformanceDto {
  @IsInt() @Min(1) employeeId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsOptional() @IsInt() @Min(0) @Max(100) score?: number
}

export class CreateTrainingDto {
  @IsString() @IsNotEmpty() @MaxLength(150) courseName!: string
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
}

export class CreateAdminAssetDto {
  @IsString() @IsNotEmpty() @MaxLength(60) assetNo!: string
  @IsString() @IsNotEmpty() @MaxLength(150) assetName!: string
  @IsOptional() @IsInt() @Min(1) holderId?: number
}

export class CreateVehicleDto {
  @IsString() @IsNotEmpty() @MaxLength(30) plateNo!: string
  @IsString() @IsNotEmpty() @MaxLength(100) vehicleName!: string
  @IsOptional() @IsInt() @Min(1) driverId?: number
}

export class CreateEmployeeRecordDto {
  @IsInt() @Min(1) employeeId!: number
  @IsIn(['CONTRACT', 'CHANGE', 'CERTIFICATE', 'ORG_HISTORY']) recordType!: string
  @IsString() @IsNotEmpty() @MaxLength(150) recordTitle!: string
  @IsOptional() @IsString() @MaxLength(500) detail?: string
  @IsOptional() @IsString() @MaxLength(10) effectiveDate?: string
  @IsOptional() @IsString() @MaxLength(10) expiryDate?: string
}

export class ApprovalStatusDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: string
  @ValidateIf((o: ApprovalStatusDto) => o.status === 'REJECTED')
  @IsNotEmpty() @IsString() @MaxLength(500) note?: string
}

export class CreateOfferDto {
  @IsInt() @Min(1) candidateId!: number
  @IsString() @IsNotEmpty() @MaxLength(100) positionName!: string
  @IsString() @Matches(AMOUNT) salary!: string
  @IsInt() @Min(0) budget!: number
}

export class CreatePayrollDetailDto {
  @IsInt() @Min(1) salaryId!: number
  @IsString() @Matches(AMOUNT) gross!: string
  @IsOptional() @IsString() @Matches(AMOUNT) taxable?: string
}

export class ReviewPayrollDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: string
}

export class CreatePerformanceReviewDto {
  @IsInt() @Min(1) performanceId!: number
  @IsInt() @Min(0) @Max(100) kpiScore!: number
  @IsInt() @Min(0) @Max(100) peerScore!: number
  @IsOptional() @IsInt() @Min(-20) @Max(20) calibration?: number
}

export class AppealPerformanceDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string
}

export class CreateTrainingRecordDto {
  @IsInt() @Min(1) trainingId!: number
  @IsInt() @Min(1) employeeId!: number
  @IsInt() @Min(0) @Max(100) examScore!: number
}

export class AssetActionDto {
  @IsInt() @Min(1) assetId!: number
  @IsIn(['ISSUE', 'RETURN', 'INVENTORY', 'REPAIR']) action!: 'ISSUE' | 'RETURN' | 'INVENTORY' | 'REPAIR'
  @IsOptional() @IsInt() @Min(1) holderId?: number
  @IsOptional() @IsString() @MaxLength(300) note?: string
}

export class CreateVehicleUseDto {
  @IsInt() @Min(1) vehicleId!: number
  @IsInt() @Min(1) applyUserId!: number
  @IsString() @IsNotEmpty() @MaxLength(30) startTime!: string
  @IsString() @IsNotEmpty() @MaxLength(30) endTime!: string
}

/* ---------------------------------------------------------- 项目管理 */

export class CreateMilestoneDto {
  @IsInt() @Min(1) projectId!: number
  @IsString() @IsNotEmpty() @MaxLength(150) milestoneName!: string
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
  @IsOptional() @IsInt() @Min(1) ownerId?: number
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class UpdateMilestoneDto {
  @IsOptional() @IsString() @MaxLength(150) milestoneName?: string
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
  @IsOptional() @IsString() @MaxLength(10) actualDate?: string
  @IsOptional() @IsInt() @Min(1) ownerId?: number
  @IsOptional() @IsIn(['PLANNED', 'DOING', 'DONE', 'CANCELLED']) status?: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class CreateWorklogDto {
  @IsInt() @Min(1) taskId!: number
  @IsOptional() @IsInt() @Min(1) userId?: number
  @IsDateString()
  workDate!: string
  @IsString() @Matches(/^\d+(\.\d{1,2})?$/) hours!: string
  @IsString() @IsNotEmpty() @MaxLength(500) content!: string
}

export class CreateProjectRiskDto {
  @IsInt() @Min(1) projectId!: number
  @IsString() @IsNotEmpty() @MaxLength(200) riskTitle!: string
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) riskLevel?: string
  @IsOptional() @IsInt() @Min(1) @Max(5) probability?: number
  @IsOptional() @IsInt() @Min(1) @Max(5) impact?: number
  @IsOptional() @IsInt() @Min(1) ownerId?: number
  @IsOptional() @IsString() @MaxLength(500) mitigation?: string
}

export class UpdateProjectRiskDto {
  @IsOptional() @IsString() @MaxLength(200) riskTitle?: string
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) riskLevel?: string
  @IsOptional() @IsInt() @Min(1) @Max(5) probability?: number
  @IsOptional() @IsInt() @Min(1) @Max(5) impact?: number
  @IsOptional() @IsInt() @Min(1) ownerId?: number
  @IsOptional() @IsString() @MaxLength(500) mitigation?: string
  @IsOptional() @IsIn(['OPEN', 'MITIGATING', 'CLOSED']) status?: string
}

/* ---------------------------------------------------------- 招聘 */

export class MoveCandidateStageDto {
  @IsIn(['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED', 'TALENT']) stage!: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class OfferActionDto {
  @IsIn(['APPROVE', 'REJECT']) action!: 'APPROVE' | 'REJECT'
  @ValidateIf((o: OfferActionDto) => o.action === 'REJECT')
  @IsNotEmpty() @IsString() @MaxLength(300) comment?: string
}

export class TalentActionDto {
  @IsIn(['IN', 'REUSE', 'DISCARD']) action!: 'IN' | 'REUSE' | 'DISCARD'
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

/* ---------------------------------------------------------- 车队调度 */

export class DispatchVehicleDto {
  @IsOptional() @IsInt() @Min(1) vehicleId?: number
  @IsInt() @Min(1) applyUserId!: number
  @IsString() @IsNotEmpty() @MaxLength(30) startTime!: string
  @IsString() @IsNotEmpty() @MaxLength(30) endTime!: string
  @IsOptional() @IsString() @MaxLength(200) reason?: string
  @IsOptional() @IsString() @IsIn(['YES', 'NO']) forceConflict?: string
}

/* ---------------------------------------------------------- 绩效 360 */

export class CreatePerformanceFeedbackDto {
  @IsInt() @Min(1) evaluatorId!: number
  @IsOptional() @IsIn(['SELF', 'PEER', 'MANAGER', 'SUBORDINATE']) feedbackType?: string
  @IsInt() @Min(0) @Max(100) score!: number
  @IsOptional() @IsString() @MaxLength(500) comment?: string
}

/* ---------------------------------------------------------- 培训签到/成绩 */

export class TrainingSigninDto {
  @IsInt() @Min(1) employeeId!: number
}

export class TrainingScoreDto {
  @IsInt() @Min(1) employeeId!: number
  @IsInt() @Min(0) @Max(100) examScore!: number
  @IsOptional() @IsString() @MaxLength(10) expireDate?: string
}

/* ---------------------------------------------------------- 提醒 */

export class QueryReminderDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) type?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) thresholdDays?: number
}

/* ---------------------------------------------------------- 人事审批与核算增强 */

export class CreateShiftScheduleDto {
  @IsInt() @Min(1) employeeId!: number
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) workDate!: string
  @IsInt() @Min(1) shiftId!: number
}

export class HrApprovalDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT'
  @ValidateIf((o: HrApprovalDto) => o.decision === 'REJECT')
  @IsNotEmpty() @IsString() @MaxLength(300) comment?: string
}

export class GenerateSocialInsuranceDto {
  @IsInt() @Min(1) salaryId!: number
  @IsOptional() @IsString() @Matches(AMOUNT) baseAmount?: string
}

export class CreateAssetStocktakeDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) stocktakeDate!: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class StocktakeItemDto {
  @IsInt() @Min(1) assetId!: number
  @IsString() @IsNotEmpty() @MaxLength(24) actualStatus!: string
  @IsOptional() @IsInt() @Min(1) actualHolderId?: number
}

export class SubmitStocktakeDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StocktakeItemDto) items!: StocktakeItemDto[]
}

export class CreateAssetRepairDto {
  @IsInt() @Min(1) assetId!: number
  @IsOptional() @IsIn(['MAINTENANCE', 'FAULT', 'UPGRADE']) repairType?: string
  @IsString() @IsNotEmpty() @MaxLength(500) repairReason!: string
  @IsOptional() @IsString() @MaxLength(150) vendor?: string
  @IsOptional() @IsString() @Matches(AMOUNT) amount?: string
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) repairDate!: string
}

export class FinishAssetRepairDto {
  @IsOptional() @IsString() @Matches(AMOUNT) amount?: string
  @IsOptional() @IsString() @MaxLength(150) vendor?: string
}

export class CreatePerformanceKpiDto {
  @IsString() @IsNotEmpty() @MaxLength(60) kpiCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) kpiName!: string
  @IsOptional() @IsString() @MaxLength(50) category?: string
  @IsOptional() @IsString() @Matches(/^\d+(\.\d{1,2})?$/) weight?: string
  @IsOptional() @IsString() @Matches(AMOUNT) targetValue?: string
  @IsOptional() @IsString() @MaxLength(20) unit?: string
  @IsOptional() @IsString() @MaxLength(500) description?: string
}

export class CreateCalibrationDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) calibrationDate!: string
  @IsOptional() @IsString() @MaxLength(500) conclusion?: string
}

export class UpdateVehicleUseDto {
  @IsOptional() @IsString() @Matches(AMOUNT) mileage?: string
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}
