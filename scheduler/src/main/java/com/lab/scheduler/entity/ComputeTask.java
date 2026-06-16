package com.lab.scheduler.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compute_task")
public class ComputeTask {
    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Column(name = "matrix_dimension", nullable = false)
    private Integer matrixDimension;

    @Column(name = "physics_formula", columnDefinition = "TEXT")
    private String physicsFormula;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "total_iterations", nullable = false)
    private Integer totalIterations;

    @Column(name = "current_iteration")
    private Integer currentIteration;

    @Column(name = "target_residual", nullable = false)
    private Double targetResidual;

    @Column(name = "current_residual")
    private Double currentResidual;

    @Column(name = "split_count", nullable = false)
    private Integer splitCount;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Transient
    private Double progressPercent;

    @Transient
    private String[] assignedNodes;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        currentIteration = 0;
        status = "PENDING";
    }
}
