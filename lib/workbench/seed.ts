import type { Block, Material, SourceRef } from './types'

export const project = {
  id: 'PRJ-2026-0418',
  customer: '华东能源集团',
  title: '集团财务共享与智能报账解决方案',
  owner: '顾问 · 林亦',
  sales: '销售 · 周航',
  template: '集团型解决方案模板 v3',
  audience: '集团CFO、财务共享中心负责人、信息部',
  format: 'Word',
}

export const projectFiles = [
  { id: 'f1', name: '客户背景介绍.pdf', kind: '客户背景', by: '周航', date: '04-02' },
  { id: 'f2', name: '需求调研表_财务部.xlsx', kind: '需求文件', by: '周航', date: '04-05' },
  { id: 'f3', name: '沟通纪要_0312.docx', kind: '沟通纪要', by: '周航', date: '04-06' },
  { id: 'f4', name: '现有IT系统清单.xlsx', kind: '行业资料', by: '客户信息部', date: '04-07' },
]

export const consultantIntent =
  '以“共享中心 + 智能报账”为切入，一期不改造ERP核心账务；突出票据识别与智能审核带来的周期缩短；范围限定境内子公司。'

export const sources: SourceRef[] = [
  { id: 'S1', title: '沟通纪要_0312.docx', location: '第2节 · 现状描述', kind: 'project' },
  { id: 'S2', title: '需求调研表_财务部.xlsx', location: 'Sheet「报账量」· B4:D12', kind: 'project' },
  { id: 'S3', title: '智能财务平台产品手册 v5.2', location: '3.1 平台分层架构', kind: 'knowledge' },
  { id: 'S4', title: '财务共享实施方法论', location: '第4章 · 分阶段实施', kind: 'knowledge' },
  { id: 'S5', title: '某制造集团共享中心案例（脱敏）', location: '实施成效', kind: 'case' },
]

export const materials: Material[] = [
  {
    id: 'MAT-101',
    title: '集团财务共享中心总体架构',
    type: 'ppt',
    scope: 'internal',
    image: '/materials/slide-finance-shared.png',
    file: '财务共享解决方案V5.2.pptx',
    page: 12,
    version: 'v5.2',
    tags: ['财务共享', '集团', '总体架构', '共享中心', '解决方案'],
    description: '集团总部、共享中心、子公司三级架构，适用于总体解决方案章节。',
    license: '内部已审核 · 可对外交付',
    approved: true,
  },
  {
    id: 'MAT-102',
    title: '智能报账泳道流程',
    type: 'flow',
    scope: 'internal',
    image: '/materials/slide-process.png',
    file: '智能报账产品介绍.pptx',
    page: 18,
    version: 'v4.0',
    tags: ['报账', '流程', '泳道', '审批', '业务流程'],
    description: '员工、审批人、共享中心、财务系统四泳道报账流程。',
    license: '内部已审核 · 可对外交付',
    approved: true,
  },
  {
    id: 'MAT-103',
    title: '智能财务平台五层架构',
    type: 'architecture',
    scope: 'internal',
    image: '/materials/slide-platform.png',
    file: '智能财务平台白皮书.pptx',
    page: 7,
    version: 'v5.2',
    tags: ['平台', '分层', '架构', 'AI能力', '总体架构'],
    description: '交互、编排、AI能力、数据知识、基础设施五层横向架构。',
    license: '内部已审核 · 可对外交付',
    approved: true,
  },
  {
    id: 'MAT-104',
    title: '财务驾驶舱产品截图',
    type: 'screenshot',
    scope: 'internal',
    image: '/materials/screenshot-dashboard.png',
    file: '产品截图库 / 财务驾驶舱',
    version: '2026Q1',
    tags: ['产品', '驾驶舱', '报表', '截图', '分析'],
    description: '集团费用分析与待处理凭证看板，适合价值呈现章节。',
    license: '内部素材 · 可对外交付',
    approved: true,
  },
  {
    id: 'MAT-105',
    title: '客户混合云部署现状',
    type: 'architecture',
    scope: 'project',
    image: '/materials/slide-deployment.png',
    file: '现有IT系统清单.xlsx 附图',
    page: 2,
    version: '客户提供',
    tags: ['部署', '私有云', '网络', '现状', '基础设施'],
    description: '客户信息部提供的现网部署示意，仅限本项目引用。',
    license: '客户资料 · 仅限本项目',
    approved: false,
  },
  {
    id: 'MAT-106',
    title: '三阶段实施路线图',
    type: 'ppt',
    scope: 'internal',
    image: '/materials/slide-roadmap.png',
    file: '财务共享实施方法论.pptx',
    page: 24,
    version: 'v2.1',
    tags: ['实施', '计划', '路线图', '里程碑', '阶段'],
    description: '试点、推广、优化三阶段路线图模板。',
    license: '内部已审核 · 可对外交付',
    approved: true,
  },
]

export const initialBlocks: Block[] = [
  { id: 'blk-0100', type: 'heading', level: 1, text: '一、项目背景与现状' },
  {
    id: 'blk-0101',
    type: 'paragraph',
    text: '华东能源集团下属46家子公司，财务核算分散在3套ERP系统中，报账仍以纸质单据与线下审批为主。月均报账单约3.2万笔，平均审批周期6.5天，票据审核依赖人工逐张核对。',
    refs: ['S1', 'S2'],
  },
  { id: 'blk-0200', type: 'heading', level: 1, text: '二、核心痛点与建设目标' },
  {
    id: 'blk-0201',
    type: 'list',
    items: [
      '核算口径不统一，集团层面难以获得及时、可比的费用数据。',
      '人工审核票据工作量大，差错与重复报销风险难以及时发现。',
      '建设目标：一年内将平均报账周期缩短至2天以内，实现境内子公司全覆盖。',
    ],
    refs: ['S2'],
    confirm: '“2天以内”为顾问建议目标，需与客户确认后方可对外承诺。',
  },
  { id: 'blk-0300', type: 'heading', level: 1, text: '三、总体解决方案' },
  {
    id: 'blk-0301',
    type: 'paragraph',
    text: '平台总体分为五层：用户交互层：移动报账、PC门户、企业微信；业务编排层：报账流程、审批引擎、规则中心；AI能力层：票据识别、智能审核、风险预警；数据知识层：财务主数据、制度知识库、影像档案；基础设施层：私有云、统一身份、日志审计。',
    refs: ['S3'],
  },
  {
    id: 'blk-0302',
    type: 'placeholder',
    text: '建议补充：总体架构图',
    suggestion: 'tool02',
  },
  { id: 'blk-0400', type: 'heading', level: 1, text: '四、业务流程设计' },
  {
    id: 'blk-0401',
    type: 'paragraph',
    text: '员工提交报账单并上传票据，系统自动识别票据并完成合规校验，部门负责人在线审批，共享中心进行财务复核，系统生成凭证并推送至ERP，资金系统完成付款。',
    refs: ['S3', 'S5'],
  },
  {
    id: 'blk-0402',
    type: 'placeholder',
    text: '建议补充：报账业务流程图或已有PPT页面',
    suggestion: 'tool01',
  },
  { id: 'blk-0500', type: 'heading', level: 1, text: '五、实施计划' },
  {
    id: 'blk-0501',
    type: 'paragraph',
    text: '建议采用“试点—推广—优化”三阶段推进：首先在两家子公司试点智能报账，其次完成境内子公司推广，最后基于运行数据优化审核规则与知识库。',
    refs: ['S4'],
    confirm: '各阶段交付周期尚未与交付团队确认，暂不写入具体月份。',
  },
  { id: 'blk-0600', type: 'heading', level: 1, text: '六、商务与报价' },
  {
    id: 'blk-0601',
    type: 'placeholder',
    text: '报价内容由商务人工填写，AI不生成',
  },
]

export const briefFacts = [
  { text: '下属46家子公司，核算分散在3套ERP', source: 'S1' },
  { text: '月均报账单约3.2万笔，平均审批周期6.5天', source: 'S2' },
  { text: '现网为私有云 + 公有云混合部署', source: 'S1' },
]

export const briefSuggestions = [
  '第三章可用 Tool02 将五层描述转换为总体架构图',
  '第四章可插入已审核的「智能报账泳道流程」PPT页面',
  '第五章可引用三阶段实施路线图素材',
]

export const briefGaps = [
  '海外子公司是否纳入本期范围',
  '各阶段交付周期与里程碑月份',
  '报价口径：按子公司数还是按用户数',
]

export const workflowSteps = [
  '导入资料',
  '描述思路',
  '任务书与目录',
  '生成初稿',
  'Tool01 补素材',
  'Tool02 生成图形',
  '审核定稿',
  '导出沉淀',
]
