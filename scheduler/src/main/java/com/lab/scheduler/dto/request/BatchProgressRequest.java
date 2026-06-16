package com.lab.scheduler.dto.request;

import lombok.Data;
import java.util.List;

@Data
public class BatchProgressRequest {
    private List<ProgressItem> items;

    @Data
    public static class ProgressItem {
        private String subtaskId;
        private String taskId;
        private String nodeId;
        private Integer iteration;
        private Double currentResidual;
    }
}
