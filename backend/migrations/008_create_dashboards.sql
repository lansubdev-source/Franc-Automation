-- =========================================================
-- 007_create_dashboards.sql — Dashboard + Widgets tables
-- Fully aligned with models.py and dashboardbuilder_routes.py
-- =========================================================

-- ============================
-- DASHBOARDS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- ============================
-- DASHBOARD WIDGETS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    widget_type TEXT NOT NULL,       -- temperature_chart, humidity_chart, line, gauge, table, onoff...
    title TEXT,
    device_id INTEGER,
    sensor TEXT,                     -- sensor topic or sensor ID
    config TEXT,                     -- stored as JSON string from backend
    position TEXT,                   -- optional grid placement (r1c1, r2c3, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);
