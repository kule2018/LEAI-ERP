import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module'
import { NotifyModule } from '../notify/notify.module'
import { OpsModule } from '../ops/ops.module'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { FlowController, HrController, OaController } from './collaboration.controller'
import { CollaborationService } from './collaboration.service'
import { HrLaborContractController } from './hr-labor-contract.controller'
import { HrLaborContractService } from './hr-labor-contract.service'
import { HrLaborContractEntity } from './entities/hr-labor-contract.entity'
import { EmployeeEntity } from '../master-data/entities/employee.entity'
import { FlowBizCallbackRegistryModule } from './flow-biz-callback'
import {
  AdminAssetEntity, CandidateEntity, ChatMessageEntity, DocumentEntity, FlowDefinitionEntity,
  FlowDefinitionVersionEntity, FlowInstanceEntity, FlowNodeEntity, FlowTaskEntity, FlowTaskLogEntity, HrAssetRepairEntity,
  HrAssetStocktakeEntity, HrAssetStocktakeItemEntity, HrAssetTransactionEntity,
  HrEmployeeRecordEntity, HrOfferEntity, HrPayrollDetailEntity, HrPerformanceCalibrationEntity,
  HrPerformanceFeedbackEntity, HrPerformanceKpiEntity, HrPerformanceReviewEntity, HrShiftScheduleEntity,
  HrSocialInsuranceEntity, HrTrainingRecordEntity, InterviewEntity, LeaveEntity, MeetingEntity, NoticeConfirmEntity,
  NoticeEntity, OaTaskEntity, OvertimeEntity, PerformanceEntity, ProjectEntity, ProjectMilestoneEntity,
  ProjectRiskEntity, PunchEntity, PunchRequestEntity, RecruitDemandEntity, SalaryEntity, SensitiveWordEntity,
  ShiftEntity, TaskWorklogEntity, TrainingEntity, VehicleEntity, VehicleExpenseEntity,
  VehicleTrackEntity, VehicleUseEntity
} from './entities/collaboration.entities'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FlowDefinitionEntity, FlowDefinitionVersionEntity, FlowNodeEntity, FlowInstanceEntity, FlowTaskEntity, FlowTaskLogEntity,
      NoticeEntity, ChatMessageEntity, ProjectEntity, OaTaskEntity, DocumentEntity,
      RecruitDemandEntity, CandidateEntity, InterviewEntity, ShiftEntity, PunchEntity, LeaveEntity,
      OvertimeEntity, SalaryEntity, PerformanceEntity, TrainingEntity, AdminAssetEntity,
      VehicleEntity, VehicleUseEntity, HrEmployeeRecordEntity, HrOfferEntity,
      HrPayrollDetailEntity, HrPerformanceReviewEntity, HrTrainingRecordEntity,
      HrAssetTransactionEntity, SensitiveWordEntity, NoticeConfirmEntity, MeetingEntity,
      PunchRequestEntity, VehicleExpenseEntity, VehicleTrackEntity,
      ProjectMilestoneEntity, TaskWorklogEntity, ProjectRiskEntity, HrPerformanceFeedbackEntity,
      HrShiftScheduleEntity, HrSocialInsuranceEntity, HrAssetStocktakeEntity, HrAssetStocktakeItemEntity,
      HrAssetRepairEntity, HrPerformanceKpiEntity,       HrPerformanceCalibrationEntity,
      HrLaborContractEntity,
      EmployeeEntity,
      TenantEntity
    ]),
    AuditModule,
    NotifyModule,
    OpsModule,
    FlowBizCallbackRegistryModule
  ],
  controllers: [FlowController, OaController, HrController, HrLaborContractController],
  providers: [CollaborationService, HrLaborContractService],
  exports: [CollaborationService, HrLaborContractService, TypeOrmModule]
})
export class CollaborationModule {}
