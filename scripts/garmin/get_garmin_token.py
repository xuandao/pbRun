#!/usr/bin/env python3
"""Helper script to get Garmin authentication token."""

import os

import garth
from getpass import getpass


def _load_dotenv():
    """从项目根或 cwd 的 .env 加载环境变量，GARMIN_EMAIL/GARMIN_PASSWORD 以 .env 为准。"""
    for base in (os.getcwd(), os.path.dirname(os.path.dirname(os.path.abspath(__file__)))):
        env_path = os.path.join(base, ".env")
        if not os.path.isfile(env_path):
            continue
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip()
                    if value.startswith('"') and value.endswith('"') and len(value) >= 2:
                        value = value[1:-1].replace('\\"', '"')
                    elif value.startswith("'") and value.endswith("'") and len(value) >= 2:
                        value = value[1:-1].replace("\\'", "'")
                    if key:
                        if key in ("GARMIN_EMAIL", "GARMIN_PASSWORD") or key not in os.environ:
                            os.environ[key] = value
        break


def main():
    """Get Garmin authentication token."""
    _load_dotenv()

    print("=" * 60)
    print("Garmin Authentication Token Generator")
    print("=" * 60)
    print()

    email = os.environ.get("GARMIN_EMAIL", "").strip()
    password = os.environ.get("GARMIN_PASSWORD", "").strip()

    if not email:
        email = input("Enter your Garmin email address: ")
    if not password:
        password = getpass("Enter your Garmin password: ")

    if not email or not password:
        print("Error: email and password are required.")
        return 1

    print("\nAuthenticating with Garmin...")

    try:
        # Try to login
        garth.login(email, password)
        print("✓ Successfully authenticated with Garmin")

        # Get token
        token = garth.client.dumps()

        print("\n" + "=" * 60)
        print("Your Garmin Secret String:")
        print("=" * 60)
        print(token)
        print("=" * 60)
        print()
        print("Add this to your GitHub Secrets as GARMIN_SECRET_STRING")
        print()

    except Exception as e:
        print(f"\n✗ Authentication failed: {e}")
        print()
        print("Possible reasons:")
        print("1. Incorrect email or password")
        print("2. Two-factor authentication enabled (not supported yet)")
        print("3. Network connection issues")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
