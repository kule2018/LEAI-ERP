import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGantt, buildKanban, collectReminders, evaluateCandidateStage, evaluateInterviewFeedback,
  evaluateMilestoneStatus, evaluateOfferTransition, evaluateTalentAction, evaluateWorklog,
  selectVehicleDispatch
} from '../apps/server/dist/common/project-ops-engine.js'

const at = new Date('2026-12-01T09:00:00Z')

test('看板按状态分列并归集未知状态', () => {
  const columns = buildKanban([
    { id: 1, taskName: 'A', status: 'TODO' },
    { id: 2, taskName: 'B', status: 'DOING' },
    { id: 3, taskName: 'C', status: 'DONE' },
    { id: 4, taskName: 'D', status: 'BLOCKED' }
  ])
  assert.equal(columns.length, 4)
  assert.equal(columns[0].count, 1)
  assert.equal(columns[3].status, 'OTHER')
  assert.equal(columns[3].count, 1)
})

test('甘特计算偏移天数、进度与逾期标记', () => {
  const gantt = buildGantt(
    [
      { id: 1, taskName: '需求', status: 'DONE', startDate: '2026-11-01', dueDate: '2026-11-05' },
      { id: 2, taskName: '开发', status: 'DOING', startDate: '2026-11-06', dueDate: '2026-11-20' }
    ],
    [{ id: 9, milestoneName: '上线', planDate: '2026-11-21', status: 'PLANNED' }],
    { startDate: '2026-11-01', endDate: '2026-11-25' },
    at
  )
  assert.equal(gantt.start, '2026-11-01')
  assert.equal(gantt.items[0].progress, 100)
  assert.equal(gantt.items[0].offsetDays, 0)
  assert.equal(gantt.items[1].progress, 50)
  assert.equal(gantt.items[1].offsetDays, 5)
  assert.equal(gantt.items[1].overdue, true)
  assert.equal(gantt.milestones[0].completed, false)
})

test('工时校验限制单日累计不超过24小时', () => {
  assert.equal(evaluateWorklog([], '2026-12-01', '8').ok, true)
  assert.equal(evaluateWorklog([{ workDate: '2026-12-01', hours: '20' }], '2026-12-01', '8').ok, false)
  assert.equal(evaluateWorklog([], '2026-12-01', '0').ok, false)
  assert.equal(evaluateWorklog([], '2026-12-01', '25').ok, false)
})

test('里程碑状态按计划推进', () => {
  assert.equal(evaluateMilestoneStatus('PLANNED', 'DOING').ok, true)
  assert.equal(evaluateMilestoneStatus('DONE', 'DOING').ok, false)
  assert.equal(evaluateMilestoneStatus('PLANNED', 'CANCELLED').status, 'CANCELLED')
})

test('招聘管道阶段必须按流程流转', () => {
  assert.equal(evaluateCandidateStage('APPLIED', 'SCREENING').ok, true)
  assert.equal(evaluateCandidateStage('APPLIED', 'OFFER').ok, false)
  assert.equal(evaluateCandidateStage('INTERVIEW', 'TALENT').ok, true)
  assert.equal(evaluateCandidateStage('APPLIED', 'UNKNOWN').ok, false)
})

test('面试反馈必填且长度足够', () => {
  assert.equal(evaluateInterviewFeedback('候选人技术扎实，沟通良好').ok, true)
  assert.equal(evaluateInterviewFeedback('').ok, false)
  assert.equal(evaluateInterviewFeedback('好').ok, false)
})

test('Offer 审批仅允许待审批状态操作', () => {
  assert.equal(evaluateOfferTransition('PENDING', 'APPROVE').status, 'APPROVED')
  assert.equal(evaluateOfferTransition('PENDING', 'REJECT').status, 'REJECTED')
  assert.equal(evaluateOfferTransition('APPROVED', 'APPROVE').ok, false)
})

test('人才库入池、复用与淘汰', () => {
  assert.equal(evaluateTalentAction('REJECTED', 'IN').status, 'TALENT')
  assert.equal(evaluateTalentAction('TALENT', 'IN').ok, false)
  assert.equal(evaluateTalentAction('TALENT', 'REUSE').status, 'APPLIED')
  assert.equal(evaluateTalentAction('TALENT', 'DISCARD').status, 'DISCARDED')
  assert.equal(evaluateTalentAction('APPLIED', 'DISCARD').ok, false)
})

test('车队调度避开时间冲突并列出冲突车辆', () => {
  const vehicles = [
    { id: 1, plateNo: '沪A0001', status: 'IDLE', driverId: 10 },
    { id: 2, plateNo: '沪A0002', status: 'IDLE', driverId: 11 },
    { id: 3, plateNo: '沪A0003', status: 'MAINTENANCE', driverId: 12 }
  ]
  const windows = [{ vehicleId: 1, startTime: '2026-12-02T09:00:00Z', endTime: '2026-12-02T12:00:00Z', status: 'PENDING' }]
  const hit = selectVehicleDispatch(vehicles, windows, { startTime: '2026-12-02T10:00:00Z', endTime: '2026-12-02T11:00:00Z' })
  assert.equal(hit.ok, true)
  assert.equal(hit.vehicleId, 2)
  assert.equal(hit.conflicted.length, 1)

  const none = selectVehicleDispatch(
    [{ id: 1, plateNo: '沪A0001', status: 'IDLE', driverId: 10 }],
    [{ vehicleId: 1, startTime: '2026-12-02T09:00:00Z', endTime: '2026-12-02T12:00:00Z', status: 'PENDING' }],
    { startTime: '2026-12-02T10:00:00Z', endTime: '2026-12-02T11:00:00Z' }
  )
  assert.equal(none.ok, false)
  assert.equal(none.conflicted.length, 1)
})

test('提醒按阈值归集并标注逾期等级', () => {
  const reminders = collectReminders([
    { type: 'FLOW_TASK', targetType: 'flow_task', targetId: 1, title: '待办1', dueDate: '2026-11-30' },
    { type: 'OA_TASK', targetType: 'oa_task', targetId: 2, title: '任务2', dueDate: '2026-12-02' },
    { type: 'CERTIFICATE', targetType: 'hr_training_record', targetId: 3, title: '证书3', dueDate: '2026-12-31', thresholdDays: 30 }
  ], at)
  assert.equal(reminders.length, 3)
  assert.equal(reminders[0].type, 'FLOW_TASK')
  assert.equal(reminders[0].level, 'HIGH')
  assert.equal(reminders[1].days, 1)
  assert.equal(reminders[1].level, 'MEDIUM')
})
