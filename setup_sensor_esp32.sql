-- Bootstrap database untuk AgroMonitor v3
-- Jalankan salah satu dari command berikut:
--   mysql -u root -p < setup_sensor_esp32.sql
--   mysql -u root -p -e "source setup_sensor_esp32.sql"

CREATE DATABASE IF NOT EXISTS sensor_esp32
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sensor_esp32;

CREATE TABLE IF NOT EXISTS DataSensor (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  suhuUdara DECIMAL(5,2) NOT NULL,
  kelUdara DECIMAL(5,2) NOT NULL,
  kelTanah DECIMAL(5,2) NOT NULL,
  kecerahan DECIMAL(5,2) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL DEFAULT 0,
  longitude DECIMAL(10,7) NOT NULL DEFAULT 0,
  waktu TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_waktu (waktu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS DeviceConfig (
  setting_name VARCHAR(50) NOT NULL,
  setting_value VARCHAR(50) NOT NULL,
  PRIMARY KEY (setting_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO DeviceConfig (setting_name, setting_value) VALUES ('relay_mode', 'OFF');