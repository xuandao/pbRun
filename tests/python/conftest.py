"""
Pytest 配置和共享 fixtures
"""
import pytest
import tempfile
import os
import json


@pytest.fixture
def temp_dir():
    """提供临时目录"""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def mock_strava_activity():
    """模拟 Strava API 返回的活动数据"""
    return {
        "id": 123456789,
        "name": "Morning Run",
        "distance": 10000.0,
        "moving_time": 3600,
        "elapsed_time": 3700,
        "total_elevation_gain": 50.0,
        "type": "Run",
        "sport_type": "Run",
        "start_date": "2024-01-15T06:00:00Z",
        "start_date_local": "2024-01-15T14:00:00Z",
        "timezone": "(GMT+08:00) Asia/Shanghai",
        "average_speed": 2.778,
        "max_speed": 3.5,
        "average_heartrate": 150.0,
        "max_heartrate": 170.0,
        "average_cadence": 180.0,
        "has_heartrate": True,
    }


@pytest.fixture
def mock_strava_laps():
    """模拟 Strava API 返回的分段数据"""
    return [
        {
            "lap_index": 1,
            "split_index": 1,
            "distance": 1000.0,
            "moving_time": 360,
            "elapsed_time": 365,
            "average_speed": 2.778,
            "average_heartrate": 145.0,
            "average_cadence": 178.0,
        },
        {
            "lap_index": 2,
            "split_index": 2,
            "distance": 1000.0,
            "moving_time": 355,
            "elapsed_time": 360,
            "average_speed": 2.817,
            "average_heartrate": 152.0,
            "average_cadence": 180.0,
        },
    ]


@pytest.fixture
def mock_token_response():
    """模拟 OAuth token 响应"""
    return {
        "access_token": "mock_access_token_123",
        "refresh_token": "mock_refresh_token_456",
        "expires_at": 1705315200,
        "expires_in": 21600,
    }
