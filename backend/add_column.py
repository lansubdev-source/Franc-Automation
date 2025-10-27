# backend/add_column.py
from backend.extensions import db
from backend.models import Sensor
from sqlalchemy import Column, String

# Check if column exists, if not add it
if not hasattr(Sensor, "friendly_name"):
    from sqlalchemy import text
    db.session.execute(text("ALTER TABLE sensors ADD COLUMN friendly_name TEXT"))
    db.session.commit()
    print("✅ Column 'friendly_name' added successfully")
else:
    print("Column 'friendly_name' already exists")
