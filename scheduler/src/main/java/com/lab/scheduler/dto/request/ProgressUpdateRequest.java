package com.lab.scheduler.dto.request;

import lombok.Data;

@Data
public class ProgressUpdateRequest {
    private String subtaskId;
    private String taskId;
    private String nodeId;
    private int iteration;
    private double currentResidual;
}
