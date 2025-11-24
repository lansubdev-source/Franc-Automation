import os
import sys
import sqlite3
from datetime import datetime
import re

# -------------------------------
# Paths
# -------------------------------
BASE_DIR = os.path.dirname(__file__)
MIGRATIONS_DIR = os.path.join(BASE_DIR, "migrations")
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")

# ✔ Use the correct DB used by the backend
DB_PATH = os.path.join(INSTANCE_DIR, "app.db")

# -------------------------------
# Helpers
# -------------------------------

def ensure_db_exists():
    """Ensure instance folder and database file exist."""
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    if not os.path.exists(DB_PATH):
        open(DB_PATH, "a").close()

def get_applied_migrations(conn):
    """Read already applied migrations."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)
    rows = conn.execute("SELECT filename FROM _migrations").fetchall()
    return {r[0] for r in rows}

def migration_sort_key(filename: str):
    """Extract numeric prefix 001, 002, 010 etc."""
    match = re.match(r"^(\d+)_", filename)
    if match:
        return int(match.group(1))
    return 999999

def apply_migration(conn, filename):
    """Run one SQL migration file."""
    path = os.path.join(MIGRATIONS_DIR, filename)
    with open(path, "r") as f:
        sql = f.read()

    print(f"🟢 Applying migration: {filename}")
    conn.executescript(sql)
    conn.execute(
        "INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)",
        (filename, datetime.now().isoformat()),
    )
    conn.commit()

def migrate():
    """Apply all pending migrations."""
    ensure_db_exists()
    os.makedirs(MIGRATIONS_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    applied = get_applied_migrations(conn)

    # ✔ Sort files numerically (REAL fix)
    all_migrations = sorted(
        (f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")),
        key=migration_sort_key
    )

    for m in all_migrations:
        if m not in applied:
            apply_migration(conn, m)

    conn.close()
    print("✅ All migrations applied!")

def new_migration(name: str):
    """Create a new empty migration file."""
    os.makedirs(MIGRATIONS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{timestamp}_{name}.sql"
    path = os.path.join(MIGRATIONS_DIR, filename)
    with open(path, "w") as f:
        f.write("-- Write your SQL migration here\n")
    print(f"📝 Created new migration file: {path}")

# -------------------------------
# Entry point
# -------------------------------
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "new":
        migration_name = "_".join(sys.argv[2:]) or "new_migration"
        new_migration(migration_name)
    else:
        migrate()
