CREATE ROLE vape_admin WITH LOGIN PASSWORD 'Aldous.txt';

CREATE DATABASE vape_inventory
    WITH
    OWNER = vape_admin
    ENCODING = 'UTF8'
    TEMPLATE = template0;

-- Connect to the database before running the remaining statements.
-- Example in psql:
-- \c vape_inventory

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id BIGSERIAL PRIMARY KEY,
    supplier_name VARCHAR(120) NOT NULL,
    contact_person VARCHAR(120),
    phone VARCHAR(30),
    email VARCHAR(120),
    address TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    product_id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(40) NOT NULL UNIQUE,
    product_name VARCHAR(150) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    flavor VARCHAR(120) NOT NULL,
    nicotine_strength VARCHAR(30) NOT NULL,
    puff_count INTEGER,
    size_ml NUMERIC(6,2),
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    retail_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity_in_stock INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    supplier_id BIGINT REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_product_status CHECK (status IN ('Active', 'Low Stock', 'Archived')),
    CONSTRAINT chk_quantity_in_stock CHECK (quantity_in_stock >= 0),
    CONSTRAINT chk_reorder_level CHECK (reorder_level >= 0),
    CONSTRAINT chk_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT chk_retail_price CHECK (retail_price >= 0)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    movement_id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL,
    reference_note TEXT,
    moved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_movement_type CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
    CONSTRAINT chk_movement_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_moved_at ON stock_movements(moved_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.movement_type = 'IN' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock + NEW.quantity
            WHERE product_id = NEW.product_id;
        ELSIF NEW.movement_type = 'OUT' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock - NEW.quantity
            WHERE product_id = NEW.product_id;
        ELSE
            UPDATE products
            SET quantity_in_stock = NEW.quantity
            WHERE product_id = NEW.product_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.product_id <> NEW.product_id THEN
            IF OLD.movement_type = 'IN' THEN
                UPDATE products
                SET quantity_in_stock = quantity_in_stock - OLD.quantity
                WHERE product_id = OLD.product_id;
            ELSIF OLD.movement_type = 'OUT' THEN
                UPDATE products
                SET quantity_in_stock = quantity_in_stock + OLD.quantity
                WHERE product_id = OLD.product_id;
            END IF;

            IF NEW.movement_type = 'IN' THEN
                UPDATE products
                SET quantity_in_stock = quantity_in_stock + NEW.quantity
                WHERE product_id = NEW.product_id;
            ELSIF NEW.movement_type = 'OUT' THEN
                UPDATE products
                SET quantity_in_stock = quantity_in_stock - NEW.quantity
                WHERE product_id = NEW.product_id;
            ELSE
                UPDATE products
                SET quantity_in_stock = NEW.quantity
                WHERE product_id = NEW.product_id;
            END IF;
            RETURN NEW;
        END IF;

        IF OLD.movement_type = 'IN' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock - OLD.quantity
            WHERE product_id = OLD.product_id;
        ELSIF OLD.movement_type = 'OUT' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock + OLD.quantity
            WHERE product_id = OLD.product_id;
        END IF;

        IF NEW.movement_type = 'IN' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock + NEW.quantity
            WHERE product_id = NEW.product_id;
        ELSIF NEW.movement_type = 'OUT' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock - NEW.quantity
            WHERE product_id = NEW.product_id;
        ELSE
            UPDATE products
            SET quantity_in_stock = NEW.quantity
            WHERE product_id = NEW.product_id;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.movement_type = 'IN' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock - OLD.quantity
            WHERE product_id = OLD.product_id;
        ELSIF OLD.movement_type = 'OUT' THEN
            UPDATE products
            SET quantity_in_stock = quantity_in_stock + OLD.quantity
            WHERE product_id = OLD.product_id;
        END IF;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT OR UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION apply_stock_movement();
