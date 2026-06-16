package com.lab.scheduler.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "convergence_data")
public class ConvergenceData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "subtask_id", nullable = false, length = 64)
    private String subtaskId;

    @Column(name = "iteration", nullable = false)
    private Integer iteration;

    @Column(name = "residual", nullable = false)
    private Double residual;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}
