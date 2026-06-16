package com.lab.scheduler.controller;

import com.lab.scheduler.dto.request.SubmitTaskRequest;
import com.lab.scheduler.entity.ComputeTask;
import com.lab.scheduler.service.TaskSchedulerService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class TaskController {

    @Autowired
    private TaskSchedulerService taskSchedulerService;

    @GetMapping
    public ResponseEntity<List<ComputeTask>> getAllTasks() {
        List<ComputeTask> tasks = taskSchedulerService.getAllTasks();
        return ResponseEntity.ok(tasks);
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<ComputeTask> getTaskById(@PathVariable String taskId) {
        return taskSchedulerService.getTaskById(taskId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{taskId}/convergence")
    public ResponseEntity<List<Map<String, Object>>> getConvergenceData(@PathVariable String taskId) {
        List<Map<String, Object>> data = taskSchedulerService.getConvergenceData(taskId);
        return ResponseEntity.ok(data);
    }

    @PostMapping
    public ResponseEntity<ComputeTask> createTask(@Valid @RequestBody SubmitTaskRequest request) {
        ComputeTask task = taskSchedulerService.createTask(request);
        return ResponseEntity.ok(task);
    }

    @PostMapping("/{taskId}/cancel")
    public ResponseEntity<Map<String, String>> cancelTask(@PathVariable String taskId) {
        boolean cancelled = taskSchedulerService.cancelTask(taskId);
        if (cancelled) {
            return ResponseEntity.ok(Map.of("status", "cancelled", "taskId", taskId);
        }
        return ResponseEntity.badRequest().body(Map.of("error", "Cannot cancel task", "taskId", taskId));
    }
}
