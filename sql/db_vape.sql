CREATE DATABASE IF NOT EXISTS db_vape;
USE db_vape;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_name VARCHAR(120) NOT NULL,
  contact_person VARCHAR(120) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(120) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_suppliers_supplier_name (supplier_name)
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(150) NOT NULL,
  flavor VARCHAR(100) DEFAULT '-',
  sku VARCHAR(50) NOT NULL UNIQUE,
  quantity INT NOT NULL DEFAULT 0,
  status ENUM('In Stock', 'Low Stock', 'Expiring soon', 'Out of Stock') NOT NULL DEFAULT 'In Stock',
  supplier_id INT DEFAULT NULL,
  description TEXT,
  unit_price DECIMAL(10,2) DEFAULT 0.00,
  expiry_date DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stock_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  action_type ENUM('Added', 'Adjusted', 'Removed') NOT NULL,
  quantity_change INT NOT NULL,
  notes VARCHAR(255) DEFAULT NULL,
  logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_logs_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_expiry_date ON products(expiry_date);
CREATE INDEX idx_stock_logs_product_id ON stock_logs(product_id);
CREATE INDEX idx_stock_logs_logged_at ON stock_logs(logged_at);

INSERT INTO suppliers (supplier_name, contact_person, phone, email, address)
VALUES
  ('Bugoyskie Imports', 'Dolores E. Samar', '09094611033', 'orders@bugoyskie.example', 'Makati City, Philippines'),
  ('Cloud Nine Traders', 'Marcus Lim', '09171234567', 'hello@cloudnine.example', 'Quezon City, Philippines')
ON DUPLICATE KEY UPDATE supplier_name = VALUES(supplier_name);

INSERT INTO products (product_name, flavor, sku, quantity, status, supplier_id, description, unit_price, expiry_date)
VALUES
  ('Vapor HQ (Nova)', '-', 'VPEN102', 120, 'In Stock', 1, 'A sleek, rechargeable vape pen designed for smooth delivery and bold flavor.', 599.00, '2026-12-20'),
  ('Vapor HQ (Pulse)', '-', 'POD330', 45, 'Low Stock', 2, 'Compact pod device with crisp airflow and fast charging.', 420.00, '2026-10-03'),
  ('Vapor HQ (Frostline)', 'Mint', 'EJ203', 200, 'In Stock', 1, 'Icy mint e-juice blend with consistent vapor production.', 250.00, '2026-11-19'),
  ('Vapor HQ (Mallow)', 'Marshmallow', 'EJ319', 15, 'Expiring soon', 2, 'Sweet dessert profile made for low-nic smooth draws.', 260.00, '2026-05-15')
ON DUPLICATE KEY UPDATE product_name = VALUES(product_name);

INSERT INTO stock_logs (product_id, action_type, quantity_change, notes, logged_at)
VALUES
  (1, 'Added', 30, 'Initial stock refill', '2026-04-10 09:00:00'),
  (1, 'Adjusted', 5, 'Shelf recount', '2026-04-12 09:00:00'),
  (2, 'Removed', 15, 'Retail sale batch', '2026-04-13 09:00:00'),
  (4, 'Removed', 8, 'Promo bundle sales', '2026-04-14 09:00:00');
