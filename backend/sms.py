"""
SMS South Africa client — sends intruder alerts via mymobileapi.com
"""

import base64
import json
import os
import re
import urllib.error
import urllib.request


BASE_URL = "https://rest.mymobileapi.com"

_CLIENT_ID     = os.environ.get("SMS_SA_CLIENT_ID", "")
_CLIENT_SECRET = os.environ.get("SMS_SA_CLIENT_SECRET", "")
_CREDENTIALS   = base64.b64encode(f"{_CLIENT_ID}:{_CLIENT_SECRET}".encode()).decode()
_CONFIGURED    = bool(_CLIENT_ID and _CLIENT_SECRET)

if _CONFIGURED:
    print("SMS client (SMS South Africa) initialised.")
else:
    print("WARNING: SMS_SA_CLIENT_ID / SMS_SA_CLIENT_SECRET not set — SMS disabled.")


def normalise_phone(phone: str) -> str:
    digits = re.sub(r"[^\d+]", "", phone)
    if digits.startswith("+27"):
        return digits
    if digits.startswith("27") and len(digits) == 11:
        return "+" + digits
    if digits.startswith("0") and len(digits) == 10:
        return "+27" + digits[1:]
    return digits


def _mask(phone: str) -> str:
    return "****" + phone[-4:] if len(phone) >= 4 else "****"


def send_sms(phone: str, message: str) -> dict:
    """Send an SMS. Returns {success: bool, error?: str}."""
    if not _CONFIGURED:
        return {"success": False, "error": "SMS not configured"}

    normalised = normalise_phone(phone)
    if not re.match(r"^\+\d{10,15}$", normalised):
        return {"success": False, "error": f"Invalid phone number: {phone}"}

    body = json.dumps({
        "messages": [{"content": message, "destination": normalised}]
    }).encode()

    req = urllib.request.Request(
        f"{BASE_URL}/bulkmessages",
        data=body,
        headers={
            "Authorization": f"Basic {_CREDENTIALS}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Content-Length": str(len(body)),
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                print(f"[SMS] Sent to {_mask(normalised)}")
                return {"success": True}
            data = resp.read().decode()
            print(f"[SMS] Failed for {_mask(normalised)} — HTTP {resp.status}: {data}")
            return {"success": False, "error": f"HTTP {resp.status}: {data}"}
    except urllib.error.HTTPError as e:
        data = e.read().decode()
        print(f"[SMS] HTTP error {e.code} for {_mask(normalised)}: {data}")
        return {"success": False, "error": f"HTTP {e.code}: {data}"}
    except TimeoutError:
        print(f"[SMS] Timeout for {_mask(normalised)}")
        return {"success": False, "error": "SMS request timed out"}
    except Exception as e:
        print(f"[SMS] Error for {_mask(normalised)}: {e}")
        return {"success": False, "error": str(e)}
