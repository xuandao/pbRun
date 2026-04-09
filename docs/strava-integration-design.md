# Strava 数据源集成设计方案

> 文档版本: 1.1
> 日期: 2026-04-09
> 状态: 评审中

---

## 1. 项目背景

pbRun 当前支持 Garmin Connect 数据源，通过 FIT 文件解析存储到 SQLite 数据库。现需增加 Strava 数据源支持，让用户可以从 Strava 同步跑步活动数据。

参考实现: `/Users/xuandao/work/xuandao/skills/strava-running` 提供完整的 Strava 数据拉取功能。

---

## 2. 目标

1. 在 pbRun 中支持 Strava 数据源同步
2. 与现有 Garmin 数据统一存储到 SQLite
3. 保持与 Garmin 数据相同的数据结构和分析能力
4. 支持户外跑（有 GPS）和室内跑（无 GPS）
5. **不包含**: 笔记生成、Obsidian 集成等额外功能

---

## 3. 目录结构调整

### 3.1 新的 scripts 目录结构

```
scripts/
├── common/                          # 通用模块
│   ├── db-manager.js               # 数据库管理（从 scripts/ 移入）
│   ├── vdot-calculator.js          # VDOT 计算（从 scripts/ 移入）
│   └── utils.js                    # 通用工具函数
├── garmin/                          # Garmin 数据源
│   ├── sync.js                     # 同步入口（从 sync-garmin.js 迁移）
│   ├── client.js                   # API 客户端（从 garmin-client.js 迁移）
│   ├── fit-parser.js               # FIT 解析（从 fit-parser.js 迁移）
│   ├── preprocess-stats-cache.js   # 统计缓存（从 scripts/ 迁移）
│   ├── validate-data.js            # 数据验证（从 scripts/ 迁移）
│   └── get_garmin_token.py         # Token 获取（从 scripts/ 迁移）
├── strava/                          # Strava 数据源（新增）
│   ├── sync.js                     # 同步入口
│   ├── fetcher.py                  # Python 数据拉取
│   ├── gpx_generator.py            # GPX 生成
│   └── oauth_helper.py             # OAuth 授权助手
└── lib/                             # 前端/共享代码（保持不动）
```

### 3.2 迁移注意事项

- 保持 `db-manager.js`、`vdot-calculator.js` 等通用模块的接口不变
- 更新 garmin 脚本中的相对路径引用
- 确保前端页面引用路径正确

---

## 4. 技术方案

### 4.1 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         pbRun (Next.js)                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Garmin Sync    │    │  Strava Sync    │    │  Web UI      │ │
│  │  (Node.js)      │    │  (Node+Python)  │    │              │ │
│  └────────┬────────┘    └────────┬────────┘    └──────────────┘ │
│           │                      │                               │
│           ▼                      ▼                               │
│         ┌─────────────────────────────────┐                     │
│         │      SQLite Database            │                     │
│         │  (activities, activity_laps)    │                     │
│         └─────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Strava API (stravalib)                       │
│  - OAuth2 认证 (refresh_token)                                   │
│  - 获取活动列表                                                  │
│  - 获取活动详情 (距离、时间、心率等)                              │
│  - 获取 Streams (GPS、心率、海拔等时间序列)                       │
│  - 获取 Laps (计圈数据)                                          │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 实现方式

复用 `strava-running/scripts/fetch_strava_run.py` 的成熟实现，通过 Node.js child_process 调用 Python 脚本，JSON 数据交换。

---

## 5. 配置设计

### 5.1 .env 环境变量

```bash
# ==========================================
# Strava 配置（新增）
# ==========================================
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REFRESH_TOKEN=your_refresh_token

# ==========================================
# Garmin 配置（现有，保持不变）
# ==========================================
GARMIN_SECRET_STRING=xxx

# ==========================================
# 通用配置
# ==========================================
MAX_HR=190
RESTING_HR=55
```

### 5.2 GitHub Secrets 支持

后续可配置 GitHub Actions Secrets:
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

---

## 6. 数据映射

### 6.1 Strava API → SQLite activities 表

| Strava 字段 | SQLite 字段 | 转换逻辑 |
|-------------|-------------|----------|
| `id` | `activity_id` | 直接映射 |
| `name` | `name` | 直接映射 |
| `type` (Run) | `activity_type` | 固定值 'running' |
| 推断 | `sport_type` | 有 GPS: 'running', 无 GPS: 'treadmill_running' |
| `start_date` | `start_time` | ISO 8601 → DATETIME |
| `start_date_local` | `start_time_local` | ISO 8601 → DATETIME |
| `distance` (m) | `distance` | 米 → 公里 (/1000) |
| `moving_time` (s) | `duration` | 直接映射 |
| `moving_time` (s) | `moving_time` | 直接映射 |
| `elapsed_time` (s) | `elapsed_time` | 直接映射 |
| `average_speed` (m/s) | `average_pace` | 转换为秒/公里 (1000/速度) |
| `average_speed` (m/s) | `average_speed` | m/s → km/h (*3.6) |
| `max_speed` (m/s) | `max_speed` | 直接保留 m/s |
| `average_heartrate` | `average_heart_rate` | 直接映射 |
| `max_heartrate` | `max_heart_rate` | 直接映射 |
| `average_cadence` | `average_cadence` | 直接映射 |
| `max_cadence` | `max_cadence` | 直接映射 |
| `total_elevation_gain` (m) | `total_ascent` | 直接映射 |
| `calories` | `calories` | 直接映射 |
| `average_watts` | `average_power` | 直接映射 |
| `max_watts` | `max_power` | 直接映射 |
| 推断 | `sub_sport_type` | '跑步机' / '路跑' / '越野' |

### 6.2 子类型推断逻辑

```python
def infer_sub_sport_type(activity):
    """推断子类型: 跑步机、路跑、越野等"""
    # 1. 检查是否有 GPS 轨迹
    if not activity.map or not activity.map.summary_polyline:
        return '跑步机'

    # 2. 从活动名称推断
    name = activity.name.lower()
    if '跑步机' in name or 'treadmill' in name:
        return '跑步机'
    if '越野' in name or 'trail' in name:
        return '越野'

    # 3. 默认户外路跑
    return '路跑'
```

---

## 7. 实现步骤与计划

### Phase 1: 目录重构 (2h)

**目标**: 调整 scripts 目录结构，移动现有文件

| 序号 | 任务 | 详细说明 |
|------|------|----------|
| 1.1 | 创建目录结构 | 创建 `scripts/common/`, `scripts/garmin/`, `scripts/strava/` |
| 1.2 | 移动通用模块 | `db-manager.js`, `vdot-calculator.js` → `scripts/common/` |
| 1.3 | 移动 Garmin 模块 | `sync-garmin.js` → `garmin/sync.js`, `garmin-client.js` → `garmin/client.js`, etc |
| 1.4 | 更新引用路径 | 修改所有文件中的相对路径引用 |
| 1.5 | 创建入口文件 | 在 scripts/ 根目录创建 `sync-garmin.js` 作为兼容入口 |
| 1.6 | 验证 | 运行 `node scripts/garmin/sync.js --limit 5` 确保正常 |

**产出物**:
- 新的目录结构
- 所有 garmin 脚本正常工作

---

### Phase 2: Python 模块实现 (3h)

**目标**: 实现 Strava Python 数据拉取模块

| 序号 | 任务 | 详细说明 |
|------|------|----------|
| 2.1 | 创建 `strava/fetcher.py` | 从 `strava-running/scripts/fetch_strava_run.py` 迁移核心代码 |
| 2.2 | 适配输出格式 | 修改输出 JSON 以匹配 pbRun SQLite schema |
| 2.3 | 创建 `strava/gpx_generator.py` | GPX 生成逻辑（从 streams 数据） |
| 2.4 | 创建 `strava/oauth_helper.py` | OAuth 授权助手脚本 |
| 2.5 | 添加子类型推断 | 实现 `infer_sub_sport_type()` 函数 |
| 2.6 | 测试 Python 脚本 | `python scripts/strava/fetcher.py --dry-run` 验证输出格式 |

**产出物**:
- `scripts/strava/fetcher.py`
- `scripts/strava/gpx_generator.py`
- `scripts/strava/oauth_helper.py`

---

### Phase 3: Node.js 同步脚本 (3h)

**目标**: 实现 Strava 同步入口脚本

| 序号 | 任务 | 详细说明 |
|------|------|----------|
| 3.1 | 创建 `strava/sync.js` | 主同步脚本框架 |
| 3.2 | 实现 Python 调用 | 使用 `child_process.spawn` 调用 fetcher.py |
| 3.3 | 实现数据转换层 | Strava JSON → SQLite 字段映射 |
| 3.4 | 集成 db-manager | 调用 `upsertActivity()`, `insertLaps()` |
| 3.5 | 实现 VDOT 计算 | 复用 `common/vdot-calculator.js` |
| 3.6 | 添加错误处理 | 401 刷新 token、429 限流重试等 |
| 3.7 | 添加日志输出 | 与 garmin sync 类似的进度输出 |

**产出物**:
- `scripts/strava/sync.js`

---

### Phase 4: 测试用例实现 (4h)

详见第 8 节《测试用例设计》

| 序号 | 任务 | 详细说明 |
|------|------|----------|
| 4.1 | 搭建测试框架 | 创建 `tests/` 目录，配置 Jest |
| 4.2 | 实现单元测试 | 数据转换、工具函数 |
| 4.3 | 实现集成测试 | 端到端同步流程 |
| 4.4 | 实现 Mock 测试 | Strava API Mock |
| 4.5 | 运行全部测试 | 确保通过 |

**产出物**:
- `tests/` 目录及测试文件
- `npm test` 可运行

---

### Phase 5: 集成与文档 (2h)

| 序号 | 任务 | 详细说明 |
|------|------|----------|
| 5.1 | 更新 package.json | 添加 `sync:strava`, `auth:strava` scripts |
| 5.2 | 创建 .env.example | 添加 Strava 配置示例 |
| 5.3 | 更新 README.md | 添加 Strava 使用说明 |
| 5.4 | 端到端测试 | 完整跑通一次同步 |
| 5.5 | 代码审查 | 检查代码质量、注释、错误处理 |

**产出物**:
- 更新的 package.json
- 更新的 README.md
- 通过的端到端测试

---

### 总体时间线

```
Day 1 (4h)
├── Phase 1: 目录重构 (2h)
└── Phase 2: Python 模块 (2h)

Day 2 (4h)
├── Phase 2: Python 模块 (1h) - 完成
├── Phase 3: Node.js 同步 (3h)

Day 3 (4h)
├── Phase 4: 测试用例 (4h)

Day 4 (2h)
└── Phase 5: 集成与文档 (2h)

总计: 14h
```

---

## 8. 测试用例设计

### 8.1 测试框架选型

- **框架**: Jest (Node.js 生态标准)
- **Mock**: jest.mock() 用于 API Mock
- **覆盖率目标**: 核心逻辑 > 80%

### 8.2 测试目录结构

```
tests/
├── unit/                           # 单元测试
│   ├── common/
│   │   ├── db-manager.test.js
│   │   └── vdot-calculator.test.js
│   ├── garmin/
│   │   └── client.test.js
│   └── strava/
│       ├── data-transform.test.js
│       └── sub-sport-infer.test.js
├── integration/                    # 集成测试
│   ├── garmin-sync.test.js
│   └── strava-sync.test.js
├── mocks/                          # Mock 数据
│   ├── strava/
│   │   ├── activity.json           # 示例活动数据
│   │   ├── streams.json            # 示例 streams 数据
│   │   └── laps.json               # 示例 laps 数据
│   └── garmin/
│       └── ...
└── e2e/                            # 端到端测试
    └── sync-workflow.test.js
```

### 8.3 单元测试用例

#### 8.3.1 Strava 数据转换测试

**文件**: `tests/unit/strava/data-transform.test.js`

| 用例 ID | 用例名称 | 输入 | 预期输出 | 优先级 |
|---------|----------|------|----------|--------|
| STR-DT-001 | 正常活动转换 | 完整 Strava activity JSON | 正确映射到 SQLite 字段 | P0 |
| STR-DT-002 | 无 GPS 活动 | 无 map.summary_polyline | sport_type='treadmill_running' | P0 |
| STR-DT-003 | 有 GPS 活动 | 有 map.summary_polyline | sport_type='running', sub_sport_type='路跑' | P0 |
| STR-DT-004 | 配速计算 | average_speed=3.5 (m/s) | average_pace=286 (s/km) ≈ 4:46/km | P0 |
| STR-DT-005 | 距离转换 | distance=5000 (m) | distance=5.0 (km) | P0 |
| STR-DT-006 | 时间解析 | start_date_local="2026-04-09T08:30:00Z" | start_time_local=Date 对象 | P0 |
| STR-DT-007 | 缺失可选字段 | 无心率数据 | average_heart_rate=null | P1 |
| STR-DT-008 | 名称推断越野 | name="Trail Run in Mountains" | sub_sport_type='越野' | P1 |

#### 8.3.2 子类型推断测试

**文件**: `tests/unit/strava/sub-sport-infer.test.js`

| 用例 ID | 用例名称 | 输入 | 预期输出 | 优先级 |
|---------|----------|------|----------|--------|
| STR-SSI-001 | 跑步机-无GPS | map=null | '跑步机' | P0 |
| STR-SSI-002 | 跑步机-名称 | name="Morning Treadmill Run" | '跑步机' | P0 |
| STR-SSI-003 | 路跑-默认 | 有GPS, name="Morning Run" | '路跑' | P0 |
| STR-SSI-004 | 越野-名称 | name="Trail Running" | '越野' | P0 |
| STR-SSI-005 | 中文名称-跑步机 | name="跑步机 5km" | '跑步机' | P0 |
| STR-SSI-006 | 中文名称-越野 | name="周末越野跑" | '越野' | P0 |

### 8.4 集成测试用例

#### 8.4.1 Strava 同步集成测试

**文件**: `tests/integration/strava-sync.test.js`

**测试策略**: 使用 nock 或 MSW Mock Strava API

| 用例 ID | 用例名称 | 前置条件 | 测试步骤 | 预期结果 | 优先级 |
|---------|----------|----------|----------|----------|--------|
| STR-INT-001 | 首次同步单活动 | 空数据库 | 1. Mock API 返回 1 个活动<br>2. 调用 sync.js | 数据库新增 1 条记录 | P0 |
| STR-INT-002 | 增量同步 | 已有活动 ID:123 | 1. Mock API 返回 2 个活动（含 ID:123）<br>2. 调用 sync.js | 只新增 1 条记录 | P0 |
| STR-INT-003 | 同步含 Laps | - | 1. Mock API 返回含 4 个 lap 的活动<br>2. 调用 sync.js | activity_laps 表新增 4 条 | P0 |
| STR-INT-004 | Token 过期刷新 | refresh_token 有效 | 1. Mock 401 响应<br>2. Mock token 刷新成功<br>3. Mock 重试成功 | 同步成功，更新 token | P0 |
| STR-INT-005 | Token 刷新失败 | refresh_token 无效 | 1. Mock 401 响应<br>2. Mock token 刷新失败 | 抛出错误，提示重新授权 | P0 |
| STR-INT-006 | 限流处理 | - | 1. Mock 429 响应<br>2. 检查重试逻辑 | 等待后重试，最终成功 | P1 |
| STR-INT-007 | 户外跑 GPX 生成 | 有 GPS 数据 | 1. Mock streams 含 latlng<br>2. 调用 sync.js | 生成 .gpx 文件到 public/gpx/strava/ | P0 |
| STR-INT-008 | 室内跑无 GPX | 无 GPS 数据 | 1. Mock 活动无 map<br>2. 调用 sync.js | 不生成 GPX，其他数据正常 | P0 |
| STR-INT-009 | VDOT 计算 | MAX_HR, RESTING_HR 已配置 | 1. Mock 含心率数据的活动<br>2. 调用 sync.js | 计算并存储 vdot_value | P1 |
| STR-INT-010 | 无心率跳过 VDOT | - | 1. Mock 无心率的活动<br>2. 调用 sync.js | vdot_value=null | P1 |

### 8.5 Python 模块测试

**文件**: `tests/python/test_fetcher.py` (使用 pytest)

| 用例 ID | 用例名称 | 测试内容 | 优先级 |
|---------|----------|----------|--------|
| PY-FET-001 | 认证成功 | 有效 refresh_token 换取 access_token | P0 |
| PY-FET-002 | 获取活动列表 | 返回最近跑步活动列表 | P0 |
| PY-FET-003 | 获取活动详情 | 返回完整活动数据 | P0 |
| PY-FET-004 | 获取 streams | 返回时间序列数据 | P0 |
| PY-FET-005 | 获取 laps | 返回计圈数据 | P0 |
| PY-FET-006 | GPX 生成 | 从 streams 生成有效 GPX XML | P0 |
| PY-FET-007 | JSON 输出格式 | 输出符合 pbRun schema | P0 |
| PY-FET-008 | 错误处理-401 | 无效 token 抛出异常 | P0 |
| PY-FET-009 | 错误处理-网络 | 网络超时重试 | P1 |

### 8.6 端到端测试

**文件**: `tests/e2e/sync-workflow.test.js`

| 用例 ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|---------|----------|----------|----------|--------|
| E2E-001 | 完整同步流程 | 1. 配置 .env<br>2. 运行 `npm run sync:strava -- --limit 1`<br>3. 检查数据库和 GPX | 数据正确入库，文件生成 | P0 |
| E2E-002 | Web UI 显示 | 1. 同步后启动 `npm run dev`<br>2. 访问活动列表页 | Strava 活动正常显示 | P0 |

### 8.7 Mock 数据设计

**文件**: `tests/mocks/strava/activity.json`

```json
{
  "id": 1234567890,
  "name": "Morning Run",
  "type": "Run",
  "start_date": "2026-04-09T08:30:00Z",
  "start_date_local": "2026-04-09T16:30:00Z",
  "distance": 5000,
  "moving_time": 1500,
  "elapsed_time": 1600,
  "average_speed": 3.33,
  "max_speed": 4.5,
  "average_heartrate": 155,
  "max_heartrate": 175,
  "average_cadence": 170,
  "total_elevation_gain": 50,
  "calories": 350,
  "average_watts": 250,
  "map": {
    "summary_polyline": "encoded_polyline_string"
  }
}
```

### 8.8 测试执行计划

```bash
# 安装测试依赖
npm install --save-dev jest @types/jest
pip3 install pytest pytest-mock

# 运行所有测试
npm test

# 运行特定测试
npm test -- tests/unit/strava
npm test -- tests/integration/strava-sync.test.js

# Python 测试
cd tests/python && pytest

# 覆盖率报告
npm test -- --coverage
```

---

## 9. 错误处理

| 错误类型 | 处理策略 |
|----------|----------|
| 401 Unauthorized | 尝试刷新 token，失败则提示运行 `npm run auth:strava` |
| 429 Rate Limit | 等待 15 分钟后重试，最多重试 3 次 |
| Python 未安装 | 检测并提示安装依赖 `pip3 install stravalib gpxpy` |
| Python 依赖缺失 | 捕获 ImportError，提示安装命令 |
| 无活动数据 | 友好提示 "未找到 Strava 跑步活动" |
| 数据解析失败 | 记录详细日志，跳过该活动继续同步 |

---

## 10. 依赖清单

### Python 依赖
```bash
pip3 install stravalib gpxpy requests
```

### Node.js 依赖 (开发)
```bash
npm install --save-dev jest @types/jest
```

---

## 11. 交付清单

- [ ] 目录结构重构完成
- [ ] `scripts/strava/fetcher.py` - Python 数据拉取
- [ ] `scripts/strava/gpx_generator.py` - GPX 生成
- [ ] `scripts/strava/oauth_helper.py` - OAuth 授权
- [ ] `scripts/strava/sync.js` - Node.js 同步入口
- [ ] `tests/` 目录及完整测试用例
- [ ] 更新的 `package.json` (scripts)
- [ ] 更新的 `README.md` (使用说明)
- [ ] `.env.example` (配置示例)

---

## 12. 评审检查项

- [ ] 目录结构设计是否合理？
- [ ] 数据映射是否正确完整？
- [ ] 测试用例设计是否覆盖主要场景？
- [ ] 实现步骤和时间预估是否合理？
- [ ] 是否有遗漏的风险或边界情况？
