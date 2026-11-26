import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import {
  buildLanguagePackage, diffLanguagePackage, mergeFallback, validateLangEntries,
  type LanguagePackage
} from '../../common/i18n-rules'
import { AuditService } from '../audit/audit.service'
import { SystemLangEntity } from './entities/system-lang.entity'
import { QueryLangDto, UpsertLangDto } from './system-lang.dto'

@Injectable()
export class SystemLangService {
  constructor(
    @InjectRepository(SystemLangEntity) private readonly langRepo: Repository<SystemLangEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryLangDto, user: JwtUser): Promise<PageResult<SystemLangEntity>> {
    const qb = this.langRepo.createQueryBuilder('lang').where('lang.tenant_id = :tenantId', { tenantId: user.tenantId })
    if (query.langCode) qb.andWhere('lang.lang_code = :langCode', { langCode: query.langCode })
    if (query.keyword) {
      qb.andWhere('(lang.resource_key LIKE :kw OR lang.resource_value LIKE :kw OR lang.locale_name LIKE :kw)', {
        kw: `%${query.keyword}%`
      })
    }
    qb.orderBy('lang.lang_code', 'ASC').addOrderBy('lang.resource_key', 'ASC')
    const [list, total] = await qb.skip((query.page - 1) * query.pageSize).take(query.pageSize).getManyAndCount()
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 批量 upsert 语言条目 */
  async upsert(dto: UpsertLangDto, user: JwtUser): Promise<{ created: number; updated: number; total: number }> {
    const entries = dto.entries.map((item) => ({
      langCode: item.langCode,
      resourceKey: item.resourceKey,
      resourceValue: item.resourceValue,
      fallbackLang: item.fallbackLang ?? null
    }))
    const check = validateLangEntries(entries)
    if (!check.ok) throw new BadRequestException(check.reason)
    const existing = await this.langRepo.find({
      where: entries.map((item) => ({ tenantId: user.tenantId, langCode: item.langCode, resourceKey: item.resourceKey }))
    })
    const existingMap = new Map(existing.map((item) => [`${item.langCode}::${item.resourceKey}`, item]))
    let created = 0
    let updated = 0
    for (const entry of entries) {
      const key = `${entry.langCode}::${entry.resourceKey}`
      const current = existingMap.get(key)
      if (current) {
        current.resourceValue = entry.resourceValue
        current.fallbackLang = entry.fallbackLang
        await this.langRepo.save(current)
        updated++
      } else {
        await this.langRepo.save(this.langRepo.create({
          tenantId: user.tenantId,
          langCode: entry.langCode,
          localeName: dto.entries.find((item) => item.langCode === entry.langCode)?.localeName ?? entry.langCode,
          resourceKey: entry.resourceKey,
          resourceValue: entry.resourceValue,
          fallbackLang: entry.fallbackLang,
          createdBy: user.userId
        }))
        created++
      }
    }
    await this.auditService.record({
      bizType: 'sys_lang', bizId: 0, action: 'UPSERT_LANG',
      afterValue: { created, updated, total: entries.length }
    }, user)
    return { created, updated, total: entries.length }
  }

  /** 语言包列表（含 fallback 合并），前端可直接加载 */
  async packages(user: JwtUser): Promise<LanguagePackage[]> {
    const rows = await this.langRepo.find({ where: { tenantId: user.tenantId, status: 'ENABLED' }, order: { langCode: 'ASC' } })
    const byLang = new Map<string, SystemLangEntity[]>()
    for (const row of rows) {
      const list = byLang.get(row.langCode) ?? []
      list.push(row)
      byLang.set(row.langCode, list)
    }
    const localeNames: Record<string, string> = {}
    for (const row of rows) localeNames[row.langCode] = row.localeName
    const result: LanguagePackage[] = []
    for (const list of byLang.values()) {
      const pkg = buildLanguagePackage(list.map((item) => ({
        langCode: item.langCode,
        resourceKey: item.resourceKey,
        resourceValue: item.resourceValue,
        fallbackLang: item.fallbackLang
      })), localeNames)
      const fallbackCode = list[0]?.fallbackLang
      const fallbackPkg = fallbackCode && byLang.has(fallbackCode)
        ? buildLanguagePackage((byLang.get(fallbackCode) ?? []).map((item) => ({
          langCode: item.langCode,
          resourceKey: item.resourceKey,
          resourceValue: item.resourceValue
        })), localeNames)
        : null
      result.push(mergeFallback(pkg, fallbackPkg))
    }
    return result
  }

  /** 与目标语言包比较差异 */
  async diff(langCode: string, incoming: Record<string, string>, user: JwtUser): Promise<ReturnType<typeof diffLanguagePackage>> {
    const rows = await this.langRepo.find({ where: { tenantId: user.tenantId, langCode } })
    const current = buildLanguagePackage(rows.map((item) => ({
      langCode: item.langCode,
      resourceKey: item.resourceKey,
      resourceValue: item.resourceValue
    })))
    return diffLanguagePackage(current.values, incoming)
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const row = await this.langRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!row) throw new NotFoundException('语言条目不存在')
    await this.langRepo.remove(row)
    await this.auditService.record({ bizType: 'sys_lang', bizId: id, action: 'DELETE_LANG', beforeValue: row }, user)
  }
}
