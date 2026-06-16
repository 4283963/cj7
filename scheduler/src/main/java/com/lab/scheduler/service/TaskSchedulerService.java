package com.lab.scheduler.service;

import com.lab.scheduler.dto.request.ComputeResultCallback;
import com.lab.scheduler.dto.request.ProgressUpdateRequest;
import com.lab.scheduler.dto.request.SubmitTaskRequest;
import com.lab.scheduler.entity.ComputeNode;
import com.lab.scheduler.entity.ComputeTask;
import com.lab.scheduler.entity.ConvergenceData;
import com.lab.scheduler.entity.Subtask;
import com.lab.scheduler.repository.TaskRepository;
import com.lab.scheduler.repository.SubtaskRepository;
import com.lab.scheduler.repository.ConvergenceDataRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TaskSchedulerService {

    @Autowired
    private TaskRepository taskRepository;
    
    @Autowired
    private SubtaskRepository subtaskRepository;
    
    @Autowired
    private ConvergenceDataRepository convergenceDataRepository;
    
    @Autowired
    private LoadBalancerService loadBalancerService;
    
    @Autowired
    private TaskSplitterService taskSplitterService;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    private RestTemplate restTemplate = new RestTemplate();

    public ComputeTask createTask(SubmitTaskRequest request) {
        ComputeTask task = new ComputeTask();
        task.setId(generateTaskId());
        task.setName(request.getName());
        task.setMatrixDimension(request.getMatrixDimension());
        task.setPhysicsFormula(request.getPhysicsFormula());
        task.setTotalIterations(request.getMaxIterations());
        task.setTargetResidual(request.getTargetResidual());
        task.setSplitCount(request.getSplitCount());
        task.setCurrentResidual(1.0);
        task.setProgressPercent(0.0);
        task.setStatus("QUEUED");
        
        task = taskRepository.save(task);
        
        List<ComputeNode> nodes = loadBalancerService.selectNodes(request.getSplitCount());
        if (nodes.isEmpty()) {
            task.setStatus("PENDING");
            return taskRepository.save(task);
        }
        
        List<String> nodeIds = nodes.stream().map(ComputeNode::getId).collect(Collectors.toList());
        task.setAssignedNodes(nodeIds.toArray(new String[0]));
        
        List<Subtask> subtasks = taskSplitterService.splitTask(task, nodeIds);
        subtaskRepository.saveAll(subtasks);
        
        task.setStatus("PENDING");
        return taskRepository.save(task);
    }

    @Scheduled(fixedDelay = 5000)
    public void dispatchPendingTasks() {
        List<ComputeTask> pendingTasks = taskRepository.findPendingTasks();
        for (ComputeTask task : pendingTasks) {
            dispatchTask(task);
        }
    }

    private void dispatchTask(ComputeTask task) {
        List<Subtask> subtasks = subtaskRepository.findByTaskId(task.getId());
        List<Subtask> pendingSubtasks = subtasks.stream()
            .filter(s -> "PENDING".equals(s.getStatus()))
            .collect(Collectors.toList());
            
        if (pendingSubtasks.isEmpty()) return;
        
        if (task.getStartedAt() == null) {
            task.setStartedAt(LocalDateTime.now());
            task.setStatus("RUNNING");
            taskRepository.save(task);
        }
        
        for (Subtask subtask : pendingSubtasks) {
            ComputeNode node = loadBalancerService.selectBestNode();
            if (node == null) break;
            
            subtask.setNodeId(node.getId());
            subtask.setStatus("QUEUED");
            subtaskRepository.save(subtask);
            
            sendTaskToNode(subtask, task, node);
        }
    }

    private void sendTaskToNode(Subtask subtask, ComputeTask task, ComputeNode node) {
        try {
            String nodeUrl = String.format("http://%s:%d/api/compute/submit", 
                node.getHostname(), node.getPort());
            
            Map<String, Object> payload = taskSplitterService.generateSubtaskPayload(subtask, task);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            
            restTemplate.postForObject(nodeUrl, request, Map.class);
            
            subtask.setStatus("RUNNING");
            subtask.setStartedAt(LocalDateTime.now());
            subtaskRepository.save(subtask);
            
        } catch (Exception e) {
            subtask.setStatus("PENDING");
            subtask.setNodeId(null);
            subtaskRepository.save(subtask);
        }
    }

    public void updateProgress(ProgressUpdateRequest request) {
        subtaskRepository.findById(request.getSubtaskId()).ifPresent(subtask -> {
            subtask.setCurrentIteration(request.getIteration());
            subtask.setCurrentResidual(request.getCurrentResidual());
            subtaskRepository.save(subtask);
            
            ConvergenceData cd = new ConvergenceData();
            cd.setSubtaskId(request.getSubtaskId());
            cd.setIteration(request.getIteration());
            cd.setResidual(request.getCurrentResidual());
            convergenceDataRepository.save(cd);
            
            updateTaskProgress(request.getTaskId());
        });
    }

    public void processComputeResult(ComputeResultCallback callback) {
        subtaskRepository.findById(callback.getSubtaskId()).ifPresent(subtask -> {
            subtask.setStatus(callback.getStatus());
            subtask.setCurrentIteration(callback.getIterations());
            subtask.setCurrentResidual(callback.getFinalResidual());
            subtask.setComputeTimeMs(callback.getComputeTimeMs());
            subtask.setCompletedAt(LocalDateTime.now());
            
            if (callback.getEigenvalues() != null) {
                try {
                    subtask.setResultEigenvalues(objectMapper.writeValueAsString(callback.getEigenvalues()));
                } catch (Exception e) {}
            }
            
            subtaskRepository.save(subtask);
            
            if (callback.getConvergenceHistory() != null) {
                for (Map<String, Object> point : callback.getConvergenceHistory()) {
                    ConvergenceData cd = new ConvergenceData();
                    cd.setSubtaskId(callback.getSubtaskId());
                    cd.setIteration((Integer) point.get("iteration"));
                    cd.setResidual(((Number) point.get("residual")).doubleValue());
                    convergenceDataRepository.save(cd);
                }
            }
            
            updateTaskProgress(callback.getTaskId());
        });
    }

    private void updateTaskProgress(String taskId) {
        taskRepository.findById(taskId).ifPresent(task -> {
            List<Subtask> subtasks = subtaskRepository.findByTaskId(taskId);
            
            if (subtasks.isEmpty()) return;
            
            long completedCount = subtasks.stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()))
                .count();
                
            long failedCount = subtasks.stream()
                .filter(s -> "FAILED".equals(s.getStatus()))
                .count();
            
            int totalIterations = subtasks.stream()
                .mapToInt(Subtask::getCurrentIteration)
                .sum();
                
            int maxPossibleIterations = subtasks.stream()
                .mapToInt(Subtask::getMaxIterations)
                .sum();
                
            double avgResidual = subtasks.stream()
                .filter(s -> s.getCurrentResidual() != null)
                .mapToDouble(Subtask::getCurrentResidual)
                .average()
                .orElse(1.0);
            
            task.setCurrentIteration(totalIterations / subtasks.size());
            task.setCurrentResidual(avgResidual);
            task.setProgressPercent((completedCount * 100.0) / subtasks.size());
            
            Set<String> assignedNodes = subtasks.stream()
                .map(Subtask::getNodeId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
            task.setAssignedNodes(assignedNodes.toArray(new String[0]));
            
            if (completedCount == subtasks.size()) {
                task.setStatus("COMPLETED");
                task.setCompletedAt(LocalDateTime.now());
                task.setProgressPercent(100.0);
            } else if (failedCount > 0 && completedCount + failedCount == subtasks.size()) {
                task.setStatus("FAILED");
            }
            
            taskRepository.save(task);
        });
    }

    public List<ComputeTask> getAllTasks() {
        List<ComputeTask> tasks = taskRepository.findAllOrderByCreatedAtDesc();
        for (ComputeTask task : tasks) {
            List<Subtask> subtasks = subtaskRepository.findByTaskIdOrderByMatrixStartRowAsc(task.getId());
            task.setSubtasks(subtasks);
            
            Set<String> nodeIds = subtasks.stream()
                .map(Subtask::getNodeId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
            task.setAssignedNodes(nodeIds.toArray(new String[0]));
            
            if (task.getProgressPercent() == null) {
                task.setProgressPercent(0.0);
            }
        }
        return tasks;
    }

    public Optional<ComputeTask> getTaskById(String taskId) {
        return taskRepository.findById(taskId).map(task -> {
            List<Subtask> subtasks = subtaskRepository.findByTaskIdOrderByMatrixStartRowAsc(taskId);
            task.setSubtasks(subtasks);
            return task;
        });
    }

    public List<Map<String, Object>> getConvergenceData(String taskId) {
        List<ConvergenceData> data = convergenceDataRepository.findLatestByTaskId(taskId);
        return data.stream().map(cd -> {
            Map<String, Object> point = new HashMap<>();
            point.put("iteration", cd.getIteration());
            point.put("residual", cd.getResidual());
            point.put("timestamp", cd.getTimestamp().toString());
            point.put("subtaskId", cd.getSubtaskId());
            return point;
        }).collect(Collectors.toList());
    }

    public boolean cancelTask(String taskId) {
        return taskRepository.findById(taskId).map(task -> {
            if ("RUNNING".equals(task.getStatus()) || "PENDING".equals(task.getStatus()) || "QUEUED".equals(task.getStatus())) {
                task.setStatus("FAILED");
                task.setCompletedAt(LocalDateTime.now());
                taskRepository.save(task);
                
                List<Subtask> subtasks = subtaskRepository.findByTaskId(taskId);
                for (Subtask subtask : subtasks) {
                    if ("RUNNING".equals(subtask.getStatus()) || "PENDING".equals(subtask.getStatus()) || "QUEUED".equals(subtask.getStatus())) {
                        subtask.setStatus("FAILED");
                        subtaskRepository.save(subtask);
                    }
                }
                return true;
            }
            return false;
        }).orElse(false);
    }

    public Map<String, Object> getDashboardSummary() {
        Map<String, Object> result = new HashMap<>();
        
        List<ComputeTask> tasks = getAllTasks();
        List<ComputeNode> nodes = loadBalancerService.getClusterStatus().entrySet().stream()
            .map(e -> {
                ComputeNode node = new ComputeNode();
                node.setId(e.getKey());
                return node;
            })
            .collect(Collectors.toList());
        
        Map<String, Object> clusterStatus = loadBalancerService.getClusterStatus();
        result.put("summary", clusterStatus);
        result.put("tasks", tasks);
        result.put("nodes", nodeMonitorService != null ? nodeMonitorService.getAllNodes() : Collections.emptyList());
        
        return result;
    }

    @Autowired(required = false)
    private NodeMonitorService nodeMonitorService;

    private String generateTaskId() {
        return "task-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
