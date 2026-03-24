import sys
import urllib.request
import urllib.error
import time

TARGETS = {
    "Universe API (Backend A)": "http://localhost:8000/health",
    "Agent API (Backend B)": "http://localhost:8001/health",
    "Frontend Gateway (Nginx)": "http://localhost",
}

def check_service(name, url):
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=3) as response:
            status = response.getcode()
            if status in (200, 404):
                return f"✅ {name} is ONLINE (HTTP {status})"
            else:
                return f"⚠️ {name} is reachable but returned HTTP {status}"
    except urllib.error.HTTPError as e:
        status = e.code
        if status in (200, 404):
            return f"✅ {name} is ONLINE (HTTP {status})"
        return f"⚠️ {name} is reachable but returned HTTP {status}"
    except urllib.error.URLError as e:
        return f"❌ {name} is OFFLINE or unreachable ({e.reason})"
    except Exception as e:
        return f"❌ {name} is OFFLINE or unreachable ({type(e).__name__})"

def run_diagnostics():
    print("=========================================")
    print("🚀 Knowledge Universe Self-Check System 🚀")
    print("=========================================\n")
    print("Checking core modules...")
    
    for name, url in TARGETS.items():
        result = check_service(name, url)
        print(result)
        time.sleep(0.1)

    print("\nIf any service is ❌ OFFLINE, verify that 'docker compose up' is running without errors.")
    print("=========================================")

if __name__ == "__main__":
    run_diagnostics()
