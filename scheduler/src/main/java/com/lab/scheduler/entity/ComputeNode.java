package com.lab.scheduler.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compute_node")
public class ComputeNode {
    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "hostname", nullable = false, length = 256)
    private String hostname;

    @Column(name = "port", nullable = false)
    private Integer port;

    @Column(name = "cpu_usage")
    private Double cpuUsage;

    @Column(name = "memory_usage")
    private Double memoryUsage;

    @Column(name = "memory_total_gb")
    private Double memoryTotalGB;

    @Column(name = "memory_used_gb")
    private Double memoryUsedGB;

    @Column(name = "active_tasks")
    private Integer activeTasks;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "last_heartbeat")
    private LocalDateTime lastHeartbeat;

    @Column(name = "registered_at", nullable = false)
    private LocalDateTime registeredAt;

    @PrePersist
    protected void onCreate() {
        registeredAt = LocalDateTime.now();
    }
}
