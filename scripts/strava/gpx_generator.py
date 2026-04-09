#!/usr/bin/env python3
"""
GPX Generator for Strava activities.
Converts Strava streams data to GPX format.
"""

from datetime import timedelta

try:
    import gpxpy
    import gpxpy.gpx
except ImportError:
    raise ImportError("gpxpy is required. Run: pip3 install gpxpy")


def generate_gpx_from_streams(activity, streams):
    """
    Generate GPX file from Strava activity streams.

    Args:
        activity: Strava activity object
        streams: Dict containing stream data (time, latlng, altitude, heartrate)

    Returns:
        str: GPX XML string or None if no GPS data
    """
    if not streams.get('time') or not streams.get('latlng'):
        return None

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

    return gpx.to_xml()


def save_gpx(gpx_xml, output_path):
    """
    Save GPX XML to file.

    Args:
        gpx_xml: GPX XML string
        output_path: Path to save file

    Returns:
        str: Path to saved file
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(gpx_xml)
    return output_path
