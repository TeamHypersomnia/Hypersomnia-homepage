#!/usr/bin/env python3
"""
One-time migration: writes every row of the old authorized_servers table (api_key -> server_id)
as official_servers.d/<server_id> holding the api_key, which becomes that server's official_server_secret.

Run on the server:  python3 migrate_authorized_servers.py /var/www/app/private
Existing files are never overwritten. The table itself is left untouched.
"""
import os
import sqlite3
import sys

private = sys.argv[1] if len(sys.argv) > 1 else "/var/www/app/private"
db_path = os.path.join(private, "mmr.db")
out_dir = os.path.join(private, "official_servers.d")

os.makedirs(out_dir, mode=0o700, exist_ok=True)

con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
rows = con.execute("SELECT server_id, api_key FROM authorized_servers").fetchall()

for server_id, api_key in rows:
    if not server_id or "/" in server_id or server_id.startswith("."):
        print(f"skipped invalid server id: {server_id!r}")
        continue

    path = os.path.join(out_dir, server_id)

    if os.path.exists(path):
        print(f"exists, left as is: {server_id}")
        continue

    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)

    with os.fdopen(fd, "w") as f:
        f.write(api_key + "\n")

    print(f"written: {server_id}")
