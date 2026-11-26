import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('ai_message', { engine: 'InnoDB' })
@Index('idx_ai_message_conversation', ['tenantId', 'conversationId'])
export class AiMessageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'conversation_id', type: 'bigint' })
  conversationId!: number

  @Column({ type: 'varchar', length: 16 })
  role!: string

  @Column({ type: 'text' })
  content!: string

  @Column({ name: 'tool_calls', type: 'json', nullable: true })
  toolCalls!: Record<string, unknown>[] | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
