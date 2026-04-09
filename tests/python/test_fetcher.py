"""
Phase 2 Unit Tests - Strava Python modules
"""

import sys
import os
import json
import unittest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

# Add scripts/strava to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'strava'))

# Mock stravalib before import
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
    def test_parse_none(self):
        self.assertEqual(parse_quantity(None), 0.0)

    def test_parse_number(self):
        self.assertEqual(parse_quantity(100), 100.0)
        self.assertEqual(parse_quantity(3.5), 3.5)

    def test_parse_quantity_object(self):
        mock_qty = Mock()
        mock_qty.magnitude = 5000
        self.assertEqual(parse_quantity(mock_qty), 5000.0)


class TestFormatDuration(unittest.TestCase):
    def test_format_none(self):
        self.assertIsNone(format_duration(None))

    def test_format_timedelta(self):
        td = timedelta(seconds=3661)
        self.assertEqual(format_duration(td), "1:01:01")

    def test_format_seconds(self):
        self.assertEqual(format_duration(61), "1:01")
        self.assertEqual(format_duration(3661), "1:01:01")


class TestFormatPace(unittest.TestCase):
    def test_format_none(self):
        self.assertIsNone(format_pace(None))
        self.assertIsNone(format_pace(0))

    def test_format_valid(self):
        # 4.0 m/s = 4:10/km
        self.assertEqual(format_pace(4.0), "4:10")
        # 3.33 m/s ≈ 5:00/km
        self.assertEqual(format_pace(3.33), "5:00")


class TestPaceToSeconds(unittest.TestCase):
    def test_pace_none(self):
        self.assertIsNone(pace_to_seconds(None))
        self.assertIsNone(pace_to_seconds(0))

    def test_pace_valid(self):
        # 4.0 m/s = 250 sec/km = 4:10
        self.assertEqual(pace_to_seconds(4.0), 250)
        # 3.33 m/s ≈ 300 sec/km = 5:00
        self.assertEqual(pace_to_seconds(3.33), 300)


class TestInferSubSportType(unittest.TestCase):
    def test_treadmill_no_gps(self):
        activity = Mock()
        activity.map = None
        self.assertEqual(infer_sub_sport_type(activity), '跑步机')

        activity.map = Mock()
        activity.map.summary_polyline = None
        self.assertEqual(infer_sub_sport_type(activity), '跑步机')

    def test_treadmill_from_name(self):
        activity = Mock()
        activity.map = Mock()
        activity.map.summary_polyline = "some_polyline"
        activity.name = "Morning Treadmill Run"
        self.assertEqual(infer_sub_sport_type(activity), '跑步机')

    def test_trail_from_name(self):
        activity = Mock()
        activity.map = Mock()
        activity.map.summary_polyline = "some_polyline"
        activity.name = "Trail Running in Mountains"
        self.assertEqual(infer_sub_sport_type(activity), '越野')

    def test_road_default(self):
        activity = Mock()
        activity.map = Mock()
        activity.map.summary_polyline = "some_polyline"
        activity.name = "Morning Run"
        self.assertEqual(infer_sub_sport_type(activity), '路跑')


class TestStravaFetcher(unittest.TestCase):
    def setUp(self):
        with patch('fetcher.Client'):
            self.fetcher = StravaFetcher('client_id', 'client_secret', 'refresh_token')

    def test_init(self):
        self.assertEqual(self.fetcher.client_id, 'client_id')
        self.assertEqual(self.fetcher.client_secret, 'client_secret')
        self.assertEqual(self.fetcher.refresh_token, 'refresh_token')


if __name__ == '__main__':
    unittest.main()
