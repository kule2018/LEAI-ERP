import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { ObjectStorageService } from '../../common/object-storage.service'
import { AuditService } from '../audit/audit.service'
import { QueryFileDto } from './dto'
import { FileEntity } from './entities/file.entity'

export interface UploadedFileInput {
  originalname: string
  buffer: Buffer
  mimetype: string
  size: number
}

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(FileEntity) private readonly repo: Repository<FileEntity>,
    private readonly auditService: AuditService,
    private readonly storage: ObjectStorageService
  ) {}

  async list(query: QueryFileDto, user: JwtUser): Promise<PageResult<FileEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { fileName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async upload(file: UploadedFileInput | undefined, user: JwtUser): Promise<FileEntity> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('未接收到文件')
    }
    if (file.size > 52428800) {
      throw new BadRequestException('文件大小超过 50MB')
    }

    const month = new Date().toISOString().slice(0, 7).replace('-', '')
    const extension = path.extname(file.originalname).slice(0, 20)
    const unique = randomBytes(8).toString('hex')
    const storedName = `${unique}${extension}`
    const objectKey = `${user.tenantId}/${month}/${storedName}`
    const stored = await this.storage.put(objectKey, file.buffer, file.mimetype || 'application/octet-stream')

    const entity = this.repo.create({
      tenantId: user.tenantId,
      fileName: file.originalname.slice(0, 255),
      objectKey,
      mimeType: file.mimetype || null,
      sizeBytes: file.size,
      storageDriver: stored.driver,
      url: stored.url,
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'file', bizId: saved.id, action: 'UPLOAD_FILE', afterValue: saved }, user)
    return saved
  }

  /** 校验租户归属并返回文件元信息 */
  async findFile(id: number, user: JwtUser): Promise<FileEntity> {
    const file = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!file) throw new NotFoundException('文件不存在')
    return file
  }

  /** 生成带时效的下载/预览地址（S3 为签名 URL，LOCAL 为静态地址） */
  async signedUrl(id: number, user: JwtUser, expiresSeconds = 900): Promise<{ url: string; fileName: string; mimeType: string | null; driver: string }> {
    const file = await this.findFile(id, user)
    const url = await this.storage.getSignedUrl(file.objectKey, expiresSeconds)
    await this.auditService.record({ bizType: 'file', bizId: id, action: 'SIGNED_FILE_URL', afterValue: { driver: file.storageDriver, expiresSeconds } }, user)
    return { url, fileName: file.fileName, mimeType: file.mimeType, driver: file.storageDriver }
  }

  /** 读取文件内容（用于后端导出/转换） */
  async readFile(id: number, user: JwtUser): Promise<{ file: FileEntity; buffer: Buffer }> {
    const file = await this.findFile(id, user)
    return { file, buffer: await this.storage.getObject(file.objectKey) }
  }
}
