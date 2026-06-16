package com.lab.scheduler.dto.request;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ComputeResultCallback {
    private String type;
    private String subtaskId;
    private String taskId;
    private String status;
    private double[] eigenvalues;
    private double[][] eigenvectors;
    private List<Map<String, Object>> convergenceHistory;
    private Double finalResidual;
    private Integer iterations;
    private String nodeId;
    private Long computeTimeMs;
    private String error;
    private Boolean cancelled;
}
