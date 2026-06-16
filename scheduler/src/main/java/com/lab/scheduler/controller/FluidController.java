package com.lab.scheduler.controller;

import com.lab.scheduler.dto.request.FluidFieldRequest;
import com.lab.scheduler.dto.response.FluidFieldResponse;
import com.lab.scheduler.service.NodeMonitorService;
import com.lab.scheduler.service.TaskSchedulerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/fluid")
public class FluidController {

    private final TaskSchedulerService taskSchedulerService;
    private final NodeMonitorService nodeMonitorService;

    public FluidController(TaskSchedulerService taskSchedulerService,
                           NodeMonitorService nodeMonitorService) {
        this.taskSchedulerService = taskSchedulerService;
        this.nodeMonitorService = nodeMonitorService;
    }

    @PostMapping("/field")
    public ResponseEntity<FluidFieldResponse> generateFluidField(
            @RequestBody FluidFieldRequest request) {
        try {
            FluidFieldResponse response = taskSchedulerService.generateFluidField(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            FluidFieldResponse error = new FluidFieldResponse();
            error.setSuccess(false);
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/types")
    public ResponseEntity<String[]> getFlowTypes() {
        return ResponseEntity.ok(new String[]{
                "taylor-green",
                "vortex-shedding",
                "channel-flow",
                "double-vortex"
        });
    }
}
