import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('ai_conversation', { engine: 'InnoDB' })
@Index('idx_ai_conversation_user', ['tenantId', 'userId'])
export class AiConversationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  @Column({ type: 'varchar', length: 200 })
  title!: string

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
