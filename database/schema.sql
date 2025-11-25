-- API Testing System Database Schema
-- Based on screenshot_2 architecture

-- Create database
CREATE DATABASE IF NOT EXISTS mcp_api_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mcp_api_testing;

-- Table to store registered APIs
CREATE TABLE IF NOT EXISTS registered_apis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(512) NOT NULL,
    method ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS') NOT NULL DEFAULT 'GET',
    request_type VARCHAR(100) DEFAULT 'application/json',
    request_params JSON DEFAULT NULL,
    description TEXT,
    status ENUM('active', 'inactive', 'testing') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_endpoint (endpoint(255)),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store API test results
CREATE TABLE IF NOT EXISTS api_test_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_id INT NOT NULL,
    scenario_name VARCHAR(255),
    test_params JSON,
    response_status INT,
    response_time_ms INT,
    response_body TEXT,
    response_headers JSON,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_id) REFERENCES registered_apis(id) ON DELETE CASCADE,
    INDEX idx_api_id (api_id),
    INDEX idx_tested_at (tested_at),
    INDEX idx_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store AI-generated metadata
CREATE TABLE IF NOT EXISTS api_ai_metadata (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_id INT NOT NULL,
    test_result_id INT,
    ai_summary TEXT,
    ai_recommendations JSON,
    validation_result JSON,
    risk_assessment TEXT,
    performance_notes TEXT,
    model_used VARCHAR(100),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_id) REFERENCES registered_apis(id) ON DELETE CASCADE,
    FOREIGN KEY (test_result_id) REFERENCES api_test_results(id) ON DELETE SET NULL,
    INDEX idx_api_id (api_id),
    INDEX idx_test_result_id (test_result_id),
    INDEX idx_generated_at (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store API request/response logs
CREATE TABLE IF NOT EXISTS api_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_id INT NOT NULL,
    request_method VARCHAR(10),
    request_url VARCHAR(512),
    request_headers JSON,
    request_body TEXT,
    response_status INT,
    response_body TEXT,
    response_headers JSON,
    duration_ms INT,
    error TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (api_id) REFERENCES registered_apis(id) ON DELETE CASCADE,
    INDEX idx_api_id (api_id),
    INDEX idx_logged_at (logged_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- View for API statistics
CREATE OR REPLACE VIEW api_statistics AS
SELECT
    ra.id,
    ra.name,
    ra.endpoint,
    ra.method,
    ra.status,
    COUNT(DISTINCT atr.id) as total_tests,
    SUM(CASE WHEN atr.success = TRUE THEN 1 ELSE 0 END) as successful_tests,
    SUM(CASE WHEN atr.success = FALSE THEN 1 ELSE 0 END) as failed_tests,
    AVG(atr.response_time_ms) as avg_response_time_ms,
    MAX(atr.tested_at) as last_tested_at,
    COUNT(DISTINCT aam.id) as ai_analyses_count
FROM registered_apis ra
LEFT JOIN api_test_results atr ON ra.id = atr.api_id
LEFT JOIN api_ai_metadata aam ON ra.id = aam.api_id
GROUP BY ra.id, ra.name, ra.endpoint, ra.method, ra.status;
