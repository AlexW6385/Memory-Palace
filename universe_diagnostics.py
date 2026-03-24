#!/usr/bin/env python3
"""
Universe Diagnostics: Automated Issue Locator & Tracker
Usage: python3 universe_diagnostics.py
"""
import asyncio
import os
import sys
import json
import urllib.request
from typing import Dict, Any

def print_header(title: str):
    print(f"\n{'='*50}")
    print(f"🔍 {title}")
    print(f"{'='*50}")

def check_http_endpoint(name: str, url: str) -> bool:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                print(f"✅ {name}: ONLINE (200 OK)")
                return True
            else:
                print(f"❌ {name}: OFFLINE (HTTP {response.status})")
                return False
    except Exception as e:
        print(f"❌ {name}: CONNECTION FAILED ({e})")
        return False

async def check_websocket(url: str):
    """
    Since we cannot guarantee `websockets` library is installed globally, 
    we will rely on HTTP checks and proxy validations for WS.
    However, if `websockets` is installed, let's try to use it.
    """
    try:
        import websockets
        async with websockets.connect(url, ping_interval=None) as websocket:
            print(f"✅ WebSocket ({url}): CONNECTION ESTABLISHED!")
            # We don't wait for a message, just connecting is enough proof Nginx -> FastAPI works
            return True
    except ImportError:
        print(f"⚠️ WebSocket check skipped. 'websockets' python library not found.")
        print("   -> Run `pip install websockets` for deep WS testing.")
        return None
    except Exception as e:
        print(f"❌ WebSocket ({url}): CONNECTION FAILED ({e})")
        return False

def check_nginx_mimetypes():
    """Verify that Nginx is actually returning application/javascript for .js files."""
    try:
        url = "http://localhost/js/app.js"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as response:
            content_type = response.headers.get('Content-Type', '')
            if 'javascript' in content_type.lower():
                print(f"✅ Nginx MIME Type Configuration: CORRECT ({content_type})")
                return True
            else:
                print(f"❌ Nginx MIME Type Configuration: INCORRECT ({content_type} instead of application/javascript)")
                return False
    except Exception as e:
        print(f"❌ Nginx MIME check failed: {str(e)}")
        return False

async def run_diagnostics():
    print_header("Knowledge Universe - Deep Diagnostics")
    
    # Check 1: Gateways & APIs
    print("\n--- Gateways & APIs ---")
    nginx_ok = check_http_endpoint("Nginx Gateway", "http://localhost/")
    univ_ok = check_http_endpoint("Universe API", "http://localhost:8000/health")
    agent_ok = check_http_endpoint("Agent API", "http://localhost:8001/health")
    
    # Check 2: Check MIME types explicitly
    print("\n--- Configuration & Headers ---")
    mime_ok = check_nginx_mimetypes()
    
    # Check 3: WebSockets
    print("\n--- Real-time Streams ---")
    ws_ok = await check_websocket("ws://localhost/ws")
    
    print_header("Diagnostic Summary")
    if all(x in (True, None) for x in [nginx_ok, univ_ok, agent_ok, mime_ok]):
        print("🌟 SYSTEM STATUS: HEALTHY")
        print("\nIf you are STILL seeing issues in the browser, DO THIS EXACTLY:")
        print("1. Your browser aggressively cached the OLD broken state.")
        print("2. You MUST perform a Hard Refresh:")
        print("   - Mac: Cmd + Shift + R")
        print("   - Windows/Linux: Ctrl + Shift + R")
        print("3. Alternatively, open a New Incognito / Private Window to http://localhost")
    else:
        print("❌ SYSTEM STATUS: UNHEALTHY")
        print("One or more required services are down. Check 'docker compose logs <service_name>'")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
