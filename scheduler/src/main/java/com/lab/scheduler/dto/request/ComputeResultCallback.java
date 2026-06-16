package com.lab.scheduler.dto.request;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ComputeResultCallback {
    private String subtaskId;
    private String taskId;
    private String status;
    private double[] eigenvalues;
    private double[][] eigenvectors;
    private List<Map<String, Object>> convergenceHistory;
    private double finalResidual;
    private int iterations;
    private String nodeId;
    private long computeTimeMs;
    private String error;
}
