#!/usr/bin/env python3
"""
Identity and avatar tests: /cert's JSON (cert, name, avatar), avatars in match reports, /avatar/<id>.png,
profile pages, the admin's avatar deletion and linked keys hidden from the leaderboards.
Run in a scratch copy of the site started with --test (e.g. by broker.sh), never against port 3000:

  SESSION_SECRET=<the site's> ADMIN_ID=<a Steam id64 in its ADMINS> python3 run_identity_tests.py <port>

Without SESSION_SECRET and ADMIN_ID the admin tests are skipped. Reads and writes private/mmr.db next to this file.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 13500

if PORT == 3000:
    print("Not on port 3000 - that is the live development site.")
    sys.exit(1)

URL = f"http://127.0.0.1:{PORT}"
ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "private", "mmr.db")

passed = 0
failed = 0


def check(label, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
        print(f"  \033[32m✓\033[0m {label}")
    else:
        failed += 1
        print(f"  \033[31m✗\033[0m {label}" + (f": {detail}" if detail else ""))


def section(title):
    print(f"\n\033[1m── {title} ──\033[0m")


def db(sql, params=()):
    con = sqlite3.connect(DB_PATH)
    try:
        cur = con.execute(sql, params)
        rows = cur.fetchall()
        con.commit()
        return rows
    finally:
        con.close()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a):
        return None


opener = urllib.request.build_opener(NoRedirect)


def request(path, data=None, headers=None, cookie=None):
    req = urllib.request.Request(URL + path, data=data, headers=headers or {})
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        r = opener.open(req, timeout=15)
        return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def png(width, height, padding=0):
    """A real PNG of a solid colour, padded with a tEXt chunk to make it bigger."""
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))
    raw = b"".join(b"\x00" + bytes([200, 30, 30]) * width for _ in range(height))
    text = chunk(b"tEXt", b"pad\x00" + os.urandom(padding // 2).hex().encode()[:padding]) if padding else b""
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + text + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def new_key():
    key = Ed25519PrivateKey.generate()
    return key, key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()


def cert(key, pub):
    """/cert for an account key, with the key's own public key as the session - as the game does."""
    session = bytes.fromhex(pub)
    sig = key.sign(b"hs-cert-req-v1" + session).hex()
    return request(f"/cert?session={pub}&key={pub}&sig={sig}")


def cert_account(cert_hex):
    raw = bytes.fromhex(cert_hex)
    return raw[2:2 + raw[1]].decode()


def report(winners, losers, infos, server="pl"):
    body = {
        "match_start_date": datetime.now(timezone.utc).isoformat(),
        "server_name": "identity test", "arena": "de_cyberaqua", "game_mode": "Bomb Defusal",
        "win_score": 16, "lose_score": 4,
        "win_players": winners, "lose_players": losers, "player_infos": infos,
        "match_id": os.urandom(8).hex(), "reported_at": int(time.time())
    }
    data = json.dumps(body).encode()
    seed = hashlib.sha256(f"hypersomnia-test-server-{server}".encode()).digest()
    key = Ed25519PrivateKey.from_private_bytes(seed)
    public = key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw).hex()
    return request("/report_match", data=data, headers={
        "Content-Type": "application/json",
        "X-Server-Key": public,
        "X-Signature": key.sign(b"hs-report-v1" + data).hex()
    })


def session_cookie(steam_id):
    secret = os.environ["SESSION_SECRET"].encode()
    sid = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(days=1)
    sess = {"cookie": {"originalMaxAge": 604800000, "expires": expires.isoformat(), "httpOnly": True, "path": "/"},
            "passport": {"user": {"id": steam_id, "displayName": "Identity Test", "provider": "steam"}}}
    db("INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)", (sid, json.dumps(sess), expires.isoformat()))
    sig = base64.b64encode(hmac.new(secret, sid.encode(), hashlib.sha256).digest()).decode().rstrip("=")
    return "connect.sid=" + urllib.parse.quote("s:" + sid + "." + sig, safe="")


def b64(data):
    return base64.b64encode(data).decode()


# ── /cert for a fresh key ─────────────────────────────────────────────────────

section("/cert answers JSON")

key_a, pub_a = new_key()
key_b, pub_b = new_key()
key_c, pub_c = new_key()
key_d, pub_d = new_key()
acc_a, acc_b, acc_c, acc_d = (f"key_{p}" for p in (pub_a, pub_b, pub_c, pub_d))

status, body, headers = cert(key_a, pub_a)
check("200 application/json", status == 200 and headers.get("Content-Type", "").startswith("application/json"), f"{status} {headers.get('Content-Type')} {body[:100]}")
answer = json.loads(body) if status == 200 else {}
check("keys are exactly cert, name, avatar", sorted(answer.keys()) == ["avatar", "cert", "name"], str(answer.keys()))
check("the cert names the key", cert_account(answer.get("cert", "00")) == acc_a)
check("a key that never played: empty name and avatar", answer.get("name") == "" and answer.get("avatar") == "", str(answer)[:200])

raw = bytes.fromhex(answer["cert"])
not_before, not_after = struct.unpack("<QQ", raw[2 + raw[1] + 32:2 + raw[1] + 32 + 16]) if len(raw) > 2 + raw[1] + 48 else (0, 0)
check("the cert lives 4 hours", not_after - not_before == 4 * 60 * 60, f"{not_before} {not_after}")

status, body, _ = request(f"/cert?session={pub_a}&key={pub_a}&sig={'00' * 64}")
check("a bad signature: 401 with a plain-text reason", status == 401 and body == b"Invalid signature.", f"{status} {body}")

# ── avatars in match reports ──────────────────────────────────────────────────

section("report_match with avatars")

avatar_a = png(64, 64)
status, body, _ = report([acc_a, acc_b], [acc_c, acc_d], {
    acc_a: {"nickname": "Alice", "avatar": b64(avatar_a)},
    acc_b: {"nickname": "Bob", "avatar": b64(png(100, 100))},
    acc_c: {"nickname": "Carol", "avatar": b64(b"GIF89a this is not a png at all, really not")},
    acc_d: {"nickname": "Dave", "avatar": b64(png(64, 64, padding=70 * 1024))},
})
check("the report is accepted despite bad avatars", status == 200, f"{status} {body}")
check("a 64x64 PNG is stored", db("SELECT png FROM avatars WHERE account_id = ?", (acc_a,)) == [(avatar_a,)])
check("a 100x100 PNG is ignored", db("SELECT 1 FROM avatars WHERE account_id = ?", (acc_b,)) == [])
check("not a PNG is ignored", db("SELECT 1 FROM avatars WHERE account_id = ?", (acc_c,)) == [])
check("over 64 KB is ignored", db("SELECT 1 FROM avatars WHERE account_id = ?", (acc_d,)) == [])
check("the last nickname is kept", db("SELECT nickname FROM last_nicknames WHERE account_id = ?", (acc_c,)) == [("Carol",)])

# ── /avatar ───────────────────────────────────────────────────────────────────

section("/avatar/<account_id>.png")

status, body, headers = request(f"/avatar/{acc_a}.png")
check("200 with the stored bytes", status == 200 and body == avatar_a, f"{status}")
check("image/png, nosniff, cached", headers.get("Content-Type") == "image/png" and headers.get("X-Content-Type-Options") == "nosniff"
      and "max-age" in headers.get("Cache-Control", ""), str(headers))
check("404 without an avatar", request(f"/avatar/{acc_b}.png")[0] == 404)
check("404 for an invalid id", request("/avatar/key_..%2Fmmr.png")[0] == 404 and request("/avatar/nobody.png")[0] == 404)

# ── /cert of a key that played ────────────────────────────────────────────────

section("/cert of a key that played")

answer = json.loads(cert(key_a, pub_a)[1])
check("the last nickname", answer["name"] == "Alice", answer["name"])
check("the catalog avatar", base64.b64decode(answer["avatar"]) == avatar_a)

avatar_a2 = png(80, 80)
report([acc_a, acc_c], [acc_b, acc_d], {
    acc_a: {"nickname": "Alice2", "avatar": b64(avatar_a2)},
    acc_b: {"nickname": "Bob"}, acc_c: {"nickname": "Carol"}, acc_d: {"nickname": "Dave"},
})
answer = json.loads(cert(key_a, pub_a)[1])
check("the latest report wins (nickname and avatar)", answer["name"] == "Alice2" and base64.b64decode(answer["avatar"]) == avatar_a2)

# ── a big report: 32 players with 64 KB avatars ───────────────────────────────

section("32 players with big avatars")

big_players = [f"key_{new_key()[1]}" for _ in range(32)]
big_avatar = png(80, 80, padding=63 * 1024)
check("the test avatar is just under 64 KB", 60 * 1024 < len(big_avatar) <= 64 * 1024, str(len(big_avatar)))
status, body, _ = report(big_players[:16], big_players[16:], {p: {"nickname": f"p{i}", "avatar": b64(big_avatar)} for i, p in enumerate(big_players)})
check("accepted", status == 200, f"{status} {body[:200]}")
check("all 32 avatars stored", db(f"SELECT COUNT(*) FROM avatars WHERE account_id IN ({','.join('?' * 32)})", big_players) == [(32,)])

# ── profile pages ─────────────────────────────────────────────────────────────

section("profile pages")

status, body, _ = request(f"/user/{acc_a}")
check("shows the avatar", status == 200 and f'/avatar/{acc_a}.png'.encode() in body and b"Alice2" in body, str(status))

_, pub_never = new_key()
status, body, _ = request(f"/user/key_{pub_never}")
check("a key that never played: 'This user has not played any match yet.'", status == 200 and b"This user has not played any match yet." in body, f"{status} {body[:300]}")

# ── linked keys and the leaderboards ──────────────────────────────────────────

section("linked keys")

steam_parent = "steam_7656119" + str(secrets.randbelow(10 ** 10)).zfill(10)
db("INSERT INTO associations (child_id, parent_id) VALUES (?, ?)", (acc_c, steam_parent))

def on_leaderboards(account):
    lb = json.loads(request("/leaderboards?format=json")[1])
    page = request("/leaderboards/bomb-defusal")[1]
    team_json = json.loads(request("/leaderboards/bomb-defusal?format=json")[1])
    return (any(r["account_id"] == account for r in lb["leaderboards_team"]),
            account.encode() in page,
            any(r["account_id"] == account for r in team_json))

check("an unlinked key is on the leaderboards", on_leaderboards(acc_a) == (True, True, True))
check("a linked key is on none of them", on_leaderboards(acc_c) == (False, False, False), str(on_leaderboards(acc_c)))
check("its MMR row stays", db("SELECT COUNT(*) FROM mmr_team WHERE account_id = ?", (acc_c,)) == [(1,)])

before = db("SELECT matches_won + matches_lost FROM mmr_team WHERE account_id = ?", (acc_c,))[0][0]
report([acc_c, acc_a], [acc_b, acc_d], {acc_a: {"nickname": "Alice2"}, acc_b: {"nickname": "Bob"}, acc_c: {"nickname": "Carol"}, acc_d: {"nickname": "Dave"}})
after = db("SELECT matches_won + matches_lost FROM mmr_team WHERE account_id = ?", (acc_c,))[0][0]
check("a report with the linked key counts for the key itself", after == before + 1 and db("SELECT 1 FROM mmr_team WHERE account_id = ?", (steam_parent,)) == [], f"{before} -> {after}")

db("INSERT OR REPLACE INTO steam_profiles (account_id, name, avatar, fetched_at) VALUES (?, 'Cached Steam', ?, ?)", (steam_parent, b"\xff\xd8jpeg", int(time.time())))
status, body, _ = cert(key_c, pub_c)
answer = json.loads(body) if status == 200 else {}
check("/cert of a linked key: the Steam account, its cached profile",
      cert_account(answer.get("cert", "00")) == steam_parent and answer.get("name") == "Cached Steam" and base64.b64decode(answer.get("avatar", "")) == b"\xff\xd8jpeg", str(answer)[:200])

# ── admin ─────────────────────────────────────────────────────────────────────

section("admin: avatars")

if os.environ.get("SESSION_SECRET") and os.environ.get("ADMIN_ID"):
    admin = session_cookie(os.environ["ADMIN_ID"])
    other = session_cookie("76561198000000999")

    status, body, _ = request("/admin/avatars", cookie=admin)
    check("lists recent avatars", status == 200 and acc_a.encode() in body, str(status))

    status, _, headers = request("/admin/avatars", cookie=other)
    check("a non-admin is sent away", status == 302 and headers.get("Location") == "/", str(status))

    form = urllib.parse.urlencode({"account_id": acc_a}).encode()
    status, _, _ = request("/admin/avatars/delete", data=form, headers={"Content-Type": "application/x-www-form-urlencoded"}, cookie=other)
    check("a non-admin can not delete", db("SELECT 1 FROM avatars WHERE account_id = ?", (acc_a,)) == [(1,)])

    status, _, headers = request("/admin/avatars/delete", data=form, headers={"Content-Type": "application/x-www-form-urlencoded"}, cookie=admin)
    check("an admin deletes", status == 302 and db("SELECT 1 FROM avatars WHERE account_id = ?", (acc_a,)) == [], str(status))
    check("gone from /avatar and /cert", request(f"/avatar/{acc_a}.png")[0] == 404 and json.loads(cert(key_a, pub_a)[1])["avatar"] == "")
else:
    print("  (skipped: no SESSION_SECRET and ADMIN_ID)")

# ── results ───────────────────────────────────────────────────────────────────

total = passed + failed
print()
if failed == 0:
    print(f"\033[32mAll {total} assertions passed ✓\033[0m")
else:
    print(f"\033[31m{failed}/{total} assertions FAILED\033[0m")

sys.exit(0 if failed == 0 else 1)
