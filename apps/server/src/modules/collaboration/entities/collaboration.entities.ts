import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('flow_definition', { engine: 'InnoDB' })
@Index('uk_flow_definition_code', ['tenantId', 'code'], { unique: true })
export class FlowDefinitionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 64 }) code!: string
  @Column({ name: 'flow_name', type: 'varchar', length: 100 }) flowName!: string
  @Column({ name: 'biz_type', type: 'varchar', length: 64 }) bizType!: string
  @Column({ type: 'json', nullable: true }) schema!: Record<string, unknown> | null
  /** 表单字段设计：字段 key、标题、类型、必填等 */
  @Column({ name: 'form_schema', type: 'json', nullable: true }) formSchema!: Record<string, unknown> | null
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 }) isActive!: number
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('flow_node', { engine: 'InnoDB' })
@Entity('flow_definition_version', { engine: 'InnoDB' })
@Index('idx_flow_def_version_def', ['tenantId', 'definitionId', 'version'])
export class FlowDefinitionVersionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'definition_id', type: 'bigint' }) definitionId!: number
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'form_schema', type: 'json', nullable: true }) formSchema!: Record<string, unknown> | null
  @Column({ type: 'json', nullable: true }) nodes!: Record<string, unknown>[] | null
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'changed_by', type: 'bigint', nullable: true }) changedBy!: number | null
  @Column({ name: 'changed_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) changedAt!: Date
}

@Entity('flow_node', { engine: 'InnoDB' })
@Index('idx_flow_node', ['tenantId', 'definitionId'])
export class FlowNodeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'definition_id', type: 'bigint' }) definitionId!: number
  @Column({ name: 'node_code', type: 'varchar', length: 60 }) nodeCode!: string
  @Column({ name: 'node_name', type: 'varchar', length: 100 }) nodeName!: string
  @Column({ name: 'node_type', type: 'varchar', length: 24, default: 'APPROVAL' }) nodeType!: string
  @Column({ name: 'assignee_rule', type: 'varchar', length: 100, nullable: true }) assigneeRule!: string | null
  @Column({ name: 'condition_expr', type: 'varchar', length: 300, nullable: true }) conditionExpr!: string | null
  @Column({ name: 'approval_mode', type: 'varchar', length: 24, default: 'SEQUENTIAL' }) approvalMode!: string
  @Column({ name: 'timeout_hours', type: 'int', nullable: true }) timeoutHours!: number | null
  @Column({ name: 'sort_no', type: 'int', default: 0 }) sortNo!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('flow_instance', { engine: 'InnoDB' })
@Index('idx_flow_instance', ['tenantId', 'bizType', 'bizId'])
export class FlowInstanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'definition_id', type: 'bigint' }) definitionId!: number
  @Column({ name: 'biz_type', type: 'varchar', length: 64 }) bizType!: string
  @Column({ name: 'biz_id', type: 'bigint' }) bizId!: number
  @Column({ name: 'biz_no', type: 'varchar', length: 80, nullable: true }) bizNo!: string | null
  @Column({ name: 'started_by', type: 'bigint' }) startedBy!: number
  @Column({ type: 'varchar', length: 24, default: 'RUNNING' }) status!: string
  @Column({ name: 'current_node_id', type: 'bigint', nullable: true }) currentNodeId!: number | null
  @Column({ type: 'json', nullable: true }) snapshot!: Record<string, unknown> | null
  @Column({ type: 'tinyint', width: 1, default: 0 }) escalated!: number
  @Column({ name: 'started_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) startedAt!: Date
  @Column({ name: 'finished_at', type: 'datetime', nullable: true }) finishedAt!: Date | null
}

@Entity('flow_task', { engine: 'InnoDB' })
@Index('idx_flow_task_assignee', ['tenantId', 'assigneeId', 'status'])
@Index('idx_flow_task_instance', ['tenantId', 'instanceId'])
export class FlowTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'instance_id', type: 'bigint' }) instanceId!: number
  @Column({ name: 'node_id', type: 'bigint' }) nodeId!: number
  @Column({ name: 'assignee_id', type: 'bigint' }) assigneeId!: number
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'delegated_to', type: 'bigint', nullable: true }) delegatedTo!: number | null
  @Column({ name: 'entrust_start_at', type: 'datetime', nullable: true }) entrustStartAt!: Date | null
  @Column({ name: 'entrust_end_at', type: 'datetime', nullable: true }) entrustEndAt!: Date | null
  @Column({ name: 'added_by', type: 'bigint', nullable: true }) addedBy!: number | null
  @Column({ name: 'due_at', type: 'datetime', nullable: true }) dueAt!: Date | null
  @Column({ name: 'acted_at', type: 'datetime', nullable: true }) actedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('flow_task_log', { engine: 'InnoDB' })
@Index('idx_flow_task_log', ['tenantId', 'taskId'])
export class FlowTaskLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'task_id', type: 'bigint' }) taskId!: number
  @Column({ type: 'varchar', length: 24 }) action!: string
  @Column({ name: 'operator_id', type: 'bigint' }) operatorId!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) comment!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_notice', { engine: 'InnoDB' })
@Index('idx_oa_notice', ['tenantId', 'publishedFlag'])
export class NoticeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 200 }) title!: string
  @Column({ type: 'text', nullable: true }) content!: string | null
  @Column({ name: 'channel', type: 'varchar', length: 24, default: 'INMAIL' }) channel!: string
  @Column({ name: 'published_flag', type: 'varchar', length: 16, default: 'NO' }) publishedFlag!: string
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_chat_message', { engine: 'InnoDB' })
@Index('idx_oa_chat', ['tenantId', 'channel'])
export class ChatMessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 80 }) channel!: string
  @Column({ name: 'sender_id', type: 'bigint' }) senderId!: number
  @Column({ name: 'receiver_id', type: 'bigint', nullable: true }) receiverId!: number | null
  @Column({ type: 'text' }) content!: string
  @Column({ name: 'read_flag', type: 'varchar', length: 8, default: 'NO' }) readFlag!: string
  @Column({ name: 'read_at', type: 'datetime', nullable: true }) readAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_sensitive_word', { engine: 'InnoDB' })
@Index('uk_oa_sensitive_word', ['tenantId', 'word'], { unique: true })
export class SensitiveWordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 120 }) word!: string
  @Column({ type: 'varchar', length: 16, default: 'MEDIUM' }) level!: string
  @Column({ type: 'varchar', length: 8, default: 'YES' }) enabled!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('oa_notice_confirm', { engine: 'InnoDB' })
@Index('uk_oa_notice_confirm', ['tenantId', 'noticeId', 'userId'], { unique: true })
export class NoticeConfirmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'notice_id', type: 'bigint' }) noticeId!: number
  @Column({ name: 'user_id', type: 'bigint' }) userId!: number
  @Column({ name: 'confirmed_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) confirmedAt!: Date
}

@Entity('oa_meeting', { engine: 'InnoDB' })
@Index('idx_oa_meeting', ['tenantId', 'meetingAt'])
export class MeetingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'project_id', type: 'bigint', nullable: true }) projectId!: number | null
  @Column({ type: 'varchar', length: 200 }) title!: string
  @Column({ name: 'meeting_at', type: 'datetime', nullable: true }) meetingAt!: Date | null
  @Column({ type: 'varchar', length: 200, nullable: true }) location!: string | null
  @Column({ type: 'text', nullable: true }) minutes!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('oa_project', { engine: 'InnoDB' })
@Index('idx_oa_project', ['tenantId', 'status'])
export class ProjectEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'project_code', type: 'varchar', length: 60 }) projectCode!: string
  @Column({ name: 'project_name', type: 'varchar', length: 150 }) projectName!: string
  @Column({ name: 'owner_id', type: 'bigint', nullable: true }) ownerId!: number | null
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_task', { engine: 'InnoDB' })
@Index('idx_oa_task_project', ['tenantId', 'projectId'])
export class OaTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'project_id', type: 'bigint', nullable: true }) projectId!: number | null
  @Column({ name: 'task_name', type: 'varchar', length: 150 }) taskName!: string
  @Column({ name: 'assignee_id', type: 'bigint', nullable: true }) assigneeId!: number | null
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'TODO' }) status!: string
  @Column({ type: 'varchar', length: 24, default: 'MANUAL' }) source!: string
  @Column({ name: 'meeting_id', type: 'bigint', nullable: true }) meetingId!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_document', { engine: 'InnoDB' })
@Index('idx_oa_document', ['tenantId', 'status'])
export class DocumentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'doc_code', type: 'varchar', length: 60 }) docCode!: string
  @Column({ type: 'varchar', length: 150 }) title!: string
  @Column({ name: 'category_id', type: 'bigint', nullable: true }) categoryId!: number | null
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true }) fileUrl!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_recruit_demand', { engine: 'InnoDB' })
@Index('idx_hr_recruit', ['tenantId', 'status'])
export class RecruitDemandEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'demand_no', type: 'varchar', length: 60 }) demandNo!: string
  @Column({ name: 'position_name', type: 'varchar', length: 100 }) positionName!: string
  @Column({ name: 'headcount', type: 'int', default: 1 }) headcount!: number
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_candidate', { engine: 'InnoDB' })
@Index('idx_hr_candidate', ['tenantId', 'stage'])
export class CandidateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'demand_id', type: 'bigint', nullable: true }) demandId!: number | null
  @Column({ type: 'varchar', length: 64 }) name!: string
  @Column({ type: 'varchar', length: 30, nullable: true }) mobile!: string | null
  @Column({ type: 'varchar', length: 24, default: 'APPLIED' }) stage!: string
  @Column({ type: 'int', default: 0 }) score!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_interview', { engine: 'InnoDB' })
@Index('idx_hr_interview', ['tenantId', 'candidateId'])
export class InterviewEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'candidate_id', type: 'bigint' }) candidateId!: number
  @Column({ name: 'interviewer_id', type: 'bigint' }) interviewerId!: number
  @Column({ name: 'interview_at', type: 'datetime', nullable: true }) interviewAt!: Date | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) result!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) feedback!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_shift', { engine: 'InnoDB' })
@Index('uk_hr_shift_code', ['tenantId', 'shiftCode'], { unique: true })
export class ShiftEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'shift_code', type: 'varchar', length: 50 }) shiftCode!: string
  @Column({ name: 'shift_name', type: 'varchar', length: 100 }) shiftName!: string
  @Column({ name: 'start_time', type: 'varchar', length: 10 }) startTime!: string
  @Column({ name: 'end_time', type: 'varchar', length: 10 }) endTime!: string
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('hr_punch', { engine: 'InnoDB' })
@Index('idx_hr_punch', ['tenantId', 'employeeId', 'punchTime'])
export class PunchEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'punch_time', type: 'datetime' }) punchTime!: Date
  @Column({ type: 'varchar', length: 24, default: 'DEVICE' }) source!: string
  @Column({ type: 'varchar', length: 24, default: 'NORMAL' }) status!: string
}

@Entity('hr_leave', { engine: 'InnoDB' })
@Index('idx_hr_leave', ['tenantId', 'employeeId', 'status'])
export class LeaveEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'leave_type', type: 'varchar', length: 32 }) leaveType!: string
  @Column({ name: 'start_time', type: 'datetime' }) startTime!: Date
  @Column({ name: 'end_time', type: 'datetime' }) endTime!: Date
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 }) days!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'approver_id', type: 'bigint', nullable: true }) approverId!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_comment', type: 'varchar', length: 300, nullable: true }) approveComment!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_overtime', { engine: 'InnoDB' })
@Index('idx_hr_overtime', ['tenantId', 'employeeId'])
export class OvertimeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ type: 'decimal', precision: 10, scale: 2 }) hours!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ name: 'compensate_hours', type: 'decimal', precision: 6, scale: 2, default: 0 }) compensateHours!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'approver_id', type: 'bigint', nullable: true }) approverId!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_comment', type: 'varchar', length: 300, nullable: true }) approveComment!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_salary', { engine: 'InnoDB' })
@Index('idx_hr_salary', ['tenantId', 'period', 'employeeId'])
export class SalaryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'gross_amount', type: 'decimal', precision: 18, scale: 4 }) grossAmount!: string
  @Column({ name: 'net_amount', type: 'decimal', precision: 18, scale: 4 }) netAmount!: string
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'payslip_no', type: 'varchar', length: 60, nullable: true }) payslipNo!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_performance', { engine: 'InnoDB' })
@Index('idx_hr_performance', ['tenantId', 'period', 'employeeId'])
export class PerformanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ type: 'int', default: 0 }) score!: number
  @Column({ type: 'varchar', length: 12, default: 'C' }) level!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_training', { engine: 'InnoDB' })
@Index('idx_hr_training', ['tenantId', 'status'])
export class TrainingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'course_name', type: 'varchar', length: 150 }) courseName!: string
  @Column({ name: 'plan_date', type: 'date', nullable: true }) planDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PLANNED' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_admin_asset', { engine: 'InnoDB' })
@Index('uk_hr_admin_asset_no', ['tenantId', 'assetNo'], { unique: true })
export class AdminAssetEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'asset_no', type: 'varchar', length: 60 }) assetNo!: string
  @Column({ name: 'asset_name', type: 'varchar', length: 150 }) assetName!: string
  @Column({ name: 'holder_id', type: 'bigint', nullable: true }) holderId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'IDLE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_vehicle', { engine: 'InnoDB' })
@Index('uk_hr_vehicle_plate', ['tenantId', 'plateNo'], { unique: true })
export class VehicleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'plate_no', type: 'varchar', length: 30 }) plateNo!: string
  @Column({ name: 'vehicle_name', type: 'varchar', length: 100 }) vehicleName!: string
  @Column({ name: 'driver_id', type: 'bigint', nullable: true }) driverId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'IDLE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_vehicle_use', { engine: 'InnoDB' })
@Index('idx_hr_vehicle_use', ['tenantId', 'vehicleId'])
export class VehicleUseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'vehicle_id', type: 'bigint' }) vehicleId!: number
  @Column({ name: 'apply_user_id', type: 'bigint' }) applyUserId!: number
  @Column({ name: 'start_time', type: 'datetime' }) startTime!: Date
  @Column({ name: 'end_time', type: 'datetime' }) endTime!: Date
  @Column({ name: 'mileage', type: 'decimal', precision: 12, scale: 2, default: 0 }) mileage!: string
  @Column({ name: 'reason', type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'approver_id', type: 'bigint', nullable: true }) approverId!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_comment', type: 'varchar', length: 300, nullable: true }) approveComment!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_employee_record', { engine: 'InnoDB' })
@Index('idx_hr_employee_record', ['tenantId', 'employeeId', 'recordType'])
export class HrEmployeeRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'record_type', type: 'varchar', length: 24 }) recordType!: string
  @Column({ name: 'record_title', type: 'varchar', length: 150 }) recordTitle!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) detail!: string | null
  @Column({ name: 'effective_date', type: 'date', nullable: true }) effectiveDate!: string | null
  @Column({ name: 'expiry_date', type: 'date', nullable: true }) expiryDate!: string | null
  @Column({ name: 'approval_status', type: 'varchar', length: 24, default: 'DRAFT' }) approvalStatus!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_offer', { engine: 'InnoDB' })
@Index('idx_hr_offer', ['tenantId', 'status'])
export class HrOfferEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'candidate_id', type: 'bigint' }) candidateId!: number
  @Column({ name: 'position_name', type: 'varchar', length: 100 }) positionName!: string
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) salary!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_payroll_detail', { engine: 'InnoDB' })
@Index('uk_hr_payroll_detail', ['tenantId', 'salaryId'], { unique: true })
export class HrPayrollDetailEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'salary_id', type: 'bigint' }) salaryId!: number
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) social!: string
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 }) tax!: string
  @Column({ name: 'payslip_no', type: 'varchar', length: 60 }) payslipNo!: string
  @Column({ name: 'review_status', type: 'varchar', length: 24, default: 'PENDING' }) reviewStatus!: string
  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true }) reviewedBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_performance_review', { engine: 'InnoDB' })
@Index('uk_hr_performance_review', ['tenantId', 'performanceId'], { unique: true })
export class HrPerformanceReviewEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'performance_id', type: 'bigint' }) performanceId!: number
  @Column({ name: 'kpi_score', type: 'int', default: 0 }) kpiScore!: number
  @Column({ name: 'peer_score', type: 'int', default: 0 }) peerScore!: number
  @Column({ name: 'calibration', type: 'int', default: 0 }) calibration!: number
  @Column({ name: 'final_score', type: 'decimal', precision: 6, scale: 2, default: 0 }) finalScore!: string
  @Column({ type: 'varchar', length: 12 }) level!: string
  @Column({ name: 'appeal_status', type: 'varchar', length: 24, default: 'NONE' }) appealStatus!: string
  @Column({ name: 'appeal_reason', type: 'varchar', length: 500, nullable: true }) appealReason!: string | null
  @Column({ name: 'appeal_resolution', type: 'varchar', length: 500, nullable: true }) appealResolution!: string | null
  @Column({ name: 'appeal_handled_by', type: 'bigint', nullable: true }) appealHandledBy!: number | null
  @Column({ name: 'appeal_handled_at', type: 'datetime', nullable: true }) appealHandledAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_training_record', { engine: 'InnoDB' })
@Index('idx_hr_training_record', ['tenantId', 'trainingId', 'employeeId'])
export class HrTrainingRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'training_id', type: 'bigint' }) trainingId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'exam_score', type: 'int', default: 0 }) examScore!: number
  @Column({ name: 'passed', type: 'tinyint', width: 1, default: 0 }) passed!: number
  @Column({ name: 'certificate_no', type: 'varchar', length: 60, nullable: true }) certificateNo!: string | null
  @Column({ name: 'expire_date', type: 'date', nullable: true }) expireDate!: string | null
  @Column({ name: 'signin_at', type: 'datetime', nullable: true }) signinAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_asset_transaction', { engine: 'InnoDB' })
@Index('idx_hr_asset_transaction', ['tenantId', 'assetId', 'action'])
export class HrAssetTransactionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'asset_id', type: 'bigint' }) assetId!: number
  @Column({ type: 'varchar', length: 24 }) action!: string
  @Column({ name: 'from_status', type: 'varchar', length: 24 }) fromStatus!: string
  @Column({ name: 'to_status', type: 'varchar', length: 24 }) toStatus!: string
  @Column({ name: 'holder_id', type: 'bigint', nullable: true }) holderId!: number | null
  @Column({ type: 'varchar', length: 300, nullable: true }) note!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_punch_request', { engine: 'InnoDB' })
@Index('idx_hr_punch_request', ['tenantId', 'employeeId', 'punchDate'])
export class PunchRequestEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'punch_date', type: 'date' }) punchDate!: string
  @Column({ name: 'punch_type', type: 'varchar', length: 24, default: 'MISSING' }) punchType!: string
  @Column({ type: 'varchar', length: 500 }) reason!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'approver_id', type: 'bigint', nullable: true }) approverId!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_comment', type: 'varchar', length: 300, nullable: true }) approveComment!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_vehicle_expense', { engine: 'InnoDB' })
@Index('idx_hr_vehicle_expense', ['tenantId', 'vehicleId', 'expenseDate'])
export class VehicleExpenseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'vehicle_id', type: 'bigint' }) vehicleId!: number
  @Column({ name: 'vehicle_use_id', type: 'bigint', nullable: true }) vehicleUseId!: number | null
  @Column({ name: 'expense_type', type: 'varchar', length: 24, default: 'FUEL' }) expenseType!: string
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount!: string
  @Column({ name: 'expense_date', type: 'date' }) expenseDate!: string
  @Column({ name: 'fuel_litres', type: 'decimal', precision: 10, scale: 2, default: 0 }) fuelLitres!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'approver_id', type: 'bigint', nullable: true }) approverId!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_comment', type: 'varchar', length: 300, nullable: true }) approveComment!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_vehicle_track', { engine: 'InnoDB' })
@Index('idx_hr_vehicle_track', ['tenantId', 'vehicleId', 'trackedAt'])
export class VehicleTrackEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'vehicle_id', type: 'bigint' }) vehicleId!: number
  @Column({ name: 'vehicle_use_id', type: 'bigint', nullable: true }) vehicleUseId!: number | null
  @Column({ type: 'decimal', precision: 10, scale: 6 }) longitude!: string
  @Column({ type: 'decimal', precision: 10, scale: 6 }) latitude!: string
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) speed!: string
  @Column({ name: 'tracked_at', type: 'datetime' }) trackedAt!: Date
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_project_milestone', { engine: 'InnoDB' })
@Index('idx_oa_project_milestone', ['tenantId', 'projectId'])
export class ProjectMilestoneEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'project_id', type: 'bigint' }) projectId!: number
  @Column({ name: 'milestone_name', type: 'varchar', length: 150 }) milestoneName!: string
  @Column({ name: 'plan_date', type: 'date', nullable: true }) planDate!: string | null
  @Column({ name: 'actual_date', type: 'date', nullable: true }) actualDate!: string | null
  @Column({ name: 'owner_id', type: 'bigint', nullable: true }) ownerId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'PLANNED' }) status!: string
  @Column({ name: 'remark', type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_task_worklog', { engine: 'InnoDB' })
@Index('idx_oa_task_worklog', ['tenantId', 'taskId', 'workDate'])
export class TaskWorklogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'task_id', type: 'bigint' }) taskId!: number
  @Column({ name: 'user_id', type: 'bigint' }) userId!: number
  @Column({ name: 'work_date', type: 'date' }) workDate!: string
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) hours!: string
  @Column({ name: 'content', type: 'varchar', length: 500 }) content!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('oa_project_risk', { engine: 'InnoDB' })
@Index('idx_oa_project_risk', ['tenantId', 'projectId', 'status'])
export class ProjectRiskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'project_id', type: 'bigint' }) projectId!: number
  @Column({ name: 'risk_title', type: 'varchar', length: 200 }) riskTitle!: string
  @Column({ name: 'risk_level', type: 'varchar', length: 16, default: 'MEDIUM' }) riskLevel!: string
  @Column({ name: 'probability', type: 'int', default: 3 }) probability!: number
  @Column({ name: 'impact', type: 'int', default: 3 }) impact!: number
  @Column({ name: 'owner_id', type: 'bigint', nullable: true }) ownerId!: number | null
  @Column({ name: 'mitigation', type: 'varchar', length: 500, nullable: true }) mitigation!: string | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_performance_feedback', { engine: 'InnoDB' })
@Index('idx_hr_performance_feedback', ['tenantId', 'reviewId'])
export class HrPerformanceFeedbackEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'review_id', type: 'bigint' }) reviewId!: number
  @Column({ name: 'evaluator_id', type: 'bigint' }) evaluatorId!: number
  @Column({ name: 'feedback_type', type: 'varchar', length: 16, default: 'PEER' }) feedbackType!: string
  @Column({ type: 'int', default: 0 }) score!: number
  @Column({ name: 'comment', type: 'varchar', length: 500, nullable: true }) comment!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/* ---------------------------------------------------------- 人事审批与核算增强 */

@Entity('hr_shift_schedule', { engine: 'InnoDB' })
@Index('uk_hr_shift_schedule', ['tenantId', 'employeeId', 'workDate', 'shiftId'], { unique: true })
export class HrShiftScheduleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'work_date', type: 'date' }) workDate!: string
  @Column({ name: 'shift_id', type: 'bigint' }) shiftId!: number
  @Column({ name: 'shift_code', type: 'varchar', length: 50 }) shiftCode!: string
  @Column({ name: 'shift_name', type: 'varchar', length: 100 }) shiftName!: string
  @Column({ type: 'varchar', length: 24, default: 'PLANNED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_social_insurance', { engine: 'InnoDB' })
@Index('idx_hr_social_insurance', ['tenantId', 'salaryId'])
export class HrSocialInsuranceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'salary_id', type: 'bigint' }) salaryId!: number
  @Column({ name: 'employee_id', type: 'bigint' }) employeeId!: number
  @Column({ name: 'period', type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'item_code', type: 'varchar', length: 32 }) itemCode!: string
  @Column({ name: 'item_name', type: 'varchar', length: 60 }) itemName!: string
  @Column({ name: 'base_amount', type: 'decimal', precision: 18, scale: 2, default: 0 }) baseAmount!: string
  @Column({ name: 'company_rate', type: 'decimal', precision: 6, scale: 4, default: 0 }) companyRate!: string
  @Column({ name: 'personal_rate', type: 'decimal', precision: 6, scale: 4, default: 0 }) personalRate!: string
  @Column({ name: 'company_amount', type: 'decimal', precision: 18, scale: 2, default: 0 }) companyAmount!: string
  @Column({ name: 'personal_amount', type: 'decimal', precision: 18, scale: 2, default: 0 }) personalAmount!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_asset_stocktake', { engine: 'InnoDB' })
@Index('idx_hr_asset_stocktake', ['tenantId', 'stocktakeDate'])
export class HrAssetStocktakeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'stocktake_no', type: 'varchar', length: 60 }) stocktakeNo!: string
  @Column({ name: 'stocktake_date', type: 'date' }) stocktakeDate!: string
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'total_count', type: 'int', default: 0 }) totalCount!: number
  @Column({ name: 'diff_count', type: 'int', default: 0 }) diffCount!: number
  @Column({ name: 'remark', type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_asset_stocktake_item', { engine: 'InnoDB' })
@Index('idx_hr_asset_stocktake_item', ['tenantId', 'stocktakeId'])
export class HrAssetStocktakeItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'stocktake_id', type: 'bigint' }) stocktakeId!: number
  @Column({ name: 'asset_id', type: 'bigint' }) assetId!: number
  @Column({ name: 'book_status', type: 'varchar', length: 24 }) bookStatus!: string
  @Column({ name: 'actual_status', type: 'varchar', length: 24 }) actualStatus!: string
  @Column({ name: 'book_holder_id', type: 'bigint', nullable: true }) bookHolderId!: number | null
  @Column({ name: 'actual_holder_id', type: 'bigint', nullable: true }) actualHolderId!: number | null
  @Column({ name: 'difference', type: 'varchar', length: 24, default: 'NORMAL' }) difference!: string
  @Column({ name: 'remark', type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_asset_repair', { engine: 'InnoDB' })
@Index('idx_hr_asset_repair', ['tenantId', 'assetId', 'repairDate'])
export class HrAssetRepairEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'asset_id', type: 'bigint' }) assetId!: number
  @Column({ name: 'repair_type', type: 'varchar', length: 32, default: 'MAINTENANCE' }) repairType!: string
  @Column({ name: 'repair_reason', type: 'varchar', length: 500 }) repairReason!: string
  @Column({ name: 'vendor', type: 'varchar', length: 150, nullable: true }) vendor!: string | null
  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2, default: 0 }) amount!: string
  @Column({ name: 'repair_date', type: 'date' }) repairDate!: string
  @Column({ name: 'finished_at', type: 'datetime', nullable: true }) finishedAt!: Date | null
  @Column({ name: 'handler_id', type: 'bigint', nullable: true }) handlerId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'REPAIRING' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_performance_kpi', { engine: 'InnoDB' })
@Index('uk_hr_performance_kpi', ['tenantId', 'kpiCode'], { unique: true })
export class HrPerformanceKpiEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'kpi_code', type: 'varchar', length: 60 }) kpiCode!: string
  @Column({ name: 'kpi_name', type: 'varchar', length: 150 }) kpiName!: string
  @Column({ name: 'category', type: 'varchar', length: 50, default: 'GENERAL' }) category!: string
  @Column({ name: 'weight', type: 'decimal', precision: 5, scale: 2, default: 0 }) weight!: string
  @Column({ name: 'target_value', type: 'decimal', precision: 18, scale: 2, default: 0 }) targetValue!: string
  @Column({ name: 'unit', type: 'varchar', length: 20, default: '' }) unit!: string
  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true }) description!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('hr_performance_calibration', { engine: 'InnoDB' })
@Index('idx_hr_performance_calibration', ['tenantId', 'period'])
export class HrPerformanceCalibrationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'period', type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'calibration_date', type: 'date' }) calibrationDate!: string
  @Column({ name: 'participant_count', type: 'int', default: 0 }) participantCount!: number
  @Column({ name: 'distribution', type: 'text', nullable: true }) distribution!: string | null
  @Column({ name: 'conclusion', type: 'varchar', length: 500, nullable: true }) conclusion!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
