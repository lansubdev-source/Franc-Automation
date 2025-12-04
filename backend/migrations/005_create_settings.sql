-- --------------------------------------------------
-- 005_create_settings.sql
-- Creates the settings table
-- --------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    site_name TEXT,
    site_description TEXT,
    contact_email TEXT,
    footer_text TEXT,

    registration_enabled BOOLEAN DEFAULT 1,

    logo_url TEXT,
    favicon_url TEXT,
    client_logo_url TEXT
);
