package com.lab.scheduler.dto.request;

import lombok.Data;

@Data
public class FluidFieldRequest {
    private String taskId;
    private Integer gridSize = 100;
    private Integer mode = 0;
    private String flowType = "taylor-green";
    private Integer matrixDimension = 200;
}
