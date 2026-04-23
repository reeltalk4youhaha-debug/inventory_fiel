-- Run this as a PostgreSQL superuser or database owner.
-- 1. Create the database:
--    CREATE DATABASE inventory_hq;
-- 2. Connect to it:
--    \c inventory_hq

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS inventory_hq;

CREATE TABLE IF NOT EXISTS inventory_hq.admin_users (
    admin_id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(120) NOT NULL DEFAULT 'Inventory Manager',
    workspace_name VARCHAR(120) NOT NULL DEFAULT 'Vapor HQ',
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    member_since VARCHAR(40) NOT NULL DEFAULT 'April 2026',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_hq.products (
    product_id BIGSERIAL PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    flavor VARCHAR(120) NOT NULL,
    sku VARCHAR(40) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    description TEXT NOT NULL DEFAULT '',
    last_update TEXT NOT NULL DEFAULT 'Recently added product',
    image_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_hq_products_created_at
    ON inventory_hq.products (created_at DESC);

CREATE OR REPLACE FUNCTION inventory_hq.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_hq_admin_users_updated_at ON inventory_hq.admin_users;
CREATE TRIGGER trg_inventory_hq_admin_users_updated_at
BEFORE UPDATE ON inventory_hq.admin_users
FOR EACH ROW
EXECUTE FUNCTION inventory_hq.set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_hq_products_updated_at ON inventory_hq.products;
CREATE TRIGGER trg_inventory_hq_products_updated_at
BEFORE UPDATE ON inventory_hq.products
FOR EACH ROW
EXECUTE FUNCTION inventory_hq.set_updated_at();

INSERT INTO inventory_hq.admin_users (
    full_name,
    role,
    workspace_name,
    email,
    password_hash,
    member_since,
    is_active
)
VALUES (
    'Admin User',
    'Inventory Manager',
    'Vapor HQ',
    'fiel@gmail.com',
    crypt('1234', gen_salt('bf')),
    'April 2026',
    TRUE
)
ON CONFLICT (email) DO UPDATE
SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    workspace_name = EXCLUDED.workspace_name,
    password_hash = crypt('1234', gen_salt('bf')),
    member_since = EXCLUDED.member_since,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;
