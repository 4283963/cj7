package com.lab.scheduler.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "subtask")
public class Subtask {
    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "task_id", nullable = false, length = 64)
    private String taskId;

    @Column(name = "node_id", length = 64)
    private String nodeId;

    @Column(name = "matrix_start_row", nullable = false)
    private Integer matrixStartRow;

    @Column(name = "matrix_end_row", nullable = false)
    private Integer matrixEndRow;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "current_iteration")
    private Integer currentIteration;

    @Column(name = "max_iterations", nullable = false)
    private Integer maxIterations;

    @Column(name = "current_residual")
    private Double currentResidual;

    @Column(name = "result_eigenvalues", columnDefinition = "TEXT")
    private String resultEigenvalues;

    @Column(name = "result_eigenvectors", columnDefinition = "TEXT")
    private String resultEigenvectors;

    @Column(name = "compute_time_ms")
    private Long computeTimeMs;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        currentIteration = 0;
        status = "PENDING";
    }
}
