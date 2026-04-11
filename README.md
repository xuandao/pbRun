# 🏃 pbRun - 跑步数据分析工具

**专业的跑步数据分析工具，助力跑者实现 PB**

支持 **Garmin** 和 **Strava** 双数据源，通过专业的跑力（VDOT）分析、心率区间分布、配速趋势等多维度数据，为跑者提供科学的训练建议和数据洞察。

<div align="center">

[![GitHub License](https://img.shields.io/github/license/xuandao/pbRun)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)

[在线演示](https://pbrun.vercel.app) · [快速开始](#快速开始) · [文档](docs/README.md)

</div>

---

## 在线演示

<div align="center">

### 🌐 [立即体验 → pbrun.vercel.app](https://pbrun.vercel.app)

*完美适配桌面端和移动端，支持手机、平板、电脑访问*

**主要功能**：活动列表 | VDOT 分析 | 心率区间 | 训练配速 | 统计数据

</div>

---

## 为什么选择这个项目？

### 💡 核心价值

- **双数据源支持**：同时支持 Garmin 和 Strava，一个工具管理所有跑步数据
- **专业的跑力分析**：基于 Jack Daniels 的 VDOT 理论，精确计算跑力值，追踪训练效果
- **心率区间优化**：分析每次训练的心率分布，帮助优化有氧/无氧训练配比
- **配速趋势洞察**：可视化配速变化，识别疲劳点和进步曲线
- **个人记录追踪**：自动识别和记录不同距离的 PB（个人最佳成绩）

### ✨ 技术优势

- **完全免费** 🎉 - 无需购买云数据库，零运营成本
- **一键部署** 🚀 - 部署到 Vercel，享受全球 CDN 加速
- **数据离线化** 💾 - SQLite 数据库随代码版本管理，数据永不丢失
- **自动同步** 🔄 - GitHub Actions 每日自动同步，无需手动操作
- **隐私安全** 🔒 - 数据存储在自己的 GitHub 仓库，完全掌控
- **移动端优化** 📱 - 完美适配手机端，随时随地查看数据

## 技术方案

```
步骤 1: 数据同步（每日自动）
┌─────────────────┐  ┌─────────────────┐
│  Garmin 国际区   │  │    Strava      │
│   运动数据       │  │   运动数据      │
│                 │  │                 │
└────────┬────────┘  └────────┬────────┘
         │ FIT 文件            │ API + GPX
         │                    │
         └──────────┬─────────┘
                    ▼
            ┌───────────────┐
            │ GitHub Actions│
            │ ・下载数据     │
            │ ・解析处理     │
            │ ・计算 VDOT    │
            └──────┬────────┘
                   │
步骤 2: 数据存储    │ 写入并提交
┌─────────────────┐│
│   GitHub 仓库    ││
│                 │◄┘
│ ・代码文件        │
│ ・SQLite 数据库   │
└────────┬────────┘
         │
         │ 自动部署
         ▼
步骤 3: 应用部署
┌─────────────────┐
│     Vercel      │
│  ・Next.js 应用  │
│  ・API Routes   │
│  ・SQLite 读取   │
└────────┬────────┘
         │
         │ HTTPS
         ▼
步骤 4: 用户访问
┌─────────────────┐
│   用户浏览器     │
│  ・查看数据      │
│  ・分析图表      │
└─────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
核心优势

✓ 双数据源     支持 Garmin FIT 文件和 Strava API 双渠道导入
✓ 完全免费     数据库文件随代码提交，无需购买云数据库
✓ 数据安全     SQLite 文件存在自己的 GitHub 仓库
✓ 自动同步     GitHub Actions 每日自动运行
✓ 全球加速     Vercel CDN 全球节点，响应 <100ms
✓ 版本管理     数据库支持 Git 版本控制，永不丢失
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 技术栈

- **数据同步**: Node.js + Garmin Connect API / Strava API
- **数据解析**: FIT SDK (Garmin) / GPX + Streams API (Strava)
- **数据存储**: SQLite (离线数据库，随代码部署)
- **Web 框架**: Next.js 16 (App Router + API Routes)
- **数据可视化**: ECharts (跑力趋势、心率区间、配速分析)
- **自动化**: GitHub Actions (每日同步 + 自动部署)
- **部署平台**: Vercel (零配置，全球 CDN)

## 快速开始

### 前置要求

- Node.js 18+
- Garmin 国际区账号 (国区不支持) **或** Strava 账号
- GitHub 账号
- Vercel 账号 (可选，用于部署)

### 1. Fork 并克隆你的仓库

请先 [Fork 本仓库](https://github.com/xuandao/pbRun) 到你的 GitHub 账号，然后克隆**你 Fork 后的仓库**（不要直接 clone 上游仓库）：

```bash
# 将 YOUR_USERNAME 替换为你的 GitHub 用户名
git clone git@github.com:YOUR_USERNAME/pbRun.git
cd pbRun
npm install
```

> **macOS 用户**：若 `npm install` 时 better-sqlite3 编译报错（如 `climits file not found`），请先设置 SDK 路径再安装：
> ```bash
> SDKROOT=$(xcrun --sdk macosx --show-sdk-path) npm install
> ```

### 2. 选择并配置数据源

支持 **Garmin** 或 **Strava** 作为数据源，选择其一配置即可：

#### 方案 A: Garmin 数据源（推荐 Garmin 手表用户）

**Step 1: 获取 Garmin Token**

运行脚本获取 Token（需要输入 Garmin 账号密码）：

```bash
python3 scripts/garmin/get_garmin_token.py
# 按提示输入邮箱和密码
```

将输出的 **GARMIN_SECRET_STRING** 填入 `.env` 文件。

#### 方案 B: Strava 数据源（推荐 Strava 用户）

**Step 1: 创建 Strava OAuth 应用**

1. 访问 [Strava API Settings](https://www.strava.com/settings/api)
2. 创建应用，获取 `Client ID` 和 `Client Secret`

**Step 2: 运行授权脚本**

```bash
npm run auth:strava
```

按提示完成 OAuth 授权，将输出的 **Refresh Token** 填入 `.env` 文件。

> **Strava 数据源特点**:
> - 通过 Strava API 获取活动数据
> - 支持 GPX 轨迹文件下载
> - 自动同步心率、配速、步频等数据

### 3. 配置环境变量

在项目根目录创建 `.env` 文件，根据你的数据源配置：

```bash
# Garmin 认证 Token（方案 A 使用）
GARMIN_SECRET_STRING="your_garmin_token_here"

# 或 Strava 认证（方案 B 使用）
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
STRAVA_REFRESH_TOKEN=your_strava_refresh_token

# 个人心率参数 (用于计算心率区间和 VDOT)
MAX_HR=190        # 最大心率
RESTING_HR=55     # 静息心率
```

### 4. 初始化数据

根据你选择的数据源执行对应命令：

**Garmin 数据源**

```bash
# 一键同步所有历史数据
npm run init:data

# 或者手动测试同步最近 5 条记录
node scripts/garmin/sync.js --limit 5
```

**Strava 数据源**

```bash
# 同步最近 30 天跑步活动（默认）
npm run sync:strava

# 同步最近 5 次活动
node scripts/strava/sync.js --limit 5

# 同步指定日期范围的活动
node scripts/strava/sync.js --after 2024-01-01 --before 2024-12-31
```

### 5. 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:3000
```

## 部署到 Vercel

详细部署指南请参考 [部署文档](docs/deployment.md)

### 快速部署步骤

1. **Fork 本仓库** 到你的 GitHub 账号（[点击 Fork](https://github.com/xuandao/pbRun)）。后续操作都在你 Fork 的仓库中进行，不要直接在上游仓库改配置。

2. **配置 GitHub Secrets**
   - 进入仓库 Settings > Secrets > Actions
   - 添加以下 Secrets（根据你的数据源选择配置）：

   | Secret | 说明 | 获取方式 |
   |--------|------|---------|
   | **Garmin 相关** |||
   | `GARMIN_SECRET_STRING` | Garmin 认证 Token | 运行 `python3 scripts/garmin/get_garmin_token.py` |
   | **Strava 相关** |||
   | `STRAVA_CLIENT_ID` | Strava App Client ID | [Strava API Settings](https://www.strava.com/settings/api) |
   | `STRAVA_CLIENT_SECRET` | Strava App Client Secret | 同上 |
   | `STRAVA_REFRESH_TOKEN` | Strava Refresh Token | 运行 `npm run auth:strava` |
   | **通用配置** |||
   | `MAX_HR` | 最大心率（可选）| 个人心率数据 |
   | `RESTING_HR` | 静息心率（可选）| 个人心率数据 |

3. **配置默认数据源（可选）**
   
   编辑 `.github/workflows/sync_running_data.yml` 修改默认数据源：
   ```yaml
   env:
     # 默认同步源 (push 和定时触发时使用)
     DEFAULT_SYNC_SOURCE: 'strava'  # 改为 'garmin' 或 'strava'
   ```

4. **连接 Vercel**
   - 登录 [Vercel](https://vercel.com)
   - 导入你 Fork 的仓库
   - 自动检测 Next.js 项目，一键部署

5. **启动自动同步**
   - GitHub Actions 会每 8 小时自动运行
   - 支持手动触发并选择数据源（Garmin 或 Strava）
   - 同步数据后自动提交到仓库
   - Vercel 检测到数据库更新后自动重新部署

## 功能特性

- ✅ **双数据源** - 支持 Garmin FIT 文件和 Strava API 导入
- ✅ **活动列表** - 查看所有跑步记录，支持按月份筛选
- ✅ **活动详情** - 详细的配速、心率、海拔数据和分段信息
- ✅ **统计分析** - 月度/年度里程、跑量、个人记录
- ✅ **跑力分析** - VDOT 趋势图，追踪训练效果
- ✅ **心率区间** - 分析有氧/无氧训练占比
- ✅ **配速分布** - 识别舒适配速区间
- ✅ **训练建议** - 基于 Daniels 训练法的配速建议

## 项目结构

```
pbRun/
├── app/                    # Next.js 应用
│   ├── api/               # API 路由 (RESTful)
│   ├── list/              # 活动列表页面
│   ├── analysis/          # 数据分析页面
│   ├── stats/             # 统计页面
│   └── lib/               # 工具库 (数据库、格式化)
├── scripts/               # 数据同步脚本
│   ├── common/            # 通用模块
│   │   ├── db-manager.js  # 数据库操作
│   │   ├── vdot-calculator.js # VDOT 计算
│   │   └── utils.js       # 工具函数
│   ├── garmin/            # Garmin 数据源
│   │   ├── sync.js        # Garmin 同步脚本
│   │   ├── client.js      # Garmin API 客户端
│   │   ├── fit-parser.js  # FIT 文件解析
│   │   └── get_garmin_token.py # Token 获取
│   └── strava/            # Strava 数据源
│       ├── sync.js        # Strava 同步脚本
│       ├── fetcher.py     # Strava API 数据拉取
│       ├── oauth_helper.py # OAuth 授权助手
│       └── gpx_generator.py # GPX 轨迹生成
├── .github/workflows/     # GitHub Actions
│   └── sync_running_data.yml  # 统一的数据同步工作流
├── app/data/              # SQLite 数据库
│   └── activities.db
└── docs/                  # 文档
    ├── deployment.md      # 部署指南
    ├── data-sync.md       # 数据同步说明
    └── api-reference.md   # API 接口文档
```

## API 接口

| 端点 | 说明 | 参数 |
|------|------|------|
| `GET /api/activities` | 获取活动列表 | `month`, `limit`, `offset` |
| `GET /api/activities/[id]` | 获取活动详情 | - |
| `GET /api/activities/[id]/laps` | 获取分段数据 | - |
| `GET /api/stats` | 获取统计数据 | `year`, `month` |
| `GET /api/vdot` | 获取 VDOT 趋势 | `days` |
| `GET /api/analysis/hr-zones` | 心率区间分析 | `month` |
| `GET /api/analysis/pace-zones` | 配速分布分析 | `month` |

完整 API 文档: [docs/api-reference.md](docs/api-reference.md)

## 文档

- [部署指南](docs/deployment.md) - Vercel 部署和 GitHub Actions 配置
- [数据同步说明](docs/data-sync.md) - Garmin 和 Strava 数据同步原理和配置
- [Strava 配置指南](docs/strava-setup.md) - Strava OAuth 应用配置详细步骤
- [API 参考](docs/api-reference.md) - 完整的 API 接口文档
- [VDOT 计算说明](docs/vdot-calculation.md) - 跑力计算公式和原理
- [常见问题](docs/faq.md) - 常见问题解答

## 贡献

欢迎提交 Issue 和 Pull Request！

### 开发指南

请先 [Fork 本仓库](https://github.com/xuandao/pbRun)，再克隆**你 Fork 的仓库**到本地：

```bash
# 将 YOUR_USERNAME 替换为你的 GitHub 用户名
git clone git@github.com:YOUR_USERNAME/pbRun.git
cd pbRun

# 安装依赖（macOS 若遇 better-sqlite3 编译错误，改用：SDKROOT=$(xcrun --sdk macosx --show-sdk-path) npm install）
npm install

# 安装 Python 依赖（用于 Strava 同步和 Garmin Token 获取）
pip3 install stravalib gpxpy requests garminconnect

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 运行数据验证
node scripts/garmin/validate-data.js
```

## 开源协议

[MIT License](LICENSE)

---

## Star History

如果这个项目对你有帮助，请给一个 ⭐️ Star！

## 致谢

- [yihong0618/running_page](https://github.com/yihong0618/running_page) - 本项目实现参考该开源项目（Make your own running home page）
- [Jack Daniels' Running Formula](https://www.amazon.com/Daniels-Running-Formula-Jack-Tupper/dp/1450431836) - VDOT 理论基础
- [Garmin Connect](https://connect.garmin.com/) - Garmin 数据源
- [Strava](https://www.strava.com/) - Strava 数据源
- [Next.js](https://nextjs.org/) - Web 框架
- [Vercel](https://vercel.com/) - 部署平台
