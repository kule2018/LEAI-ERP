import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface FlowDefinition { id: number; code: string; flowName: string; bizType: string; version: number; isActive: number; formSchema?: { fields?: FormField[]; title?: string } | null }
export interface FormField { key: string; label: string; type?: string; required?: boolean; options?: string }
export interface FlowNode { id: number; nodeCode: string; nodeName: string; nodeType: string; assigneeRule: string | null; conditionExpr: string | null; approvalMode: string; timeoutHours: number | null; sortNo: number }
export interface FlowDefinitionVersion { id: number; definitionId: number; version: number; formSchema: { fields?: FormField[] } | null; nodes: Array<Record<string, unknown>> | null; remark: string | null; changedBy: number | null; changedAt: string }
export interface FlowInstance { id: number; bizType: string; bizId: number; bizNo: string | null; status: string; startedAt: string }
export interface FlowTask { id: number; instanceId: number; nodeId: number; assigneeId: number; status: string; delegatedTo: number | null; addedBy: number | null; dueAt: string | null; actedAt: string | null }
export interface Notice { id: number; title: string; content: string | null; channel: string; publishedFlag: string }
export interface ChatMessage { id: number; channel: string; senderId: number; receiverId: number | null; content: string; createdAt: string }
export interface Project { id: number; projectCode: string; projectName: string; ownerId: number | null; status: string }
export interface OaTask { id: number; projectId: number | null; taskName: string; assigneeId: number | null; dueDate: string | null; status: string }
export interface Document { id: number; docCode: string; title: string; version: number; fileUrl: string | null; status: string }
export interface Recruit { id: number; demandNo: string; positionName: string; headcount: number; status: string }
export interface Candidate { id: number; demandId: number | null; name: string; mobile: string | null; stage: string; score: number }
export interface Interview { id: number; candidateId: number; interviewerId: number; interviewAt: string | null; result: string; feedback: string | null }
export interface Shift { id: number; shiftCode: string; shiftName: string; startTime: string; endTime: string }
export interface Punch { id: number; employeeId: number; punchTime: string; source: string; status: string }
export interface Leave { id: number; employeeId: number; leaveType: string; startTime: string; endTime: string; status: string }
export interface Overtime { id: number; employeeId: number; hours: string; reason: string | null; status: string }
export interface Salary { id: number; employeeId: number; period: string; grossAmount: string; netAmount: string; status: string }
export interface Performance { id: number; employeeId: number; period: string; score: number; level: string }
export interface Training { id: number; courseName: string; planDate: string | null; status: string }
export interface AdminAsset { id: number; assetNo: string; assetName: string; holderId: number | null; status: string }
export interface Vehicle { id: number; plateNo: string; vehicleName: string; driverId: number | null; status: string }
export interface VehicleUse { id: number; vehicleId: number; applyUserId: number; startTime: string; endTime: string; status: string }

export interface CollabQuery extends PageQuery { status?: string; period?: string; assigneeId?: number; onlyOverdue?: boolean; keyword?: string; bizType?: string }

const base = '/collab'

export function fetchFlowDefinitions(params: CollabQuery) { return request<PageResult<FlowDefinition>>({ url: `${base}/flows/definitions`, method: 'get', params }) }
export function createFlowDefinition(data: Record<string, unknown>) { return request<FlowDefinition>({ url: `${base}/flows/definitions`, method: 'post', data }) }
export function fetchFlowDefinitionNodes(id: number) { return request<FlowNode[]>({ url: `${base}/flows/definitions/${id}/nodes`, method: 'get' }) }
export function updateFlowDefinition(id: number, data: Record<string, unknown>) { return request<FlowDefinition>({ url: `${base}/flows/definitions/${id}`, method: 'put', data }) }
export function fetchFlowDefinitionVersions(id: number) { return request<FlowDefinitionVersion[]>({ url: `${base}/flows/definitions/${id}/versions`, method: 'get' }) }
export function fetchFlowInstances(params: CollabQuery) { return request<PageResult<FlowInstance>>({ url: `${base}/flows/instances`, method: 'get', params }) }
export function startFlow(data: Record<string, unknown>) { return request<FlowInstance>({ url: `${base}/flows/start`, method: 'post', data }) }
export function fetchTodo(params: CollabQuery) { return request<PageResult<FlowTask>>({ url: `${base}/flows/todo`, method: 'get', params }) }
export function fetchDone(params: CollabQuery) { return request<PageResult<FlowTask>>({ url: `${base}/flows/done`, method: 'get', params }) }
export function actFlowTask(id: number, data: Record<string, unknown>) { return request<FlowTask>({ url: `${base}/flows/tasks/${id}/act`, method: 'post', data }) }
export function delegateFlowTask(id: number, data: Record<string, unknown>) { return request<FlowTask>({ url: `${base}/flows/tasks/${id}/delegate`, method: 'post', data }) }
export function addSignFlowTask(id: number, data: Record<string, unknown>) { return request<FlowTask>({ url: `${base}/flows/tasks/${id}/add-sign`, method: 'post', data }) }
export function fetchFlowDetail(id: number) { return request<{ instance: FlowInstance; nodes: Array<Record<string, unknown>>; tasks: FlowTask[]; logs: Array<Record<string, unknown>> }>({ url: `${base}/flows/instances/${id}`, method: 'get' }) }
export function escalateFlows() { return request<{ escalated: number }>({ url: `${base}/flows/escalate`, method: 'post' }) }

export interface FlowMonitorSummary { total: number; finished: number; running: number; avgDurationHours: number; maxDurationHours: number }
export interface FlowTypeDuration { bizType: string; total: number; finished: number; avgDurationHours: number; maxDurationHours: number }
export interface FlowBottleneck { nodeId: number; nodeName: string; taskCount: number; avgDurationHours: number; maxDurationHours: number }
export interface FlowTimeoutRow {
  instanceId: number; bizType: string; bizNo: string | null; nodeId: number; nodeName: string
  assigneeId: number; waitHours: number; timeoutHours: number; overdueHours: number
}
export interface FlowMonitorAnalysis {
  summary: FlowMonitorSummary
  byType: FlowTypeDuration[]
  bottlenecks: FlowBottleneck[]
  timeouts: FlowTimeoutRow[]
}
export function fetchFlowMonitorAnalysis(params: CollabQuery) { return request<FlowMonitorAnalysis>({ url: `${base}/flows/monitor/analysis`, method: 'get', params }) }
export function exportFlowMonitorAnalysis(data: Record<string, unknown>) {
  return request<FlowMonitorAnalysis & { exportedAt: string }>({ url: `${base}/flows/monitor/export`, method: 'post', data })
}

export function fetchNotices(params: CollabQuery) { return request<PageResult<Notice>>({ url: `${base}/notices`, method: 'get', params }) }
export function createNotice(data: Record<string, unknown>) { return request<Notice>({ url: `${base}/notices`, method: 'post', data }) }
export function fetchChats(channel = 'general') { return request<ChatMessage[]>({ url: `${base}/chats`, method: 'get', params: { channel } }) }
export function createChat(data: Record<string, unknown>) { return request<ChatMessage>({ url: `${base}/chats`, method: 'post', data }) }
export function fetchProjects(params: CollabQuery) { return request<PageResult<Project>>({ url: `${base}/projects`, method: 'get', params }) }
export function createProject(data: Record<string, unknown>) { return request<Project>({ url: `${base}/projects`, method: 'post', data }) }
export function fetchOaTasks(params: CollabQuery) { return request<PageResult<OaTask>>({ url: `${base}/tasks`, method: 'get', params }) }
export function createOaTask(data: Record<string, unknown>) { return request<OaTask>({ url: `${base}/tasks`, method: 'post', data }) }
export function fetchDocuments(params: CollabQuery) { return request<PageResult<Document>>({ url: `${base}/documents`, method: 'get', params }) }
export function createDocument(data: Record<string, unknown>) { return request<Document>({ url: `${base}/documents`, method: 'post', data }) }

const hr = '/hr'

export function fetchRecruits(params: CollabQuery) { return request<PageResult<Recruit>>({ url: `${hr}/recruits`, method: 'get', params }) }
export function createRecruit(data: Record<string, unknown>) { return request<Recruit>({ url: `${hr}/recruits`, method: 'post', data }) }
export function fetchCandidates(params: CollabQuery) { return request<PageResult<Candidate>>({ url: `${hr}/candidates`, method: 'get', params }) }
export function createCandidate(data: Record<string, unknown>) { return request<Candidate>({ url: `${hr}/candidates`, method: 'post', data }) }
export function fetchInterviews(params: CollabQuery) { return request<PageResult<Interview>>({ url: `${hr}/interviews`, method: 'get', params }) }
export function createInterview(data: Record<string, unknown>) { return request<Interview>({ url: `${hr}/interviews`, method: 'post', data }) }
export function fetchShifts(params: CollabQuery) { return request<PageResult<Shift>>({ url: `${hr}/shifts`, method: 'get', params }) }
export function createShift(data: Record<string, unknown>) { return request<Shift>({ url: `${hr}/shifts`, method: 'post', data }) }
export function fetchPunches(params: CollabQuery) { return request<PageResult<Punch>>({ url: `${hr}/punches`, method: 'get', params }) }
export function createPunch(data: Record<string, unknown>) { return request<Punch>({ url: `${hr}/punches`, method: 'post', data }) }
export function fetchLeaves(params: CollabQuery) { return request<PageResult<Leave>>({ url: `${hr}/leaves`, method: 'get', params }) }
export function createLeave(data: Record<string, unknown>) { return request<Leave>({ url: `${hr}/leaves`, method: 'post', data }) }
export function fetchOvertimes(params: CollabQuery) { return request<PageResult<Overtime>>({ url: `${hr}/overtimes`, method: 'get', params }) }
export function createOvertime(data: Record<string, unknown>) { return request<Overtime>({ url: `${hr}/overtimes`, method: 'post', data }) }
export function fetchSalaries(params: CollabQuery) { return request<PageResult<Salary>>({ url: `${hr}/salaries`, method: 'get', params }) }
export function createSalary(data: Record<string, unknown>) { return request<Salary>({ url: `${hr}/salaries`, method: 'post', data }) }
export function fetchPerformances(params: CollabQuery) { return request<PageResult<Performance>>({ url: `${hr}/performances`, method: 'get', params }) }
export function createPerformance(data: Record<string, unknown>) { return request<Performance>({ url: `${hr}/performances`, method: 'post', data }) }
export function fetchTrainings(params: CollabQuery) { return request<PageResult<Training>>({ url: `${hr}/trainings`, method: 'get', params }) }
export function createTraining(data: Record<string, unknown>) { return request<Training>({ url: `${hr}/trainings`, method: 'post', data }) }
export function fetchAdminAssets(params: CollabQuery) { return request<PageResult<AdminAsset>>({ url: `${hr}/admin-assets`, method: 'get', params }) }
export function createAdminAsset(data: Record<string, unknown>) { return request<AdminAsset>({ url: `${hr}/admin-assets`, method: 'post', data }) }
export function fetchVehicles(params: CollabQuery) { return request<PageResult<Vehicle>>({ url: `${hr}/vehicles`, method: 'get', params }) }
export function createVehicle(data: Record<string, unknown>) { return request<Vehicle>({ url: `${hr}/vehicles`, method: 'post', data }) }
export function fetchVehicleUses(params: CollabQuery) { return request<PageResult<VehicleUse>>({ url: `${hr}/vehicle-uses`, method: 'get', params }) }
export function createVehicleUse(data: Record<string, unknown>) { return request<VehicleUse>({ url: `${hr}/vehicle-uses`, method: 'post', data }) }
