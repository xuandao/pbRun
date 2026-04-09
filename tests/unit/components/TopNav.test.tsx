import { render, screen } from '@testing-library/react';
import TopNav from '@/app/components/TopNav';

// Mock next/navigation
const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

describe('TopNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/list');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('应渲染导航项', () => {
    render(<TopNav />);
    expect(screen.getByText('运动记录')).toBeInTheDocument();
    expect(screen.getByText('运动分析')).toBeInTheDocument();
    expect(screen.getByText('运动统计')).toBeInTheDocument();
  });

  test('在 /list 页面时应高亮"运动记录"', () => {
    mockUsePathname.mockReturnValue('/list');
    render(<TopNav />);

    const listLink = screen.getByText('运动记录');
    expect(listLink).toHaveClass('border-emerald-300');
  });

  test('在 /pages/[id] 页面时应高亮"运动记录"', () => {
    mockUsePathname.mockReturnValue('/pages/12345');
    render(<TopNav />);

    const listLink = screen.getByText('运动记录');
    expect(listLink).toHaveClass('border-emerald-300');
  });

  test('在 /analysis 页面时应高亮"运动分析"', () => {
    mockUsePathname.mockReturnValue('/analysis');
    render(<TopNav />);

    const analysisLink = screen.getByText('运动分析');
    expect(analysisLink).toHaveClass('border-emerald-300');
  });

  test('在 /analysis/zone/1 页面时应高亮"运动分析"', () => {
    mockUsePathname.mockReturnValue('/analysis/zone/1');
    render(<TopNav />);

    const analysisLink = screen.getByText('运动分析');
    expect(analysisLink).toHaveClass('border-emerald-300');
  });

  test('在 /daniels 页面时应高亮"运动分析"', () => {
    mockUsePathname.mockReturnValue('/daniels');
    render(<TopNav />);

    const analysisLink = screen.getByText('运动分析');
    expect(analysisLink).toHaveClass('border-emerald-300');
  });

  test('在 /stats 页面时应高亮"运动统计"', () => {
    mockUsePathname.mockReturnValue('/stats');
    render(<TopNav />);

    const statsLink = screen.getByText('运动统计');
    expect(statsLink).toHaveClass('border-emerald-300');
  });

  test('非活动项应有透明边框', () => {
    mockUsePathname.mockReturnValue('/list');
    render(<TopNav />);

    const analysisLink = screen.getByText('运动分析');
    expect(analysisLink).toHaveClass('border-transparent');
  });

  test('链接应指向正确路径', () => {
    render(<TopNav />);

    expect(screen.getByText('运动记录').closest('a')).toHaveAttribute('href', '/list');
    expect(screen.getByText('运动分析').closest('a')).toHaveAttribute('href', '/analysis');
    expect(screen.getByText('运动统计').closest('a')).toHaveAttribute('href', '/stats');
  });
});
