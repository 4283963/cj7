CREATE DATABASE IF NOT EXISTS lab_matrix_scheduler
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE lab_matrix_scheduler;

CREATE TABLE compute_node (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    hostname VARCHAR(256) NOT NULL,
    port INT NOT NULL,
    cpu_usage DOUBLE DEFAULT 0,
    memory_usage DOUBLE DEFAULT 0,
    memory_total_gb DOUBLE DEFAULT 0,
    memory_used_gb DOUBLE DEFAULT 0,
    active_tasks INT DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE',
    last_heartbeat DATETIME,
    registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_node_status (status),
    INDEX idx_heartbeat (last_heartbeat)
) ENGINE=InnoDB;

CREATE TABLE compute_task (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    matrix_dimension INT NOT NULL,
    physics_formula TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    total_iterations INT NOT NULL,
    current_iteration INT DEFAULT 0,
    target_residual DOUBLE NOT NULL,
    current_residual DOUBLE,
    split_count INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    INDEX idx_task_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE subtask (
    id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL,
    node_id VARCHAR(64),
    matrix_start_row INT NOT NULL,
    matrix_end_row INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    current_iteration INT DEFAULT 0,
    max_iterations INT NOT NULL,
    current_residual DOUBLE,
    result_eigenvalues TEXT,
    result_eigenvectors TEXT,
    compute_time_ms BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (task_id) REFERENCES compute_task(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id) REFERENCES compute_node(id) ON DELETE SET NULL,
    INDEX idx_subtask_task (task_id),
    INDEX idx_subtask_node (node_id),
    INDEX idx_subtask_status (status)
) ENGINE=InnoDB;

CREATE TABLE convergence_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subtask_id VARCHAR(64) NOT NULL,
    iteration INT NOT NULL,
    residual DOUBLE NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subtask_id) REFERENCES subtask(id) ON DELETE CASCADE,
    INDEX idx_conv_subtask (subtask_id),
    INDEX idx_conv_iteration (subtask_id, iteration)
) ENGINE=InnoDB;

INSERT INTO compute_node (id, name, hostname, port, status, memory_total_gb, registered_at) VALUES
('node-001', '计算节点-01', '192.168.1.101', 5000, 'ONLINE', 64, NOW() - INTERVAL 7 DAY),
('node-002', '计算节点-02', '192.168.1.102', 5000, 'ONLINE', 64, NOW() - INTERVAL 7 DAY),
('node-003', '计算节点-03', '192.168.1.103', 5000, 'ONLINE', 128, NOW() - INTERVAL 7 DAY),
('node-004', '计算节点-04', '192.168.1.104', 5000, 'ONLINE', 128, NOW() - INTERVAL 7 DAY);
