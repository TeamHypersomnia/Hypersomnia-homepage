#!/usr/bin/env python3
"""
MMR test runner — posts all test fixtures to /report_match and asserts DB state.
Does NOT clean up after itself so results are visible on /matches.

Usage:
  python3 run_mmr_tests.py [port]          # local dev (default port 3000)
  python3 run_mmr_tests.py --prod          # against hypersomnia.io, uses $RANKED_API_KEY
"""

import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ── config ────────────────────────────────────────────────────────────────────

PROD_MODE = "--prod" in sys.argv
args      = [a for a in sys.argv[1:] if a != "--prod"]

if PROD_MODE:
    API_KEY = os.environ.get("RANKED_API_KEY")
    if not API_KEY:
        print("Error: $RANKED_API_KEY is not set")
        sys.exit(1)
    URL = "https://hypersomnia.io/report_match"
else:
    PORT = int(args[0]) if args else 3000
    URL  = f"http://localhost:{PORT}/report_match"
    API_KEY = None  # per-test keys used (pl / au)

ROOT    = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "private", "mmr.db")

GREEN  = "\033[32m"
RED    = "\033[31m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

passed = 0
failed = 0
server_pid = None

# ── helpers ───────────────────────────────────────────────────────────────────

def section(title):
    print(f"\n{BOLD}── {title} ──{RESET}")

def db_one(sql):
    if PROD_MODE:
        return None
    con = sqlite3.connect(DB_PATH)
    try:
        row = con.execute(sql).fetchone()
        return row[0] if row else None
    finally:
        con.close()

def db_exec(sql):
    if PROD_MODE:
        return
    con = sqlite3.connect(DB_PATH)
    try:
        con.execute(sql)
        con.commit()
    finally:
        con.close()

def numeric_id(account_id):
    """The site takes steam_ ids of digits only: a fixture's readable id (steam_3v3_normal0) stands for a stable number."""
    if account_id.startswith("steam_") and not account_id[6:].isdigit():
        return "steam_" + str(int(hashlib.sha256(account_id.encode()).hexdigest()[:15], 16))
    return account_id

def player(account_id, field):
    return db_one(f"SELECT {field} FROM mmr_team WHERE account_id = '{numeric_id(account_id)}'")

def last_match(field):
    return db_one(f"SELECT {field} FROM matches ORDER BY match_id DESC LIMIT 1")

def wipe():
    """Remove only test players/ratings. Matches are kept so they appear on /matches."""
    db_exec("DELETE FROM mmr_team WHERE account_id LIKE 'steam_%'")
    db_exec("DELETE FROM mmr_ffa  WHERE account_id LIKE 'steam_%'")

def post(filename, apikey="pl"):
    path = os.path.join(ROOT, "tests", filename)
    with open(path, "rb") as f:
        body = json.loads(f.read())
    body["win_players"] = [numeric_id(i) for i in body["win_players"]]
    body["lose_players"] = [numeric_id(i) for i in body["lose_players"]]
    body["player_infos"] = {numeric_id(i): info for i, info in body["player_infos"].items()}
    # Like a game server: every report has its own id and the time it was made
    body.setdefault("match_id", os.urandom(8).hex())
    body.setdefault("reported_at", int(time.time()))
    data = json.dumps(body).encode()
    # Servers sign their reports with their key - see src/official_servers.js.
    # The test servers' keys come from public seeds (--test seeds them); --prod takes a seed in hex from $RANKED_API_KEY.
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    seed = bytes.fromhex(API_KEY) if PROD_MODE else hashlib.sha256(f"hypersomnia-test-server-{apikey}".encode()).digest()
    key = Ed25519PrivateKey.from_private_bytes(seed)
    public = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()
    signature = key.sign(b"hs-report-v1" + data).hex()
    req = urllib.request.Request(URL, data=data, headers={
        "Content-Type": "application/json",
        "X-Server-Key": public,
        "X-Signature": signature,
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def check_post(filename, apikey="pl"):
    global passed, failed
    label = filename.replace(".json", "")
    result = post(filename, apikey)
    ok = "message" in result and "reported" in result["message"].lower()
    if ok:
        print(f"  {GREEN}✓{RESET} {label}  →  {result['message']}")
        passed += 1
    else:
        print(f"  {RED}✗{RESET} {label}  →  {result}")
        failed += 1
    return ok

def eq(label, got, want):
    global passed, failed
    if PROD_MODE:
        return  # no DB access in prod mode
    # normalize: compare as strings, but treat 0 == 0.0
    def norm(v):
        try:
            f = float(v)
            return int(f) if f == int(f) else f
        except (TypeError, ValueError):
            return v
    if norm(got) == norm(want):
        print(f"    {GREEN}✓{RESET} {label} = {got}")
        passed += 1
    else:
        print(f"    {RED}✗{RESET} {label}: got={got!r}  want={want!r}")
        failed += 1

def gt(label, got, threshold=0):
    global passed, failed
    if PROD_MODE:
        return
    try:
        val = float(got)
        if val > threshold:
            print(f"    {GREEN}✓{RESET} {label} = {got} (> {threshold})")
            passed += 1
            return
    except (TypeError, ValueError):
        pass
    print(f"    {RED}✗{RESET} {label}: got={got!r}  want > {threshold}")
    failed += 1

def lt(label, got, threshold=0):
    global passed, failed
    if PROD_MODE:
        return
    try:
        val = float(got)
        if val < threshold:
            print(f"    {GREEN}✓{RESET} {label} = {got} (< {threshold})")
            passed += 1
            return
    except (TypeError, ValueError):
        pass
    print(f"    {RED}✗{RESET} {label}: got={got!r}  want < {threshold}")
    failed += 1

# ── server startup ────────────────────────────────────────────────────────────

def server_up():
    try:
        urllib.request.urlopen(URL, timeout=1)
    except urllib.error.HTTPError:
        return True  # got a real HTTP response
    except Exception:
        return False
    return True

if PROD_MODE:
    print(f"{BOLD}Running against {URL}{RESET}")
else:
    if not server_up():
        print(f"No server on port {PORT} — starting one...")
        log = open("/tmp/mmr_test_server.log", "w")
        proc = subprocess.Popen(
            ["node", "app.js", str(PORT), "--test"],
            cwd=ROOT, stdout=log, stderr=log
        )
        server_pid = proc.pid
        for _ in range(20):
            time.sleep(0.5)
            if server_up():
                break
        if not server_up():
            print(f"{RED}Server failed to start. Log:{RESET}")
            log.close()
            print(open("/tmp/mmr_test_server.log").read())
            sys.exit(1)
        print(f"{GREEN}Server started (PID {server_pid}){RESET}")
    wipe()

# ── tests ─────────────────────────────────────────────────────────────────────

def post_body(body, apikey="pl", path="/report_match", tag=b"hs-report-v1"):
    """A report built here - like a game server's: its own id and the time it was made, signed with the test key."""
    body = dict(body)
    body.setdefault("match_id", os.urandom(8).hex())
    body.setdefault("reported_at", int(time.time()))
    data = json.dumps(body).encode()
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    seed = hashlib.sha256(f"hypersomnia-test-server-{apikey}".encode()).digest()
    key = Ed25519PrivateKey.from_private_bytes(seed)
    public = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw).hex()
    req = urllib.request.Request(URL.replace("/report_match", path), data=data, headers={
        "Content-Type": "application/json", "X-Server-Key": public, "X-Signature": key.sign(tag + data).hex(),
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def match(win, lose, win_score, lose_score, abandoned=None, game_mode="Bomb Defusal", **extra):
    """Fresh players named by `win`/`lose` (each test its own), abandoned = {id: abandoned_at_score}."""
    abandoned = abandoned or {}
    infos = {}
    for i in win + lose:
        infos[i] = {"nickname": i[-20:]}
        if i in abandoned:
            infos[i]["abandoned_at_score"] = abandoned[i]
    body = {"match_start_date": "2026-10-18T12:00:00Z", "server_name": "mmr test", "arena": "de_cyberaqua",
            "game_mode": game_mode, "win_score": win_score, "lose_score": lose_score,
            "win_players": win, "lose_players": lose, "player_infos": infos, **extra}
    result = post_body(body)
    if "reported" not in str(result.get("message", "")).lower():
        global failed
        print(f"    {RED}✗{RESET} report refused: {result}")
        failed += 1
    return body

RUN = os.urandom(3).hex()
def ids(name, n):
    return [numeric_id(f"steam_{RUN}_{name}{i}") for i in range(n)]

def table(account_id, field, table_name="mmr_team"):
    return db_one(f"SELECT {field} FROM {table_name} WHERE account_id = '{account_id}'")

def mmr(account_id, table_name="mmr_team"):
    return float(table(account_id, "mmr", table_name) or 0)

def close(a, b):
    return abs(a - b) < 1e-9

def check(label, ok, detail=""):
    global passed, failed
    if PROD_MODE:
        return
    if ok:
        print(f"    {GREEN}✓{RESET} {label} {detail}")
        passed += 1
    else:
        print(f"    {RED}✗{RESET} {label} {detail}")
        failed += 1

section("basic matches (fixtures)")

check_post("3v3_normal.json")
eq("winner  matches_won",  player("steam_3v3_normal0", "matches_won"),  1)
eq("loser   matches_lost", player("steam_3v3_normal3", "matches_lost"), 1)
gt("winner  mmr",          player("steam_3v3_normal0", "mmr"))
lt("loser   mmr",          player("steam_3v3_normal3", "mmr"))
check_post("1v3_normal.json")
gt("1v3 winner mmr", player("steam_1v3_normal3", "mmr"))
check_post("1v8_normal.json")
gt("1v8 winner mmr", player("steam_1v8_normal0", "mmr"))

section("score difference (lose_severity: 1x under 8, 2x from 8, 3x from 13)")

w1, l1 = ids("sev_close_w", 1), ids("sev_close_l", 1)
w2, l2 = ids("sev_mid_w", 1), ids("sev_mid_l", 1)
w3, l3 = ids("sev_crush_w", 1), ids("sev_crush_l", 1)
match(w1, l1, 16, 14)
match(w2, l2, 16, 8)
match(w3, l3, 16, 2)
check("16:8 moves more than 16:14", mmr(w2[0]) > mmr(w1[0]), f"{mmr(w2[0]):.3f} > {mmr(w1[0]):.3f}")
check("16:2 moves more than 16:8", mmr(w3[0]) > mmr(w2[0]), f"{mmr(w3[0]):.3f} > {mmr(w2[0]):.3f}")
check("16:2 losers lose more than 16:14", mmr(l3[0]) < mmr(l1[0]), f"{mmr(l3[0]):.3f} < {mmr(l1[0]):.3f}")

section("happy hours (event_match_multiplier 2 = rated twice as many times)")

wh, lh = ids("hh_w", 1), ids("hh_l", 1)
wd, ld = ids("hh_double_w", 1), ids("hh_double_l", 1)
match(wh, lh, 16, 14, event_match_multiplier=2)
match(wd, ld, 16, 8)
check("16:14 in happy hours = 16:8 (2 rounds of rating)", close(mmr(wh[0]), mmr(wd[0])), f"{mmr(wh[0]):.6f} vs {mmr(wd[0]):.6f}")
check("happy hours move more than without", mmr(wh[0]) > mmr(w1[0]), f"{mmr(wh[0]):.3f} > {mmr(w1[0]):.3f}")
eq("multiplier stored", last_match("event_match_multiplier"), 1)
match(ids("hh_any_w", 1), ids("hh_any_l", 1), 16, 14, event_match_multiplier=7)
eq("only 1 or 2 taken (7 -> 1)", last_match("event_match_multiplier"), 1)
check_post("happyhours_pl_1v1_0to1_normal.json", apikey="pl")
eq("pl: event_match_multiplier = 2", last_match("event_match_multiplier"), 2)
check_post("happyhours_aus_1v1_0to1_normal.json", apikey="au")
eq("au: event_match_multiplier = 2", last_match("event_match_multiplier"), 2)

section("tie (15:15 - neither a win nor a loss)")

wt, lt_ = ids("tie_w", 1), ids("tie_l", 1)
match(wt, lt_, 15, 15)
check("both the same mmr", close(mmr(wt[0]), mmr(lt_[0])), f"{mmr(wt[0]):.6f} = {mmr(lt_[0]):.6f}")
eq("no win counted",  table(wt[0], "matches_won"), 0)
eq("no loss counted", table(lt_[0], "matches_lost"), 0)

section("short match (< 5 rounds - winners keep their ratings, nothing counted)")

ws, ls = ids("short_w", 1), ids("short_l", 1)
match(ws, ls, 3, 1)
eq("winner mmr unchanged", mmr(ws[0]), 0)
check("loser rated", mmr(ls[0]) < 0, f"{mmr(ls[0]):.3f}")
eq("winner matches_won", table(ws[0], "matches_won"), 0)
eq("loser matches_lost", table(ls[0], "matches_lost"), 0)

section("abandons")

# A winner-side abandoner is rated as a sure loss of their team and always gets a loss
wa, la = ids("ab_w", 2), ids("ab_l", 2)
match(wa, la, 16, 10, abandoned={wa[1]: 2})
check("winner-side abandoner loses mmr", mmr(wa[1]) < 0, f"{mmr(wa[1]):.3f}")
eq("winner-side abandoner matches_lost", table(wa[1], "matches_lost"), 1)
eq("winner-side abandoner matches_won", table(wa[1], "matches_won"), 0)

# Who stayed is rated without a non-contributing abandoner (left at 2 < 13): the same as a 1v2
w_purged, l_purged = ids("purge_w", 2), ids("purge_l", 2)
w_alone, l_alone = ids("alone_w", 1), ids("alone_l", 2)
match(w_purged, l_purged, 16, 10, abandoned={w_purged[1]: 2})
match(w_alone, l_alone, 16, 10)
check("non-contributing abandoner left out of the stayers' rating", close(mmr(w_purged[0]), mmr(w_alone[0])), f"{mmr(w_purged[0]):.6f} = {mmr(w_alone[0]):.6f}")

# A contributing one (left at 13) counts for the stayers - not the same as playing alone
w_contrib, l_contrib = ids("contrib_w", 2), ids("contrib_l", 2)
match(w_contrib, l_contrib, 16, 10, abandoned={w_contrib[1]: 13})
check("contributing abandoner counted in the stayers' rating", not close(mmr(w_contrib[0]), mmr(w_alone[0])), f"{mmr(w_contrib[0]):.6f} != {mmr(w_alone[0]):.6f}")

# Losers who abandoned: the team that stayed wins whatever the score (1:15 here)
wl, ll = ids("ab_lose_w", 1), ids("ab_lose_l", 1)
match(wl, ll, 1, 15, abandoned={ll[0]: 15}, losers_abandoned=True)
check("stayers win though behind on score", mmr(wl[0]) > 0, f"{mmr(wl[0]):.3f}")
check("loser-side abandoner loses mmr", mmr(ll[0]) < 0, f"{mmr(ll[0]):.3f}")
eq("abandon-win: winner matches_won", table(wl[0], "matches_won"), 1)
eq("loser-side abandoner matches_lost", table(ll[0], "matches_lost"), 1)

for f in ["3v3_abandon_but_no_teammate_contribs.json", "3v3_abandon_but_one_contrib.json", "1v3_win_by_abandon_at_end.json",
          "1v1_win_by_abandon_at_end.json", "3v3_anni_abandon_but_one_contrib.json", "3v3_tie_abandon_but_none_contrib.json",
          "3v3_tie_abandon_but_one_contrib.json", "3v3_abandon_to_steal.json", "3v3_abandon_no_count_wins.json"]:
    check_post(f)

section("FFA Gun Game (every player ranked by place)")

ffa = ids("ffa", 4)
match(ffa[:1], ffa[1:], 1, 0, game_mode="FFA Gun Game")
places = [mmr(i, "mmr_ffa") for i in ffa]
check("1st > 2nd > 3rd > 4th", places[0] > places[1] > places[2] > places[3], " > ".join(f"{p:.3f}" for p in places))
check("nothing in mmr_team", table(ffa[0], "mmr") is None)

section("revert (exactly what the match changed)")

wr, lr = ids("rev_w", 1), ids("rev_l", 1)
match(wr, lr, 16, 2, event_match_multiplier=2)
match_id = db_one("SELECT match_id FROM matches ORDER BY match_id DESC LIMIT 1")
result = post_body({"match_id": match_id}, path="/revert_match", tag=b"hs-revert-v1")
check("revert accepted", "reverted" in str(result.get("message", "")).lower(), str(result))
check("winner back to 0", abs(mmr(wr[0])) < 1e-6, f"{mmr(wr[0])}")
check("loser back to 0", abs(mmr(lr[0])) < 1e-6, f"{mmr(lr[0])}")
eq("winner matches_won back", table(wr[0], "matches_won"), 0)

section("misc fixtures")

for f in ["pythagtest.json", "1v1_anni_simulated_high_stakes.json", "1v1_simulated_high_stakes.json", "1v1_tie_normal.json"]:
    check_post(f)

# ── results ───────────────────────────────────────────────────────────────────

total = passed + failed
print(f"\n{BOLD}{'─' * 40}{RESET}")
if failed == 0:
    print(f"{GREEN}All {total} assertions passed ✓{RESET}")
else:
    print(f"{RED}{failed}/{total} assertions FAILED{RESET}")
if not PROD_MODE:
    print(f"\nResults visible at: http://localhost:{PORT}/matches")

sys.exit(0 if failed == 0 else 1)
