import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

const collab = '/collab'
const hr = '/hr'

/* ------------------------------------------------------------------ 项目 */

export interface KanbanTask {
  id: number
  taskName: string
  status: string
  assigneeId?: number | null
  dueDate?: string | null
}

export interface ProjectBoardColumn {
  status: string
  count: number
  tasks: KanbanTask[]
}

export interface ProjectBoard {
  project: { id: number; projectCode: string; projectName: string; startDate?: string | null; endDate?: string | null }
  columns: ProjectBoardColumn[]
}

export interface GanttItem {
  id: number
  name: string
  status: string
  start: string | null
  end: string | null
  offsetDays: number
  durationDays: number
  progress: number
  overdue: boolean
}

export interface GanttMilestone {
  id: number
  name: string
  date: string | null
  status: string
  offsetDays: number
  completed: boolean
}

export interface ProjectGantt {
  project: { id: number; projectName: string; startDate?: string | null; endDate?: string | null }
  start: string | null
  end: string | null
  totalDays: number
  items: GanttItem[]
  milestones: GanttMilestone[]
}

export interface Milestone {
  id: number
  projectId: number
  milestoneName: string
  planDate?: string | null
  actualDate?: string | null
  ownerId?: number | null
  status: string
  remark?: string | null
}

export interface Worklog {
  id: number
  taskId: number
  userId: number
  workDate: string
  hours: string
  content: string
}

export interface ProjectRisk {
  id: number
  projectId: number
  riskTitle: string
  riskLevel: string
  probability: number
  impact: number
  ownerId?: number | null
  mitigation?: string | null
  status: string
}

export interface ReminderItem {
  type: string
  targetType: string
  targetId: number
  title: string
  dueDate: string | null
  days: number
  level: string
}

export function fetchProjectBoard(projectId: number) {
  return request<ProjectBoard>({ url: `${collab}/projects/${projectId}/board`, method: 'get' })
}

export function fetchProjectGantt(projectId: number) {
  return request<ProjectGantt>({ url: `${collab}/projects/${projectId}/gantt`, method: 'get' })
}

export function fetchMilestones(params: PageQuery & { projectId?: number }) {
  return request<PageResult<Milestone>>({ url: `${collab}/milestones`, method: 'get', params })
}

export function createMilestone(data: Record<string, unknown>) {
  return request<Milestone>({ url: `${collab}/milestones`, method: 'post', data })
}

export function updateMilestone(id: number, data: Record<string, unknown>) {
  return request<Milestone>({ url: `${collab}/milestones/${id}`, method: 'patch', data })
}

export function fetchWorklogs(params: PageQuery & { taskId?: number }) {
  return request<PageResult<Worklog>>({ url: `${collab}/worklogs`, method: 'get', params })
}

export function createWorklog(data: Record<string, unknown>) {
  return request<Worklog>({ url: `${collab}/worklogs`, method: 'post', data })
}

export function removeWorklog(id: number) {
  return request<void>({ url: `${collab}/worklogs/${id}`, method: 'delete' })
}

export function fetchProjectRisks(params: PageQuery & { projectId?: number }) {
  return request<PageResult<ProjectRisk>>({ url: `${collab}/project-risks`, method: 'get', params })
}

export function createProjectRisk(data: Record<string, unknown>) {
  return request<ProjectRisk>({ url: `${collab}/project-risks`, method: 'post', data })
}

export function updateProjectRisk(id: number, data: Record<string, unknown>) {
  return request<ProjectRisk>({ url: `${collab}/project-risks/${id}`, method: 'patch', data })
}

export function fetchReminders(params: Partial<PageQuery> & { type?: string; thresholdDays?: number }) {
  return request<ReminderItem[]>({ url: `${collab}/reminders`, method: 'get', params })
}

/* ------------------------------------------------------------------ 招聘 */

export interface PipelineCandidate {
  id: number
  name: string
  phone?: string | null
  stage: string
  position?: string | null
}

export interface PipelineColumn {
  stage: string
  count: number
  candidates: PipelineCandidate[]
}

export function fetchRecruitPipeline(params: PageQuery) {
  return request<PipelineColumn[]>({ url: `${hr}/recruit/pipeline`, method: 'get', params })
}

export function moveCandidateStage(id: number, data: { stage: string; remark?: string }) {
  return request<PipelineCandidate>({ url: `${hr}/candidates/${id}/stage`, method: 'post', data })
}

export function talentAction(id: number, data: { action: 'IN' | 'REUSE' | 'DISCARD'; remark?: string }) {
  return request<PipelineCandidate>({ url: `${hr}/candidates/${id}/talent`, method: 'post', data })
}

export function approveOffer(id: number, data: { comment?: string } = {}) {
  return request<Record<string, unknown>>({ url: `${hr}/offers/${id}/approve`, method: 'post', data })
}

export interface Offer {
  id: number
  candidateId: number
  salary: string
  budget?: string | null
  status: string
  approvedBy?: number | null
}

export function fetchOffers(params: PageQuery & { status?: string }) {
  return request<PageResult<Offer>>({ url: `${hr}/offers`, method: 'get', params })
}

export function rejectOffer(id: number, data: { comment?: string } = {}) {
  return request<Record<string, unknown>>({ url: `${hr}/offers/${id}/reject`, method: 'post', data })
}

/* ------------------------------------------------------------------ 车队 */

export interface DispatchResult {
  vehicleId: number | null
  use: Record<string, unknown> | null
  conflicted: Array<{ vehicleId: number; startTime: string; endTime: string }>
}

export function dispatchVehicle(data: Record<string, unknown>) {
  return request<DispatchResult>({ url: `${hr}/vehicles/dispatch`, method: 'post', data })
}

/* ------------------------------------------------------------------ 绩效 / 培训 */

export interface PerformanceFeedback {
  id: number
  reviewId: number
  evaluatorId: number
  feedbackType: string
  score: number
  comment?: string | null
}

export function fetchPerformanceFeedbacks(reviewId: number) {
  return request<PerformanceFeedback[]>({ url: `${hr}/performance-reviews/${reviewId}/feedbacks`, method: 'get' })
}

export function createPerformanceFeedback(reviewId: number, data: Record<string, unknown>) {
  return request<PerformanceFeedback>({ url: `${hr}/performance-reviews/${reviewId}/feedbacks`, method: 'post', data })
}

export function signinTraining(trainingId: number, data: { employeeId: number }) {
  return request<Record<string, unknown>>({ url: `${hr}/trainings/${trainingId}/signin`, method: 'post', data })
}

export function scoreTraining(trainingId: number, data: { employeeId: number; examScore: number; expireDate?: string }) {
  return request<Record<string, unknown>>({ url: `${hr}/trainings/${trainingId}/score`, method: 'post', data })
}
