package com.lab.scheduler.controller;

import com.lab.scheduler.dto.request.BatchProgressRequest;
import com.lab.scheduler.dto.request.ComputeResultCallback;
import com.lab.scheduler.dto.request.ProgressUpdateRequest;
import com.lab.scheduler.service.TaskSchedulerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/compute")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class ComputeController {

    @Autowired
    private TaskSchedulerService taskSchedulerService;

    @PostMapping("/callback")
    public ResponseEntity<Map<String, String>> receiveComputeResult(@RequestBody ComputeResultCallback callback) {
        taskSchedulerService.processComputeResult(callback);
        return ResponseEntity.ok(Map.of("status", "received"));
    }

    @PostMapping("/progress")
    public ResponseEntity<Map<String, String>> receiveProgressUpdate(@RequestBody ProgressUpdateRequest request) {
        taskSchedulerService.updateProgress(request);
        return ResponseEntity.ok(Map.of("status", "received"));
    }

    @PostMapping("/progress/batch")
    public ResponseEntity<Map<String, String>> receiveProgressBatch(@RequestBody BatchProgressRequest request) {
        taskSchedulerService.updateProgressBatch(request);
        return ResponseEntity.ok(Map.of("status", "received"));
    }
}
