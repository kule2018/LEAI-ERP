import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  buildContractReminder, canRenewContract, canTerminateContract, deriveExpiryDate,
  evaluateContract, isContractType, summarizeContractExpiry, type ContractReminder, type ContractType
} from '../../common/labor-contract-rules'
import { AuditService } from '../audit/audit.service'
import { EmployeeEntity } from '../master-data/entities/employee.entity'
import { HrLaborContractEntity } from './entities/hr-labor-contract.entity'
import {
  CreateLaborContractDto, QueryLaborContractDto, RenewLaborContractDto, TerminateLaborContractDto
} from './hr-labor-contract.dto'

/**
 * 劳动合同服务：
 * - 合同登记（固定期限 / 无固定期限 / 外包 / 实习 / 劳务）
 * - 到期提醒清单与汇总
 * - 续签与解除（留审计）
 */
@Injectable()
export class HrLaborContractService {
  constructor(
    @InjectRepository(HrLaborContractEntity) private readonly contractRepo: Repository<HrLaborContractEntity>,
    @InjectRepository(EmployeeEntity) private readonly employeeRepo: Repository<EmployeeEntity>,
    private readonly auditService: AuditService
  ) {}

  /** 合同列表 */
  async listContracts(query: QueryLaborContractDto, user: JwtUser): Promise<PageResult<HrLaborContractEntity>> {
    const where = scopeWhere<HrLaborContractEntity>({
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.contractType ? { contractType: query.contractType } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.contractRepo.findAndCount({
      where,
      order: { expiryDate: 'ASC', id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 登记合同 */
  async createContract(dto: CreateLaborContractDto, user: JwtUser): Promise<HrLaborContractEntity> {
    if (!isContractType(dto.contractType)) throw new BadRequestException(`不支持的合同类型：${dto.contractType}`)
    const employee = await this.employeeRepo.findOne({ where: { id: dto.employeeId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!employee) throw new NotFoundException('员工不存在')
    const exists = await this.contractRepo.findOne({ where: { tenantId: user.tenantId, contractNo: dto.contractNo } })
    if (exists) throw new BadRequestException(`合同编号已存在：${dto.contractNo}`)

    const expiryDate = dto.expiryDate
      ?? deriveExpiryDate(dto.contractType, dto.effectiveDate, dto.duration ?? null)
    if (dto.contractType !== 'OPEN_ENDED' && !expiryDate) {
      throw new BadRequestException('固定期限合同必须提供到期日或合同期限')
    }
    const contract = await this.contractRepo.save(this.contractRepo.create({
      tenantId: user.tenantId,
      employeeId: dto.employeeId,
      contractNo: dto.contractNo,
      contractType: dto.contractType,
      partyA: dto.partyA ?? null,
      signDate: dto.signDate ?? null,
      effectiveDate: dto.effectiveDate,
      expiryDate,
      remindDays: dto.remindDays ?? 30,
      status: this.suggestStatus(dto.effectiveDate, expiryDate),
      renewedFromId: null,
      terminateDate: null,
      terminateReason: null,
      salary: dto.salary ?? '0',
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({
      bizType: 'hr_labor_contract', bizId: contract.id, action: 'CREATE_LABOR_CONTRACT',
      afterValue: { contractNo: contract.contractNo, employeeId: contract.employeeId, expiryDate: contract.expiryDate }
    }, user)
    return contract
  }

  /** 续签合同：原合同置 RENEWED，生成新合同 */
  async renewContract(id: number, dto: RenewLaborContractDto, user: JwtUser): Promise<HrLaborContractEntity> {
    const origin = await this.findContract(id, user)
    const check = canRenewContract({ status: origin.status, effectiveDate: origin.effectiveDate, expiryDate: origin.expiryDate })
    if (!check.allowed) throw new BadRequestException(check.reason)
    const contractNo = dto.contractNo ?? this.nextContractNo(origin.contractNo)
    const exists = await this.contractRepo.findOne({ where: { tenantId: user.tenantId, contractNo } })
    if (exists) throw new BadRequestException(`合同编号已存在：${contractNo}`)
    const expiryDate = dto.expiryDate
      ?? deriveExpiryDate(origin.contractType as ContractType, dto.effectiveDate, dto.duration ?? null)
    if (origin.contractType !== 'OPEN_ENDED' && !expiryDate) {
      throw new BadRequestException('续签合同必须提供到期日或合同期限')
    }
    const renewed = await this.contractRepo.save(this.contractRepo.create({
      tenantId: user.tenantId,
      employeeId: origin.employeeId,
      contractNo,
      contractType: origin.contractType,
      partyA: origin.partyA,
      signDate: origin.signDate,
      effectiveDate: dto.effectiveDate,
      expiryDate,
      remindDays: origin.remindDays,
      status: this.suggestStatus(dto.effectiveDate, expiryDate),
      renewedFromId: origin.id,
      terminateDate: null,
      terminateReason: null,
      salary: dto.salary !== undefined ? dto.salary.toFixed(2) : origin.salary,
      remark: dto.remark ?? origin.remark,
      createdBy: user.userId
    }))
    origin.status = 'RENEWED'
    origin.updatedAt = new Date()
    await this.contractRepo.save(origin)
    await this.auditService.record({
      bizType: 'hr_labor_contract', bizId: renewed.id, action: 'RENEW_LABOR_CONTRACT',
      afterValue: { fromContractId: origin.id, contractNo: renewed.contractNo, expiryDate: renewed.expiryDate }
    }, user)
    return renewed
  }

  /** 解除合同 */
  async terminateContract(id: number, dto: TerminateLaborContractDto, user: JwtUser): Promise<HrLaborContractEntity> {
    const contract = await this.findContract(id, user)
    const check = canTerminateContract({ status: contract.status, effectiveDate: contract.effectiveDate, expiryDate: contract.expiryDate })
    if (!check.allowed) throw new BadRequestException(check.reason)
    contract.status = 'TERMINATED'
    contract.terminateDate = dto.terminateDate
    contract.terminateReason = dto.reason
    contract.updatedAt = new Date()
    const saved = await this.contractRepo.save(contract)
    await this.auditService.record({
      bizType: 'hr_labor_contract', bizId: saved.id, action: 'TERMINATE_LABOR_CONTRACT',
      afterValue: { terminateDate: dto.terminateDate, reason: dto.reason }
    }, user)
    return saved
  }

  /** 合同到期清单：进入提醒窗口的合同及汇总 */
  async expiringContracts(query: QueryLaborContractDto, user: JwtUser): Promise<{
    list: ContractReminder[]
    summary: ReturnType<typeof summarizeContractExpiry>
  }> {
    const where = scopeWhere<HrLaborContractEntity>({
      tenantId: user.tenantId,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.contractType ? { contractType: query.contractType } : {})
    }, user, { ownerField: 'createdBy' })
    const contracts = await this.contractRepo.find({
      where: { ...where, status: In(['EFFECTIVE', 'EXPIRED']) }
    })
    const employees = await this.employeeRepo.find({ where: { tenantId: user.tenantId } })
    const employeeNames = new Map(employees.map((item) => [item.id, item.name]))
    const now = new Date()
    const reminders = contracts
      .map((contract) => buildContractReminder({
        id: contract.id,
        contractNo: contract.contractNo,
        employeeId: contract.employeeId,
        employeeName: employeeNames.get(contract.employeeId) ?? '',
        contractType: contract.contractType,
        expiryDate: contract.expiryDate ?? '',
        status: contract.status,
        effectiveDate: contract.effectiveDate
      }, now, contract.remindDays))
      .filter((item): item is ContractReminder => item !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft)
    const filtered = query.expiringOnly === 'true'
      ? reminders.filter((item) => item.daysLeft >= 0)
      : reminders
    return { list: filtered, summary: summarizeContractExpiry(filtered) }
  }

  /** 合同状态刷新：将到期合同标记为 EXPIRED（供定时任务调用） */
  async refreshExpiredStatus(user: JwtUser): Promise<{ updated: number }> {
    const contracts = await this.contractRepo.find({
      where: { tenantId: user.tenantId, status: In(['EFFECTIVE', 'DRAFT']) }
    })
    const now = new Date()
    let updated = 0
    for (const contract of contracts) {
      const evaluation = evaluateContract(
        { status: contract.status, effectiveDate: contract.effectiveDate, expiryDate: contract.expiryDate },
        now,
        contract.remindDays
      )
      if (evaluation.suggestStatus !== contract.status) {
        contract.status = evaluation.suggestStatus
        contract.updatedAt = new Date()
        await this.contractRepo.save(contract)
        updated += 1
      }
    }
    if (updated > 0) {
      await this.auditService.record({
        bizType: 'hr_labor_contract', bizId: 0, action: 'REFRESH_LABOR_CONTRACT_STATUS',
        afterValue: { updated }
      }, user)
    }
    return { updated }
  }

  /* ------------------------------ 内部方法 ------------------------------ */

  private async findContract(id: number, user: JwtUser): Promise<HrLaborContractEntity> {
    const contract = await this.contractRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!contract) throw new NotFoundException('劳动合同不存在')
    return contract
  }

  /** 根据生效日与到期日推导合同初始状态 */
  private suggestStatus(effectiveDate: string, expiryDate: string | null): string {
    const now = new Date()
    const effective = new Date(`${effectiveDate.slice(0, 10)}T00:00:00Z`)
    if (Number.isFinite(effective.getTime()) && effective.getTime() > now.getTime()) return 'DRAFT'
    if (!expiryDate) return 'EFFECTIVE'
    const expiry = new Date(`${expiryDate.slice(0, 10)}T00:00:00Z`)
    if (Number.isFinite(expiry.getTime()) && expiry.getTime() < now.getTime()) return 'EXPIRED'
    return 'EFFECTIVE'
  }

  /** 续签合同编号：原编号 + -R + 时间戳后缀 */
  private nextContractNo(originNo: string): string {
    const suffix = randomBytes(2).toString('hex').toUpperCase()
    return `${originNo}-R${suffix}`.slice(0, 40)
  }
}
