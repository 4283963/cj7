package com.lab.scheduler.dto.request;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class HeartbeatRequest {
    private String nodeId;
    private String name;
    private String hostname;
    private int port;
    private double cpuUsage;
    private double memoryUsage;
    private double memoryTotalGB;
    private double memoryUsedGB;
    private int activeTasks;
    private String status;
    private String lastHeartbeat;
}
