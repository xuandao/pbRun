# pbRun 完整测试方案

## 1. 测试架构概览

```
tests/
├── unit/                    # 单元测试 (Jest)
│   ├── lib/                # 工具函数测试
│   ├── components/         # React组件测试
│   ├── api/                # API路由测试
│   ├── db/                 # 数据库层测试
│   ├── garmin/             # Garmin同步测试
│   └── strava/             # Strava同步测试
├── integration/            # 集成测试 (Jest)
│   ├── api-flows/          # API流程测试
│   ├── sync-flows/         # 数据同步流程测试
│   └── e2e-api/            # 端到端API测试
├── e2e/                    # E2E UI测试 (Playwright)
│   ├── pages/              # 页面级测试
│   ├── flows/              # 用户流程测试
│   └── fixtures/           # 测试数据
├── python/                 # Python脚本测试 (pytest)
│   ├── test_fetcher_garmin.py
│   └── test_fetcher_strava.py
└── mocks/                  # 测试模拟数据
    ├── strava/
    ├── garmin/
    └── activities.json
```

## 2. 单元测试 (Jest)

### 2.1 配置

**jest.config.js**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/unit', '<rootDir>/app'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'scripts/**/*.js',
    '!app/**/*.d.ts',
    '!app/**/node_modules/**',
  ],
  testMatch: [
    '**/__tests__/**/*.test.{ts,tsx,js}',
    '**/?(*.)+(spec|test).{ts,tsx,js}',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
```

**tests/setup.ts**
```typescript
// 全局测试配置
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  redirect: jest.fn(),
}));

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      get: jest.fn(),
      all: jest.fn().mockReturnValue([]),
      run: jest.fn(),
    }),
    close: jest.fn(),
  }));
});
```

### 2.2 测试用例设计

#### lib/date-utils.ts
```typescript
// tests/unit/lib/date-utils.test.ts
describe('date-utils', () => {
  describe('monthToRange', () => {
    test('应正确转换月份到日期范围', () => {
      const result = monthToRange('2024-03');
      expect(result).toEqual({
        startDate: '2024-03-01',
        endDate: '2024-03-31',
      });
    });

    test('应正确处理闰年2月', () => {
      const result = monthToRange('2024-02');
      expect(result.endDate).toBe('2024-02-29');
    });

    test('应正确处理非闰年2月', () => {
      const result = monthToRange('2023-02');
      expect(result.endDate).toBe('2023-02-28');
    });
  });
});
```

#### lib/vdot-pace.ts
```typescript
// tests/unit/lib/vdot-pace.test.ts
describe('vdot-pace', () => {
  describe('calculateVdotFromPace', () => {
    test('应正确计算VDOT值', () => {
      // 配速 5:00/km, 心率 150, 最大心率 190, 静息心率 55
      const vdot = calculateVdotFromPace(300, 150, 190, 55);
      expect(vdot).toBeGreaterThan(0);
      expect(vdot).toBeLessThan(100);
    });

    test('心率数据缺失时应返回null', () => {
      const vdot = calculateVdotFromPace(300, null, 190, 55);
      expect(vdot).toBeNull();
    });

    test('应处理边界配速值', () => {
      // 非常快的配速
      const vdotFast = calculateVdotFromPace(180, 180, 190, 55);
      expect(vdotFast).toBeGreaterThan(50);
    });
  });

  describe('getPaceZoneBoundsFromVdot', () => {
    test('应返回5个配速区间', () => {
      const bounds = getPaceZoneBoundsFromVdot(50);
      expect(Object.keys(bounds)).toHaveLength(5);
      expect(bounds[1]).toHaveProperty('paceMin');
      expect(bounds[1]).toHaveProperty('paceMax');
    });

    test('VDOT为0时应返回空数组', () => {
      const bounds = getPaceZoneBoundsFromVdot(0);
      expect(bounds).toEqual([]);
    });
  });
});
```

#### lib/db.ts
```typescript
// tests/unit/db/db-queries.test.ts
describe('Database Queries', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      }),
    };
  });

  describe('getActivities', () => {
    test('应支持分页查询', () => {
      const result = getActivities({ page: 1, limit: 20 });
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0 });
    });

    test('应支持日期范围过滤', () => {
      getActivities({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });
      // 验证SQL包含日期条件
    });

    test('应支持类型过滤', () => {
      getActivities({ type: 'running' });
      // 验证SQL包含类型条件
    });
  });

  describe('getPersonalRecords', () => {
    test('应返回各距离最佳成绩', () => {
      const result = getPersonalRecords('total');
      expect(result.records).toHaveLength(6); // 1.6k, 3k, 5k, 10k, 半马, 全马
    });

    test('应计算最长跑步距离', () => {
      const result = getPersonalRecords('month');
      expect(result).toHaveProperty('longestRunMeters');
      expect(result).toHaveProperty('longestRunDate');
    });
  });
});
```

#### React Components
```typescript
// tests/unit/components/ListClient.test.tsx
describe('ListClient', () => {
  const mockProps = {
    initialMonthSummaries: [
      { monthKey: '2024-03', totalDistance: 100, count: 5 },
    ],
    initialTotalMonths: 12,
    initialActivitiesByMonth: {},
    initialExpandedMonth: null,
  };

  test('应渲染月份列表', () => {
    render(<ListClient {...mockProps} />);
    expect(screen.getByText('2024年03月')).toBeInTheDocument();
  });

  test('点击月份应展开活动详情', async () => {
    render(<ListClient {...mockProps} />);
    const monthHeader = screen.getByText('2024年03月');
    await userEvent.click(monthHeader);
    // 验证API调用或子组件渲染
  });

  test('应支持搜索过滤', async () => {
    render(<ListClient {...mockProps} />);
    const searchInput = screen.getByPlaceholderText('搜索活动...');
    await userEvent.type(searchInput, 'Morning Run');
    // 验证过滤逻辑
  });
});
```

#### API Routes
```typescript
// tests/unit/api/activities.test.ts
import { GET } from '@/app/api/activities/route';

describe('API - /api/activities', () => {
  test('GET应返回活动列表', async () => {
    const request = new Request('http://localhost/api/activities?page=1&limit=20');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('pagination');
  });

  test('GET应支持日期过滤', async () => {
    const request = new Request(
      'http://localhost/api/activities?startDate=2024-01-01&endDate=2024-12-31'
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
```

### 2.3 测试优先级

| 模块 | 优先级 | 覆盖率目标 |
|------|--------|-----------|
| lib/vdot-pace.ts | P0 | 90%+ |
| lib/date-utils.ts | P0 | 90%+ |
| lib/db.ts | P0 | 80%+ |
| lib/format.ts | P1 | 80%+ |
| API Routes | P0 | 85%+ |
| React Components | P1 | 70%+ |
| 同步脚本 | P0 | 80%+ |

---

## 3. E2E UI测试 (Playwright)

### 3.1 配置

**playwright.config.ts**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 3.2 测试用例设计

#### 页面导航测试
```typescript
// tests/e2e/pages/navigation.spec.ts
test.describe('页面导航', () => {
  test('首页应重定向到活动列表', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/list');
  });

  test('应能访问统计页面', async ({ page }) => {
    await page.goto('/stats');
    await expect(page).toHaveTitle(/统计/);
    await expect(page.locator('h1')).toContainText('统计');
  });

  test('应能访问分析页面', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.locator('text=心率区间分析')).toBeVisible();
  });

  test('无效页面应显示404', async ({ page }) => {
    await page.goto('/nonexistent');
    await expect(page.locator('text=404')).toBeVisible();
  });
});
```

#### 活动列表页测试
```typescript
// tests/e2e/pages/activity-list.spec.ts
test.describe('活动列表页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/list');
  });

  test('应显示月份列表', async ({ page }) => {
    await expect(page.locator('[data-testid="month-item"]')).toHaveCount.greaterThan(0);
  });

  test('点击月份应展开活动列表', async ({ page }) => {
    const firstMonth = page.locator('[data-testid="month-item"]').first();
    await firstMonth.click();
    await expect(page.locator('[data-testid="activity-item"]')).toBeVisible();
  });

  test('应支持无限滚动加载更多月份', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('[data-testid="month-item"]')).toHaveCount.greaterThan(6);
  });

  test('搜索功能应过滤活动', async ({ page }) => {
    await page.fill('[data-testid="search-input"]', 'Morning');
    await expect(page.locator('[data-testid="activity-item"]')).toContainText('Morning');
  });

  test('点击活动应跳转到详情页', async ({ page }) => {
    const firstMonth = page.locator('[data-testid="month-item"]').first();
    await firstMonth.click();
    const activity = page.locator('[data-testid="activity-item"]').first();
    await activity.click();
    await expect(page).toHaveURL(/\/pages\/\d+/);
  });
});
```

#### 活动详情页测试
```typescript
// tests/e2e/pages/activity-detail.spec.ts
test.describe('活动详情页', () => {
  test('应显示活动基本信息', async ({ page }) => {
    await page.goto('/pages/12345');
    await expect(page.locator('[data-testid="activity-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="activity-distance"]')).toBeVisible();
    await expect(page.locator('[data-testid="activity-duration"]')).toBeVisible();
  });

  test('应显示配速图表', async ({ page }) => {
    await page.goto('/pages/12345');
    await expect(page.locator('[data-testid="pace-chart"]')).toBeVisible();
  });

  test('应显示分段数据表格', async ({ page }) => {
    await page.goto('/pages/12345');
    await expect(page.locator('[data-testid="laps-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="laps-table-row"]')).toHaveCount.greaterThan(0);
  });

  test('无效活动ID应显示404', async ({ page }) => {
    await page.goto('/pages/999999999');
    await expect(page.locator('text=活动未找到')).toBeVisible();
  });
});
```

#### 统计分析页测试
```typescript
// tests/e2e/pages/stats.spec.ts
test.describe('统计页面', () => {
  test('应显示总体统计数据', async ({ page }) => {
    await page.goto('/stats');
    await expect(page.locator('[data-testid="total-distance"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-activities"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-pace"]')).toBeVisible();
  });

  test('应支持切换时间周期', async ({ page }) => {
    await page.goto('/stats');
    await page.selectOption('[data-testid="period-selector"]', 'month');
    await expect(page.locator('[data-testid="stats-container"]')).toBeVisible();
  });

  test('应显示个人纪录表格', async ({ page }) => {
    await page.goto('/stats');
    await expect(page.locator('[data-testid="pr-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="pr-row"]')).toHaveCount(6);
  });
});
```

#### 分析页面测试
```typescript
// tests/e2e/pages/analysis.spec.ts
test.describe('分析页面', () => {
  test('应显示心率区间图表', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.locator('[data-testid="hr-zone-chart"]')).toBeVisible();
  });

  test('应支持按周/月聚合切换', async ({ page }) => {
    await page.goto('/analysis');
    await page.click('[data-testid="group-by-week"]');
    await expect(page.locator('[data-testid="chart-week-label"]')).toBeVisible();
    await page.click('[data-testid="group-by-month"]');
    await expect(page.locator('[data-testid="chart-month-label"]')).toBeVisible();
  });

  test('VDOT趋势页面应显示趋势图', async ({ page }) => {
    await page.goto('/analysis');
    await page.click('text=VDOT趋势');
    await expect(page.locator('[data-testid="vdot-trend-chart"]')).toBeVisible();
  });
});
```

#### 移动端适配测试
```typescript
// tests/e2e/mobile/responsive.spec.ts
test.describe('移动端响应式', () => {
  test('活动列表在移动端应正常显示', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/list');
    await expect(page.locator('[data-testid="month-item"]')).toBeVisible();
  });

  test('图表在移动端应可横向滚动', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/analysis');
    const chart = page.locator('[data-testid="hr-zone-chart"]');
    await chart.scrollIntoViewIfNeeded();
    await expect(chart).toBeVisible();
  });
});
```

### 3.3 测试优先级

| 测试场景 | 优先级 | 说明 |
|---------|--------|------|
| 首页/列表页基本功能 | P0 | 核心功能 |
| 活动详情页 | P0 | 核心功能 |
| 统计页面 | P0 | 核心功能 |
| 分析页面图表 | P1 | 重要功能 |
| 移动端适配 | P1 | 用户体验 |
| 错误页面 | P2 | 边界情况 |

---

## 4. 集成测试

### 4.1 数据同步流程测试

```typescript
// tests/integration/sync-flows/garmin-sync.spec.ts
describe('Garmin 同步流程', () => {
  test('完整同步流程：下载 → 解析 → 存储', async () => {
    // 1. 模拟FIT文件下载
    // 2. 验证解析结果
    // 3. 验证数据库写入
    // 4. 验证缓存更新
  });

  test('增量同步应只处理新文件', async () => {
    // 验证已存在文件被跳过
  });

  test('错误文件应被记录并跳过', async () => {
    // 验证损坏FIT文件的处理
  });
});
```

### 4.2 API 集成测试

```typescript
// tests/integration/api-flows/activity-crud.spec.ts
describe('Activity API 流程', () => {
  test('获取活动 → 获取详情 → 获取分段数据', async () => {
    // 1. 获取活动列表
    const listRes = await fetch('/api/activities?limit=1');
    const listData = await listRes.json();

    // 2. 获取首个活动详情
    const activityId = listData.data[0].activity_id;
    const detailRes = await fetch(`/api/activities/${activityId}`);
    expect(detailRes.status).toBe(200);

    // 3. 获取分段数据
    const lapsRes = await fetch(`/api/activities/${activityId}/laps`);
    expect(lapsRes.status).toBe(200);
  });
});
```

---

## 5. Python 脚本测试 (pytest)

### 5.1 配置

**tests/python/conftest.py**
```python
import pytest
import tempfile
import os

@pytest.fixture
def temp_db():
    """提供临时数据库"""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    yield db_path
    os.unlink(db_path)

@pytest.fixture
def mock_strava_response():
    """模拟Strava API响应"""
    return {
        "id": 12345,
        "name": "Morning Run",
        "distance": 10000,
        "moving_time": 3600,
        "average_heartrate": 150,
        "max_heartrate": 170,
    }
```

### 5.2 测试用例

```python
# tests/python/test_fetcher_strava.py
def test_fetch_activities(strava_fetcher, mock_response):
    """测试获取活动列表"""
    activities = strava_fetcher.fetch_activities(limit=10)
    assert len(activities) <= 10
    assert all('id' in a for a in activities)

def test_fetch_activity_detail(strava_fetcher):
    """测试获取活动详情"""
    detail = strava_fetcher.fetch_activity_detail(12345)
    assert detail['id'] == 12345
    assert 'laps' in detail or 'splits_metric' in detail

def test_gpx_export(strava_fetcher, tmp_path):
    """测试GPX导出"""
    output_dir = tmp_path / "gpx"
    output_dir.mkdir()

    gpx_path = strava_fetcher.export_gpx(12345, output_dir)
    assert gpx_path.exists()
    assert gpx_path.suffix == '.gpx'

def test_rate_limit_handling(strava_fetcher):
    """测试速率限制处理"""
    # 模拟429响应
    with pytest.raises(RateLimitError):
        strava_fetcher.handle_rate_limit()
```

---

## 6. 测试数据管理

### 6.1 测试数据库

**tests/fixtures/test-data.sql**
```sql
-- 创建测试活动数据
INSERT INTO activities (activity_id, name, activity_type, start_time, start_time_local,
                       distance, duration, average_pace, average_heart_rate, vdot_value)
VALUES
  (1, 'Test Run 1', 'running', '2024-01-01T08:00:00Z', '2024-01-01 16:00:00', 10.0, 3600, 360, 150, 45.5),
  (2, 'Test Run 2', 'running', '2024-01-02T08:00:00Z', '2024-01-02 16:00:00', 15.0, 5400, 360, 155, 47.0);

-- 创建测试分段数据
INSERT INTO activity_laps (activity_id, lap_index, distance, duration, average_pace)
VALUES
  (1, 1, 1000, 360, 360),
  (1, 2, 1000, 350, 350);
```

**scripts/setup-test-db.js**
```javascript
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function setupTestDb() {
  const testDbPath = path.join(__dirname, '../tests/fixtures/test.db');
  const db = new Database(testDbPath);

  const sql = fs.readFileSync(
    path.join(__dirname, '../tests/fixtures/test-data.sql'),
    'utf-8'
  );
  db.exec(sql);
  db.close();

  console.log('Test database created at:', testDbPath);
}

setupTestDb();
```

### 6.2 Mock数据

**tests/mocks/strava/activities.json**
```json
{
  "activities": [
    {
      "id": 123456789,
      "name": "Morning Run",
      "distance": 10000,
      "moving_time": 3600,
      "elapsed_time": 3700,
      "total_elevation_gain": 50,
      "type": "Run",
      "start_date": "2024-01-15T06:00:00Z",
      "average_heartrate": 150,
      "max_heartrate": 170,
      "average_cadence": 180
    }
  ]
}
```

---

## 7. CI/CD 集成

### 7.1 GitHub Actions 配置

**.github/workflows/test.yml**
```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install pytest pytest-cov
      - run: pytest tests/python/ --cov=scripts --cov-report=xml
```

### 7.2 本地运行脚本

**package.json 更新**
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest --testPathPattern=tests/unit",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:python": "pytest tests/python/",
    "test:coverage": "jest --coverage && pytest --cov=scripts",
    "test:setup": "node scripts/setup-test-db.js"
  }
}
```

---

## 8. 测试执行计划

### Phase 1: 基础单元测试 (Week 1-2)
- [ ] 配置 Jest + Testing Library
- [ ] 实现 lib/ 工具函数测试
- [ ] 实现 db/ 数据库查询测试
- [ ] 实现 API Routes 测试

### Phase 2: 组件单元测试 (Week 2-3)
- [ ] 配置 React Testing Library
- [ ] 实现核心组件测试
- [ ] 实现页面级组件测试

### Phase 3: E2E测试 (Week 3-4)
- [ ] 配置 Playwright
- [ ] 实现页面导航测试
- [ ] 实现核心用户流程测试
- [ ] 实现移动端适配测试

### Phase 4: 集成测试 (Week 4-5)
- [ ] 实现数据同步流程测试
- [ ] 实现端到端API测试
- [ ] Python脚本测试

### Phase 5: CI/CD集成 (Week 5)
- [ ] 配置 GitHub Actions
- [ ] 配置测试覆盖率报告
- [ ] 配置测试数据管理

---

## 9. 质量保证检查清单

### 代码提交前
- [ ] 所有单元测试通过
- [ ] 新增代码覆盖率 > 80%
- [ ] 没有 TypeScript 错误
- [ ] ESLint 检查通过

### PR合并前
- [ ] 所有集成测试通过
- [ ] E2E 核心流程测试通过
- [ ] Code Review 完成
- [ ] 性能测试无退化

### 发布前
- [ ] 全量 E2E 测试通过
- [ ] Python 脚本测试通过
- [ ] 生产环境配置验证
- [ ] 回滚方案准备

---

## 10. 预期结果

| 测试类型 | 目标覆盖率 | 执行时间 |
|---------|-----------|---------|
| 单元测试 | 80%+ | < 30s |
| 集成测试 | 70%+ | < 60s |
| E2E测试 | 核心流程100% | < 5min |
| Python测试 | 75%+ | < 30s |

**总测试执行时间目标**: < 10分钟 (CI环境)
