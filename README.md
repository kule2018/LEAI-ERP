# LEAI ERP

基于 Vue 3.5、NestJS 10、TypeScript strict、MySQL 8、Redis 7 的企业资源计划系统。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3.5、Vite 5、Element Plus、Pinia、Vue Router、ECharts |
| 后端 | NestJS 10、TypeORM 0.3、MySQL 8、Redis、BullMQ、JWT |
| 部署 | Docker Compose、Nginx |
| 打印 | PDFKit、HTML 预览、浏览器打印 |
| AI | 本地规则引擎兜底，可接入外部模型与 RAG |

## 目录

```text
apps/server    NestJS 后端、实体、DTO、迁移 SQL
apps/web       Vue 3 前端、页面、API 封装
docs           产品与技术规范、交付文档
scripts        迁移、备份、恢复、审计、压测脚本
tests          Node 原生单元与流程测试
```

## 本地启动

1. 复制配置：

```powershell
copy .env.example .env
```

2. 启动依赖并迁移：

```powershell
docker compose up -d mysql redis
npm run migrate
```

3. 启动服务：

```powershell
npm run dev:server
npm run dev:web
```

默认管理员：`admin / Admin@123456`，租户码 `default`。生产部署前必须修改 `.env` 中的密码与密钥。

## 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run typecheck` | 前后端 TypeScript 检查 |
| `npm test` | 后端编译与单元 / 流程测试 |
| `npm run audit:project` | 权限码、菜单组件、实体与迁移静态审计 |
| `npm run verify` | 类型检查 + 测试 + 静态审计 |
| `npm run build:web` | 前端生产构建 |
| `npm run build:server` | 后端编译 |
| `npm run migrate` | 执行数据库迁移，已执行版本自动跳过 |
| `npm run backup:db` | 生成 `.sql.gz` 数据库备份 |
| `npm run restore:db -- <file>` | 从备份恢复数据库 |
| `npm run stress:inventory` | 对运行中的服务执行库存并发压测 |
| `npm run deploy:up` | Docker Compose 一键启动 |
| `npm run deploy:down` | 停止 Docker Compose |

## Docker 部署

```powershell
npm run migrate
npm run deploy:up
```

服务端口：

- Web：`http://127.0.0.1:8080`
- API：`http://127.0.0.1:3000/api/v1`
- 健康检查：`http://127.0.0.1:3000/api/v1/health`
- 指标 JSON：`http://127.0.0.1:3000/api/v1/metrics`
- Prometheus：`http://127.0.0.1:3000/api/v1/metrics/prometheus`

## 核心约定

- 统一响应：`{ code, data, message }`
- 分页结构：`{ list, items, total, page, pageSize }`
- 金额字符串传输，数据库 `DECIMAL(18,4)`
- 数量字符串传输，数据库 `DECIMAL(18,3)`
- 所有业务数据带 `tenant_id`
- 权限码格式：`module:resource:action`
- 库存可用量：`qty_on_hand - qty_occupied - qty_frozen`
- AI 只生成建议，写操作必须人工确认并审计


