#!/usr/bin/env python3
"""
MMR test runner — posts all test fixtures to /report_match and asserts DB state.
Does NOT clean up after itself so results are visible on /matches.

Usage:
  python3 run_mmr_tests.py [port]          # local dev (default port 3000)
  python3 run_mmr_tests.py --prod          # against hypersomnia.io, uses $RANKED_API_KEY
"""

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

def player(account_id, field):
    return db_one(f"SELECT {field} FROM mmr_team WHERE account_id = '{account_id}'")

def last_match(field):
    return db_one(f"SELECT {field} FROM matches ORDER BY match_id DESC LIMIT 1")

def wipe():
    """Remove only test players/ratings. Matches are kept so they appear on /matches."""
    db_exec("DELETE FROM mmr_team WHERE account_id LIKE 'steam_%'")
    db_exec("DELETE FROM mmr_ffa  WHERE account_id LIKE 'steam_%'")

def post(filename, apikey="pl"):
    path = os.path.join(ROOT, "tests", filename)
    with open(path, "rb") as f:
        data = f.read()
    key = API_KEY if PROD_MODE else apikey
    req = urllib.request.Request(URL, data=data, headers={
        "Content-Type": "application/json",
        "apikey": key,
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

section("basic matches")

check_post("3v3_normal.json")
eq("winner  matches_won",  player("steam_3v3_normal0", "matches_won"),  1)
eq("loser   matches_lost", player("steam_3v3_normal3", "matches_lost"), 1)
gt("winner  mmr",          player("steam_3v3_normal0", "mmr"))
lt("loser   mmr",          player("steam_3v3_normal3", "mmr"))

# (players auto-isolated by unique steam IDs per test file)
check_post("1v3_normal.json")
gt("1v3 winner mmr", player("steam_1v3_normal3", "mmr"))

# (players auto-isolated by unique steam IDs per test file)
check_post("1v8_normal.json")
gt("1v8 winner mmr", player("steam_1v8_normal0", "mmr"))

# ─────────────────────────────────────────────────────────────────────────────
section("tie")

# (players auto-isolated by unique steam IDs per test file)
check_post("1v1_tie_normal.json")
gt("tie: both players gain mmr (sigma drop)",  player("steam_1v1_tie_normal0", "mmr"))
gt("tie: both players gain mmr (sigma drop)",  player("steam_1v1_tie_normal1", "mmr"))
eq("tie: both players same mmr",
   round(float(player("steam_1v1_tie_normal0", "mmr") or 0), 6),
   round(float(player("steam_1v1_tie_normal1", "mmr") or 0), 6))
eq("tie: winner  matches_won",  player("steam_1v1_tie_normal0", "matches_won"),  1)
eq("tie: winner  matches_lost", player("steam_1v1_tie_normal0", "matches_lost"), 0)

# ─────────────────────────────────────────────────────────────────────────────
section("short match  (< 5 rounds → W/L not counted)")

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_abandon_no_count_wins.json")  # 3:1 = 4 total rounds
eq("short: winner  matches_won",          player("steam_3v3_abandon_no_count_wins0", "matches_won"),  0)
eq("short: winner  matches_lost",         player("steam_3v3_abandon_no_count_wins0", "matches_lost"), 0)
eq("short: loser abandoner matches_lost", player("steam_3v3_abandon_no_count_wins3", "matches_lost"), 1)
eq("short: winner abandoner matches_lost (abandon always counts)", player("steam_3v3_abandon_no_count_wins2", "matches_lost"), 1)

# ─────────────────────────────────────────────────────────────────────────────
section("abandons")

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_abandon_but_no_teammate_contribs.json")
# winners abandoned at score 2 < threshold(13) → MMR frozen
eq("early winner abandon: mmr unchanged",     player("steam_3v3_abandon_but_no_teammate_contribs1", "mmr"),        0)
eq("early winner abandon: matches_won  = 0",  player("steam_3v3_abandon_but_no_teammate_contribs1", "matches_won"),  0)
eq("early winner abandon: matches_lost = 1",  player("steam_3v3_abandon_but_no_teammate_contribs1", "matches_lost"), 1)

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_abandon_but_one_contrib.json")
# abandoned at 13 (= threshold) → MMR changes
gt("at-threshold abandon: mmr changed",       player("steam_3v3_abandon_but_one_contrib2", "mmr"))
# abandoned at 10 < 13 → MMR frozen
eq("below-threshold abandon: mmr unchanged",  player("steam_3v3_abandon_but_one_contrib1", "mmr"), 0)

# (players auto-isolated by unique steam IDs per test file)
check_post("1v3_win_by_abandon_at_end.json")
# losers abandoned at score 15 >= threshold(4) → MMR changes
lt("late loser abandon: mmr decreases",       player("steam_1v3_win_by_abandon_at_end3", "mmr"))
eq("late loser abandon: matches_lost = 1",    player("steam_1v3_win_by_abandon_at_end3", "matches_lost"), 1)

# (players auto-isolated by unique steam IDs per test file)
check_post("1v1_win_by_abandon_at_end.json")
eq("abandon-win: winner matches_won = 1",     player("steam_1v1_win_by_abandon_at_end0", "matches_won"), 1)

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_anni_abandon_but_one_contrib.json")

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_tie_abandon_but_none_contrib.json")

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_tie_abandon_but_one_contrib.json")

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_abandon_to_steal.json")

# ─────────────────────────────────────────────────────────────────────────────
section("happy hours  (x2 multiplier)")

# (players auto-isolated by unique steam IDs per test file)
check_post("happyhours_pl_1v1_0to1_normal.json", apikey="pl")
eq("pl: event_match_multiplier = 2", last_match("event_match_multiplier"), 2)

# (players auto-isolated by unique steam IDs per test file)
check_post("happyhours_aus_1v1_0to1_normal.json", apikey="au")
eq("au: event_match_multiplier = 2", last_match("event_match_multiplier"), 2)

# (players auto-isolated by unique steam IDs per test file)
check_post("3v3_normal.json")  # regular match, no happy hours
eq("normal: event_match_multiplier = 1", last_match("event_match_multiplier"), 1)

# ─────────────────────────────────────────────────────────────────────────────
section("misc")

for f in [
    "pythagtest.json",
    "pythagcollidtest.json",
    "1v1_anni_simulated_high_stakes.json",
    "1v1_simulated_high_stakes.json",
]:
# (players auto-isolated by unique steam IDs per test file)
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
