"""
Strava Fetcher 功能测试
测试数据获取、转换、GPX生成等核心功能
"""

import sys
import os
import unittest
from datetime import timedelta
from unittest.mock import Mock, patch, MagicMock

# Add scripts/strava to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'strava'))

# Mock external dependencies before import
sys.modules['stravalib'] = MagicMock()
sys.modules['stravalib.client'] = MagicMock()
sys.modules['gpxpy'] = MagicMock()
sys.modules['gpxpy.gpx'] = MagicMock()

from fetcher import (
    parse_quantity,
    format_duration,
    format_pace,
    pace_to_seconds,
    infer_sub_sport_type,
    StravaFetcher,
)


class TestParseQuantity(unittest.TestCase):
    """测试数值解析功能"""

    def test_parse_none(self):
        """测试空值处理"""
        self.assertEqual(parse_quantity(None), 0.0)

    def test_parse_number(self):
        """测试普通数值"""
        self.assertEqual(parse_quantity(100), 100.0)
        self.assertEqual(parse_quantity(3.5), 3.5)

    def test_parse_quantity_object(self):
        """测试 pint Quantity 对象"""
        mock_qty = Mock()
        mock_qty.magnitude = 5000
        self.assertEqual(parse_quantity(mock_qty), 5000.0)


class TestFormatDuration(unittest.TestCase):
    """测试时长格式化功能"""

    def test_format_none(self):
        """测试空值"""
        self.assertIsNone(format_duration(None))

    def test_format_timedelta(self):
        """测试 timedelta 对象"""
        td = timedelta(seconds=3661)
        self.assertEqual(format_duration(td), "1:01:01")

    def test_format_seconds(self):
        """测试秒数"""
        self.assertEqual(format_duration(61), "1:01")
        self.assertEqual(format_duration(3661), "1:01:01")
        self.assertEqual(format_duration(1500), "25:00")


class TestFormatPace(unittest.TestCase):
    """测试配速格式化功能"""

    def test_format_none(self):
        """测试空值和零值"""
        self.assertIsNone(format_pace(None))
        self.assertIsNone(format_pace(0))

    def test_format_valid(self):
        """测试有效配速"""
        # 4.0 m/s = 4:10/km
        self.assertEqual(format_pace(4.0), "4:10")
        # 3.33 m/s ≈ 5:00/km
        self.assertEqual(format_pace(3.33), "5:00")


class TestPaceToSeconds(unittest.TestCase):
    """测试配速转秒数功能"""

    def test_pace_none(self):
        """测试空值"""
        self.assertIsNone(pace_to_seconds(None))
        self.assertIsNone(pace_to_seconds(0))

    def test_pace_valid(self):
        """测试有效配速"""
        # 4.0 m/s = 250 sec/km = 4:10
        self.assertEqual(pace_to_seconds(4.0), 250)
        # 3.33 m/s ≈ 300 sec/km = 5:00
        self.assertEqual(pace_to_seconds(3.33), 300)


class TestInferSubSportType(unittest.TestCase):
    """测试子类型推断功能"""

    def test_treadmill_no_gps(self):
        """测试无 GPS 时识别为跑步机"""
        activity = Mock()
        activity.map = None
        self.assertEqual(infer_sub_sport_type(activity), '跑步机')

    def test_treadmill_empty_polyline(self):
        """测试空轨迹时识别为跑步机"""
        activity = Mock()
        activity.map = Mock()
        activity.map.summary_polyline = None
        self.assertEqual(infer_sub_sport_type(activity), '跑步机')

    def test_treadmill_from_name(self):
        """测试从名称识别跑步机"""
        activity = Mock()
        activity.map = Mock()
        activity.map.summary_polyline = "some_polyline"
        activity.name = "Morning Treadmill Run"
        self.assertEqual(infer_sub_sport_type(activity), '跑步机')

    def test_trail_from_name(self):
        """测试从名称识别越野"""
        activity = Mock()
        activity.map = Mock()
        activity.map.summary_polyline = "some_polyline"
        activity.name = "Trail Running in Mountains"
        self.assertEqual(infer_sub_sport_type(activity), '越野')

    def test_road_default(self):
        """测试默认路跑"""
        activity = Mock()
        activity.map = Mock()
        activity.map.summary_polyline = "some_polyline"
        activity.name = "Morning Run"
        self.assertEqual(infer_sub_sport_type(activity), '路跑')


class TestStravaFetcher(unittest.TestCase):
    """测试 StravaFetcher 类"""

    def setUp(self):
        """测试前准备"""
        with patch('fetcher.Client'):
            self.fetcher = StravaFetcher('client_id', 'client_secret', 'refresh_token')

    def test_init(self):
        """测试初始化"""
        self.assertEqual(self.fetcher.client_id, 'client_id')
        self.assertEqual(self.fetcher.client_secret, 'client_secret')
        self.assertEqual(self.fetcher.refresh_token, 'refresh_token')


class TestDataTransformation(unittest.TestCase):
    """测试数据转换功能"""

    def test_transform_basic_fields(self):
        """测试基本字段转换"""
        # 这里可以添加 transform_activity_data 的详细测试
        pass

    def test_transform_distance(self):
        """测试距离转换"""
        # 米转公里
        pass

    def test_transform_pace(self):
        """测试配速转换"""
        # m/s 转秒/公里
        pass


if __name__ == '__main__':
    unittest.main()
