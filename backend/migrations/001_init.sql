-- =========================================================
-- 001_init.sql — Base schema (matching SQLAlchemy models)
-- =========================================================

-- ============================
-- DEVICES TABLE
-- ============================
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    broker_url TEXT DEFAULT 'broker.hivemq.com',
    protocol TEXT,
    host TEXT,
    port INTEGER DEFAULT 1883,
    client_id TEXT,
    username TEXT,
    password TEXT,
    mqtt_version TEXT,
    keep_alive INTEGER,
    auto_reconnect BOOLEAN,
    reconnect_period INTEGER,
    status TEXT DEFAULT 'offline',
    enable_tls BOOLEAN DEFAULT 0,
    is_connected BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    last_seen DATETIME
);

-- ============================
-- SENSORS TABLE
-- ============================
CREATE TABLE IF NOT EXISTS sensors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    topic TEXT,
    payload TEXT,
    temperature REAL,
    humidity REAL,
    pressure REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_data TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id)
);
