#!/usr/bin/env python3
"""
Strava activity data fetcher for pbRun.
Fetches running activities from Strava API and outputs JSON for Node.js consumption.
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from functools import wraps

import requests

try:
    from stravalib.client import Client
    import gpxpy
    import gpxpy.gpx
except ImportError:
    print("ERROR: Missing required packages. Run: pip3 install stravalib gpxpy", file=sys.stderr)
    sys.exit(1)


# Timeout and retry configuration
DEFAULT_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_DELAY = 2


def retry_with_timeout(max_retries=MAX_RETRIES, delay=RETRY_DELAY):
    """Decorator: Add retry mechanism to functions"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    error_msg = str(e).lower()

                    # Don't retry on auth errors
                    if 'unauthorized' in error_msg or 'not found' in error_msg:
                        raise

                    if attempt < max_retries - 1:
                        print(f"WARN: {func.__name__} failed (attempt {attempt + 1}/{max_retries}): {e}", file=sys.stderr)
                        print(f"      Retrying in {delay} seconds...", file=sys.stderr)
                        time.sleep(delay)
                    else:
                        print(f"ERROR: {func.__name__} failed after {max_retries} attempts: {e}", file=sys.stderr)
            raise last_exception
        return wrapper
    return decorator


def parse_quantity(value):
    """Parse pint Quantity or return float value."""
    if value is None:
        return 0.0
    if hasattr(value, 'magnitude'):
        return float(value.magnitude)
    return float(value)


def format_duration(duration):
    """Format duration to HH:MM:SS or MM:SS"""
    if not duration:
        return None

    if isinstance(duration, timedelta):
        total_seconds = int(duration.total_seconds())
    else:
        total_seconds = int(duration)

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes}:{seconds:02d}"


def format_pace(meters_per_second):
    """Format pace from m/s to min:sec/km"""
    if not meters_per_second or meters_per_second <= 0:
        return None

    seconds_per_km = 1000 / meters_per_second
    minutes = int(seconds_per_km // 60)
    seconds = int(seconds_per_km % 60)
    return f"{minutes}:{seconds:02d}"


def pace_to_seconds(meters_per_second):
    """Convert m/s to seconds per km"""
    if not meters_per_second or meters_per_second <= 0:
        return None
    return round(1000 / meters_per_second)


def infer_sub_sport_type(activity):
    """Infer sub sport type from activity data"""
    # Check for GPS data
    if not activity.map or not activity.map.summary_polyline:
        return '跑步机'

    # Check activity name
    name = activity.name.lower()
    if '跑步机' in name or 'treadmill' in name:
        return '跑步机'
    if '越野' in name or 'trail' in name:
        return '越野'
    if '田径' in name or 'track' in name:
        return '田径场'

    # Default to outdoor road running
    return '路跑'


class StravaFetcher:
    """Strava activity fetcher for pbRun"""

    def __init__(self, client_id, client_secret, refresh_token):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.client = None
        self.access_token = None

    @retry_with_timeout(max_retries=MAX_RETRIES, delay=RETRY_DELAY)
    def authenticate(self):
        """Authenticate with Strava using refresh token"""
        self.client = Client()

        try:
            refresh_response = self.client.refresh_access_token(
                client_id=self.client_id,
                client_secret=self.client_secret,
                refresh_token=self.refresh_token,
            )

            self.access_token = refresh_response['access_token']
            self.client.access_token = self.access_token
            new_refresh_token = refresh_response.get('refresh_token')

            # Return new refresh token if it changed
            if new_refresh_token and new_refresh_token != self.refresh_token:
                return new_refresh_token

            return None

        except Exception as e:
            error_msg = str(e).lower()
            if '401' in error_msg or 'unauthorized' in error_msg:
                print("ERROR: Authentication failed. Please re-authorize with: npm run auth:strava", file=sys.stderr)
            raise

    @retry_with_timeout(max_retries=MAX_RETRIES, delay=RETRY_DELAY)
    def get_latest_run(self, after=None, before=None):
        """Get the latest running activity"""
        activities = list(self.client.get_activities(limit=10, after=after, before=before))

        if not activities:
            return None

        # Filter for running activities
        running_activities = [act for act in activities if act.type == 'Run']

        if not running_activities:
            return None

        # Get the latest running activity with full details
        latest = running_activities[0]
        return self.client.get_activity(latest.id)

    @retry_with_timeout(max_retries=MAX_RETRIES, delay=RETRY_DELAY)
    def get_activity_streams(self, activity_id):
        """Get activity streams for GPS and time series data"""
        try:
            streams = self.client.get_activity_streams(
                activity_id,
                types=['time', 'latlng', 'altitude', 'heartrate', 'distance', 'cadence']
            )
            return streams
        except Exception as e:
            print(f"WARN: Failed to get activity streams: {e}", file=sys.stderr)
            return {}

    @retry_with_timeout(max_retries=MAX_RETRIES, delay=RETRY_DELAY)
    def get_activity_laps(self, activity_id):
        """Get activity laps (splits)"""
        try:
            laps = list(self.client.get_activity_laps(activity_id))
            return laps
        except Exception as e:
            print(f"WARN: Failed to get activity laps: {e}", file=sys.stderr)
            return []

    def generate_gpx(self, activity, streams, output_dir):
        """Generate GPX file from Strava streams"""
        if not streams.get('time') or not streams.get('latlng'):
            print("WARN: No GPS data available (treadmill run?), skipping GPX generation", file=sys.stderr)
            return None

        try:
            time_list = streams['time'].data
            latlng_list = streams['latlng'].data
            start_time = activity.start_date_local

            # Create GPX
            gpx = gpxpy.gpx.GPX()
            gpx_track = gpxpy.gpx.GPXTrack()
            gpx_track.name = activity.name
            gpx_track.type = "Run"
            gpx.tracks.append(gpx_track)

            gpx_segment = gpxpy.gpx.GPXTrackSegment()
            gpx_track.segments.append(gpx_segment)

            # Optional streams
            altitude_list = streams.get('altitude').data if streams.get('altitude') else None
            heartrate_list = streams.get('heartrate').data if streams.get('heartrate') else None

            # Add track points
            for i, latlng in enumerate(latlng_list):
                point_time = start_time + timedelta(seconds=time_list[i])

                point_kwargs = {
                    'latitude': latlng[0],
                    'longitude': latlng[1],
                    'time': point_time,
                }

                if altitude_list and i < len(altitude_list):
                    point_kwargs['elevation'] = altitude_list[i]

                point = gpxpy.gpx.GPXTrackPoint(**point_kwargs)

                # Add heart rate extension if available
                if heartrate_list and i < len(heartrate_list):
                    hr = heartrate_list[i]
                    from xml.etree import ElementTree
                    gpx_extension_hr = ElementTree.fromstring(
                        f'''<gpxtpx:TrackPointExtension xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
                        <gpxtpx:hr>{hr}</gpxtpx:hr>
                        </gpxtpx:TrackPointExtension>
                        '''
                    )
                    point.extensions.append(gpx_extension_hr)

                gpx_segment.points.append(point)

            # Save GPX file
            gpx_path = os.path.join(output_dir, f"{activity.id}.gpx")
            with open(gpx_path, 'w') as f:
                f.write(gpx.to_xml())

            return gpx_path

        except Exception as e:
            print(f"WARN: Failed to generate GPX: {e}", file=sys.stderr)
            return None

    def transform_activity_data(self, activity, streams, laps, gpx_path=None):
        """Transform Strava activity to pbRun SQLite schema"""

        # Basic metrics
        distance_km = parse_quantity(activity.distance) / 1000 if activity.distance else 0
        duration_sec = activity.moving_time.total_seconds() if activity.moving_time else 0
        elapsed_sec = activity.elapsed_time.total_seconds() if activity.elapsed_time else 0

        avg_speed = parse_quantity(activity.average_speed)
        avg_pace_sec = pace_to_seconds(avg_speed)

        avg_hr = getattr(activity, 'average_heartrate', None)
        max_hr = getattr(activity, 'max_heartrate', None)
        calories = getattr(activity, 'calories', None)
        elevation_gain = parse_quantity(getattr(activity, 'total_elevation_gain', None))
        avg_cadence = parse_quantity(getattr(activity, 'average_cadence', None))
        max_cadence = parse_quantity(getattr(activity, 'max_cadence', None))
        avg_power = getattr(activity, 'average_watts', None)
        max_power = getattr(activity, 'max_watts', None)

        # Date and time
        start_time = activity.start_date
        start_time_local = activity.start_date_local

        # Sub sport type inference
        sub_sport_type = infer_sub_sport_type(activity)
        sport_type = 'treadmill_running' if sub_sport_type == '跑步机' else 'running'

        # Process laps
        splits = []
        for lap in laps:
            lap_distance = parse_quantity(lap.distance)  # Keep in meters for laps
            lap_duration = lap.elapsed_time.total_seconds() if lap.elapsed_time else 0
            lap_speed = parse_quantity(lap.average_speed)
            lap_elevation = parse_quantity(lap.total_elevation_gain)

            splits.append({
                'lap_index': lap.lap_index,
                'distance': round(lap_distance, 2),
                'duration': int(lap_duration),
                'average_pace': pace_to_seconds(lap_speed),
                'average_heart_rate': int(lap.average_heartrate) if lap.average_heartrate else None,
                'max_heart_rate': int(lap.max_heartrate) if lap.max_heartrate else None,
                'total_ascent': round(lap_elevation, 1) if lap_elevation else None,
                'average_cadence': int(lap.average_cadence) if lap.average_cadence else None,
            })

        result = {
            # Activity info
            'activity_id': activity.id,
            'name': activity.name,
            'activity_type': 'running',
            'sport_type': sport_type,
            'sub_sport_type': sub_sport_type,

            # Timestamps
            'start_time': start_time.isoformat() if start_time else None,
            'start_time_local': start_time_local.isoformat() if start_time_local else None,

            # Distance and time
            'distance': round(distance_km, 2),
            'duration': int(duration_sec),
            'moving_time': int(duration_sec),
            'elapsed_time': int(elapsed_sec),

            # Pace and speed
            'average_pace': avg_pace_sec,
            'average_speed': round(avg_speed * 3.6, 2) if avg_speed else None,  # km/h
            'max_speed': round(parse_quantity(getattr(activity, 'max_speed', None)), 2) if getattr(activity, 'max_speed', None) else None,

            # Heart rate
            'average_heart_rate': round(avg_hr) if avg_hr else None,
            'max_heart_rate': int(max_hr) if max_hr else None,

            # Cadence
            'average_cadence': round(avg_cadence) if avg_cadence else None,
            'max_cadence': int(max_cadence) if max_cadence else None,

            # Elevation
            'total_ascent': round(elevation_gain, 1) if elevation_gain else None,

            # Power
            'average_power': round(parse_quantity(avg_power)) if avg_power else None,
            'max_power': round(parse_quantity(max_power)) if max_power else None,

            # Calories
            'calories': int(calories) if calories else None,

            # GPX path
            'gpx_path': gpx_path,

            # Laps
            'laps': splits,

            # Source
            'source': 'strava',
        }

        return result

    def fetch_latest(self, output_dir=None, save_gpx=True):
        """Fetch latest running activity and return transformed data"""

        # Authenticate
        new_token = self.authenticate()

        # Get latest run
        activity = self.get_latest_run()

        if not activity:
            return None, None

        # Get streams and laps
        streams = self.get_activity_streams(activity.id)
        laps = self.get_activity_laps(activity.id)

        # Generate GPX if requested
        gpx_path = None
        if save_gpx and output_dir:
            os.makedirs(output_dir, exist_ok=True)
            gpx_path = self.generate_gpx(activity, streams, output_dir)

        # Transform data
        data = self.transform_activity_data(activity, streams, laps, gpx_path)

        return data, new_token


def main():
    parser = argparse.ArgumentParser(description='Fetch latest Strava running activity')
    parser.add_argument('--client-id', help='Strava Client ID')
    parser.add_argument('--client-secret', help='Strava Client Secret')
    parser.add_argument('--refresh-token', help='Strava Refresh Token')
    parser.add_argument('--output-dir', help='Directory for GPX files')
    parser.add_argument('--no-gpx', action='store_true', help='Skip GPX generation')
    parser.add_argument('--json', action='store_true', help='Output JSON only')

    args = parser.parse_args()

    # Get credentials from environment or arguments
    client_id = args.client_id or os.environ.get('STRAVA_CLIENT_ID')
    client_secret = args.client_secret or os.environ.get('STRAVA_CLIENT_SECRET')
    refresh_token = args.refresh_token or os.environ.get('STRAVA_REFRESH_TOKEN')

    if not all([client_id, client_secret, refresh_token]):
        print("ERROR: Missing Strava credentials. Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN environment variables.", file=sys.stderr)
        sys.exit(1)

    try:
        fetcher = StravaFetcher(client_id, client_secret, refresh_token)
        data, new_token = fetcher.fetch_latest(
            output_dir=args.output_dir,
            save_gpx=not args.no_gpx
        )

        if not data:
            print(json.dumps({"error": "No running activities found"}), file=sys.stderr)
            sys.exit(1)

        # Add token refresh info if needed
        if new_token:
            data['_new_refresh_token'] = new_token

        print(json.dumps(data, indent=2, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
