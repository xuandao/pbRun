#!/usr/bin/env python3
"""
Strava OAuth helper for pbRun.
Guides user through OAuth flow to obtain refresh_token.
"""

import json
import os
import sys
import webbrowser
import http.server
import socketserver
import urllib.parse
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: Missing required package. Run: pip3 install requests", file=sys.stderr)
    sys.exit(1)


# Configuration
PORT = 8080
REDIRECT_URI = f"http://localhost:{PORT}/callback"
SCOPES = "read_all,profile:read_all,activity:read_all"


def get_env_or_prompt(var_name, prompt_text, required=True):
    """Get value from environment or prompt user"""
    value = os.environ.get(var_name)
    if value:
        return value

    if not required:
        return None

    print(f"\n{prompt_text}")
    return input("> ").strip()


class OAuthHandler(http.server.BaseHTTPRequestHandler):
    """Handle OAuth callback"""
    code = None

    def do_GET(self):
        if "/callback" in self.path:
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)

            if 'code' in params:
                OAuthHandler.code = params['code'][0]
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b"""
                <html>
                <head><title>Strava Authorization</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #4CAF50;">Authorization Successful!</h1>
                    <p>You can close this window and return to the terminal.</p>
                </body>
                </html>
                """)
            else:
                self.send_response(400)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(b"Authorization failed. No code received.")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Silence logs


def get_authorization_code(client_id):
    """Open browser to get authorization code"""
    auth_url = (
        f"https://www.strava.com/oauth/authorize?"
        f"client_id={client_id}&"
        f"response_type=code&"
        f"redirect_uri={REDIRECT_URI}&"
        f"approval_prompt=force&"
        f"scope={SCOPES}"
    )

    print("\n" + "=" * 60)
    print("Strava OAuth Authorization")
    print("=" * 60)
    print(f"\nOpening browser for authorization...")
    print(f"If browser doesn't open, manually visit:")
    print(f"{auth_url}\n")

    # Start local server to receive callback
    with socketserver.TCPServer(("", PORT), OAuthHandler) as httpd:
        httpd.allow_reuse_address = True

        # Open browser
        webbrowser.open(auth_url)

        print("Waiting for authorization callback...")
        while OAuthHandler.code is None:
            httpd.handle_request()

    return OAuthHandler.code


def exchange_code_for_token(client_id, client_secret, code):
    """Exchange authorization code for access_token and refresh_token"""
    response = requests.post(
        "https://www.strava.com/oauth/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "grant_type": "authorization_code",
        }
    )

    if response.status_code != 200:
        print(f"ERROR: Token exchange failed: {response.text}", file=sys.stderr)
        return None

    return response.json()


def main():
    print("\n" + "=" * 60)
    print("Strava Authorization Helper for pbRun")
    print("=" * 60)

    # Get credentials
    client_id = get_env_or_prompt('STRAVA_CLIENT_ID', 'Enter your Strava Client ID:')
    client_secret = get_env_or_prompt('STRAVA_CLIENT_SECRET', 'Enter your Strava Client Secret:')

    if not client_id or not client_secret:
        print("ERROR: Client ID and Client Secret are required", file=sys.stderr)
        sys.exit(1)

    print(f"\nClient ID: {client_id}")
    print(f"Client Secret: {client_secret[:10]}...")

    # Get authorization code
    code = get_authorization_code(client_id)
    print(f"\nReceived authorization code: {code[:20]}...")

    # Exchange for tokens
    print("\nExchanging code for tokens...")
    tokens = exchange_code_for_token(client_id, client_secret, code)

    if not tokens:
        print("ERROR: Failed to obtain tokens", file=sys.stderr)
        sys.exit(1)

    refresh_token = tokens['refresh_token']

    print("\n" + "=" * 60)
    print("Authorization Successful!")
    print("=" * 60)
    print(f"\nRefresh Token: {refresh_token[:40]}...")
    print("\nAdd the following to your .env file:")
    print("-" * 60)
    print(f"STRAVA_CLIENT_ID={client_id}")
    print(f"STRAVA_CLIENT_SECRET={client_secret}")
    print(f"STRAVA_REFRESH_TOKEN={refresh_token}")
    print("-" * 60)
    print("\nYou can now run: npm run sync:strava")


if __name__ == '__main__':
    main()
