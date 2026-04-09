# 测试指南

## 测试架构

本项目采用三层测试架构:

```
┌─────────────────────────────────────────────────────────────┐
│                      E2E 测试 (Playwright)                   │
│              页面交互、用户流程、多端适配                      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     集成测试 (Jest)                          │
│              数据同步流程、API端到端                          │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     单元测试 (Jest)                          │
│        工具函数、组件、API路由、数据库、Python脚本            │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

```bash
# 安装依赖
npm install

# 运行所有单元测试
npm run test:unit

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e

# 运行 Python 测试
python -m pytest tests/python/ -v
```

## 测试详情

### 单元测试 (Jest)

**文件位置**: `tests/unit/`

| 模块 | 测试数 | 说明 |
|------|--------|------|
| `lib/date-utils.test.ts` | 14 | 日期范围计算、月份转换 |
| `lib/vdot-pace.test.ts` | 15 | VDOT计算、配速区间 |
| `lib/format.test.ts` | 45 | 格式化函数 |
| `lib/db.test.ts` | 15 | 数据库查询、统计 |
| `components/TopNav.test.tsx` | 10 | 导航组件 |
| `strava/*.test.js` | 127 | Strava同步测试 |

**运行**:
```bash
npm run test:unit
```

### E2E 测试 (Playwright)

**文件位置**: `tests/e2e/`

| 测试文件 | 说明 |
|---------|------|
| `navigation.spec.ts` | 页面导航测试 |
| `activity-list.spec.ts` | 活动列表页测试 |
| `activity-detail.spec.ts` | 活动详情页测试 |
| `stats.spec.ts` | 统计页面测试 |
| `mobile.spec.ts` | 移动端适配测试 |

**运行**:
```bash
# 运行所有 E2E 测试
npm run test:e2e

# 使用 UI 模式运行
npm run test:e2e:ui

# 运行特定浏览器
npx playwright test --project=chromium
```

### Python 测试 (pytest)

**文件位置**: `tests/python/`

| 测试文件 | 说明 |
|---------|------|
| `test_fetcher_strava.py` | Strava数据获取器测试 |
| `test_get_garmin_token.py` | Garmin认证工具测试 |

**运行**:
```bash
python -m pytest tests/python/ -v
```

## 测试覆盖率

当前测试覆盖情况:

| 类型 | 测试数 | 状态 |
|------|--------|------|
| 单元测试 | 226 | ✅ 通过 |
| E2E 测试 | 45 | ✅ 通过 |
| Python 测试 | 24 | ✅ 通过 |

## CI/CD

GitHub Actions 配置在 `.github/workflows/test.yml`，包含:

- **Unit Tests**: Jest 单元测试 + 覆盖率上传
- **E2E Tests**: Playwright 端到端测试
- **Python Tests**: pytest Python脚本测试
- **Lint**: ESLint 代码检查
- **Build**: Next.js 构建检查

## 编写测试

### 单元测试示例

```typescript
// tests/unit/lib/example.test.ts
import { myFunction } from '@/app/lib/example';

describe('myFunction', () => {
  test('应正确处理正常输入', () => {
    expect(myFunction('input')).toBe('expected');
  });

  test('应正确处理边界情况', () => {
    expect(myFunction(null)).toBeNull();
  });
});
```

### E2E 测试示例

```typescript
// tests/e2e/example.spec.ts
import { test, expect } from '@playwright/test';

test('应显示页面标题', async ({ page }) => {
  await page.goto('/example');
  await expect(page.locator('h1')).toContainText('Example');
});
```

### Python 测试示例

```python
# tests/python/test_example.py
def test_example():
    assert my_function() == expected_result
```

## 测试数据

测试数据存放在:
- `tests/fixtures/` - 测试数据文件
- `tests/mocks/` - Mock 数据

## 调试

### Jest 调试

```bash
# 单步调试
node --inspect-brk node_modules/.bin/jest --runInBand

# 只运行特定测试
npm run test:unit -- --testNamePattern="should calculate"
```

### Playwright 调试

```bash
# UI 模式
npx playwright test --ui

# 调试特定测试
npx playwright test --debug
```

## 注意事项

1. **数据库测试**: 使用 Mock，不依赖真实数据库
2. **E2E 测试**: 需要开发服务器运行 (`npm run dev`)
3. **Python 测试**: 需要安装 `garth` 库用于 Garmin 认证
4. **覆盖率**: 目标覆盖率 80%+
