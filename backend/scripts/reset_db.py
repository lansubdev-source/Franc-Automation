import os
import sys

# Allow importing from the backend root folder
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from extensions import db

def reset_database():
    """Drops and recreates all database tables."""
    with app.app_context():
        db_path = os.path.join("instance", "app.db")

        # Delete SQLite file if it exists
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"🗑️  Deleted old database: {db_path}")

        # Recreate all tables
        db.create_all()
        print("✅ New database created successfully!")

if __name__ == "__main__":
    reset_database()
