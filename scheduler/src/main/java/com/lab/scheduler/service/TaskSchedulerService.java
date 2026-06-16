package com.lab.scheduler.service;

import com.lab.scheduler.common.TaskStatus;
import com.lab.scheduler.dto.request.BatchProgressRequest;
import com.lab.scheduler.dto.request.ComputeResultCallback;
import com.lab.scheduler.dto.request.FluidFieldRequest;
import com.lab.scheduler.dto.request.ProgressUpdateRequest;
import com.lab.scheduler.dto.request.SubmitTaskRequest;
import com.lab.scheduler.dto.response.FluidFieldResponse;
import com.lab.scheduler.entity.ComputeNode;
import com.lab.scheduler.entity.ComputeTask;
import com.lab.scheduler.entity.ConvergenceData;
import com.lab.scheduler.entity.Subtask;
import com.lab.scheduler.repository.TaskRepository;
import com.lab.scheduler.repository.SubtaskRepository;
import com.lab.scheduler.repository.ConvergenceDataRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Service
public class TaskSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(TaskSchedulerService.class);
    private static final int NODE_HTTP_CONNECT_TIMEOUT_MS = 2000;
    private static final int NODE_CANCEL_READ_TIMEOUT_MS = 3000;
    private static final int NODE_SUBMIT_READ_TIMEOUT_MS = 8000;
    private static final Duration STUCK_CANCELLING_TIMEOUT = Duration.ofSeconds(60);

    private final ExecutorService cancelExecutor = Executors.newFixedThreadPool(
        Math.max(4, Runtime.getRuntime().availableProcessors()),
        r -> {
            Thread t = new Thread(r, "cancel-worker");
            t.setDaemon(true);
            return t;
        }
    );

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

    private final RestTemplate fastRestTemplate;
    private final RestTemplate submitRestTemplate;

    public TaskSchedulerService() {
        this.fastRestTemplate = createRestTemplate(NODE_HTTP_CONNECT_TIMEOUT_MS, NODE_CANCEL_READ_TIMEOUT_MS);
        this.submitRestTemplate = createRestTemplate(NODE_HTTP_CONNECT_TIMEOUT_MS, NODE_SUBMIT_READ_TIMEOUT_MS);
    }

    private static RestTemplate createRestTemplate(int connectTimeoutMs, int readTimeoutMs) {
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(connectTimeoutMs);
        f.setReadTimeout(readTimeoutMs);
        return new RestTemplate(f);
    }

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
        task.setStatus(TaskStatus.QUEUED);

        task = taskRepository.save(task);

        List<ComputeNode> nodes = loadBalancerService.selectNodes(request.getSplitCount());
        if (nodes.isEmpty()) {
            task.setStatus(TaskStatus.PENDING);
            return taskRepository.save(task);
        }

        List<String> nodeIds = nodes.stream().map(ComputeNode::getId).collect(Collectors.toList());
        task.setAssignedNodes(nodeIds.toArray(new String[0]));

        List<Subtask> subtasks = taskSplitterService.splitTask(task, nodeIds);
        subtaskRepository.saveAll(subtasks);

        task.setStatus(TaskStatus.PENDING);
        return taskRepository.save(task);
    }

    @Scheduled(fixedDelay = 5000)
    public void dispatchPendingTasks() {
        List<ComputeTask> pendingTasks = taskRepository.findPendingTasks();
        for (ComputeTask task : pendingTasks) {
            if (!TaskStatus.CANCELLING.equals(task.getStatus())) {
                dispatchTask(task);
            }
        }
    }

    private void dispatchTask(ComputeTask task) {
        List<Subtask> subtasks = subtaskRepository.findByTaskId(task.getId());
        List<Subtask> pendingSubtasks = subtasks.stream()
            .filter(s -> TaskStatus.PENDING.equals(s.getStatus()))
            .collect(Collectors.toList());

        if (pendingSubtasks.isEmpty()) return;

        if (task.getStartedAt() == null) {
            task.setStartedAt(LocalDateTime.now());
            task.setStatus(TaskStatus.RUNNING);
            taskRepository.save(task);
        }

        for (Subtask subtask : pendingSubtasks) {
            ComputeNode node = loadBalancerService.selectBestNode();
            if (node == null) break;

            subtask.setNodeId(node.getId());
            subtask.setStatus(TaskStatus.QUEUED);
            subtaskRepository.save(subtask);

            sendTaskToNodeAsync(subtask, task, node);
        }
    }

    private void sendTaskToNodeAsync(Subtask subtask, ComputeTask task, ComputeNode node) {
        CompletableFuture.runAsync(() -> {
            try {
                String nodeUrl = String.format("http://%s:%d/api/compute/submit",
                    node.getHostname(), node.getPort());

                Map<String, Object> payload = taskSplitterService.generateSubtaskPayload(subtask, task);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

                Map resp = submitRestTemplate.postForObject(nodeUrl, request, Map.class);

                subtask.setStatus(TaskStatus.RUNNING);
                subtask.setStartedAt(LocalDateTime.now());
                subtaskRepository.save(subtask);

            } catch (ResourceAccessException e) {
                log.warn("[{}] 提交子任务到节点超时/失败 node={}, 重回 PENDING: {}",
                    subtask.getId(), node.getId(), e.getMessage());
                subtask.setStatus(TaskStatus.PENDING);
                subtask.setNodeId(null);
                subtaskRepository.save(subtask);
            } catch (Exception e) {
                log.error("[{}] 提交子任务异常, 重回 PENDING", subtask.getId(), e);
                subtask.setStatus(TaskStatus.PENDING);
                subtask.setNodeId(null);
                subtaskRepository.save(subtask);
            }
        }, cancelExecutor);
    }

    public void updateProgress(ProgressUpdateRequest request) {
        subtaskRepository.findById(request.getSubtaskId()).ifPresent(subtask -> {
            if (TaskStatus.isTerminal(subtask.getStatus())) return;
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

    public void updateProgressBatch(BatchProgressRequest batch) {
        if (batch == null || batch.getItems() == null || batch.getItems().isEmpty()) return;

        Set<String> affectedTaskIds = new HashSet<>();

        for (BatchProgressRequest.ProgressItem item : batch.getItems()) {
            subtaskRepository.findById(item.getSubtaskId()).ifPresent(subtask -> {
                if (TaskStatus.isTerminal(subtask.getStatus())) return;
                subtask.setCurrentIteration(item.getIteration());
                subtask.setCurrentResidual(item.getCurrentResidual());
                subtaskRepository.save(subtask);

                ConvergenceData cd = new ConvergenceData();
                cd.setSubtaskId(item.getSubtaskId());
                cd.setIteration(item.getIteration());
                cd.setResidual(item.getCurrentResidual());
                convergenceDataRepository.save(cd);

                affectedTaskIds.add(item.getTaskId());
            });
        }

        for (String taskId : affectedTaskIds) {
            updateTaskProgress(taskId);
        }
    }

    public void processComputeResult(ComputeResultCallback callback) {
        subtaskRepository.findById(callback.getSubtaskId()).ifPresent(subtask -> {
            boolean wasCancelling = TaskStatus.CANCELLING.equals(subtask.getStatus());

            String status = callback.getStatus();
            if (Boolean.TRUE.equals(callback.getCancelled())) {
                status = TaskStatus.CANCELLED;
            }
            if ("CANCELLED".equals(callback.getType())) {
                status = TaskStatus.CANCELLED;
            }

            subtask.setStatus(status);
            subtask.setCurrentIteration(callback.getIterations() != null ? callback.getIterations() : subtask.getCurrentIteration());
            subtask.setCurrentResidual(callback.getFinalResidual());
            subtask.setComputeTimeMs(callback.getComputeTimeMs());
            subtask.setCompletedAt(LocalDateTime.now());

            if (callback.getEigenvalues() != null) {
                try {
                    subtask.setResultEigenvalues(objectMapper.writeValueAsString(callback.getEigenvalues()));
                } catch (Exception ignored) {}
            }

            subtaskRepository.save(subtask);

            if (callback.getConvergenceHistory() != null) {
                List<ConvergenceData> dataPoints = new ArrayList<>();
                for (Map<String, Object> point : callback.getConvergenceHistory()) {
                    ConvergenceData cd = new ConvergenceData();
                    cd.setSubtaskId(callback.getSubtaskId());
                    cd.setIteration(((Number) point.get("iteration")).intValue());
                    cd.setResidual(((Number) point.get("residual")).doubleValue());
                    dataPoints.add(cd);
                }
                if (!dataPoints.isEmpty()) {
                    try {
                        convergenceDataRepository.saveAll(dataPoints);
                    } catch (Exception ignored) {}
                }
            }

            updateTaskProgress(callback.getTaskId());
        });
    }

    private void updateTaskProgress(String taskId) {
        taskRepository.findById(taskId).ifPresent(task -> {
            if (TaskStatus.CANCELLED.equals(task.getStatus()) ||
                TaskStatus.COMPLETED.equals(task.getStatus()) ||
                TaskStatus.FAILED.equals(task.getStatus())) {
                return;
            }

            List<Subtask> subtasks = subtaskRepository.findByTaskId(taskId);
            if (subtasks.isEmpty()) return;

            long completedCount = subtasks.stream()
                .filter(s -> TaskStatus.COMPLETED.equals(s.getStatus()))
                .count();
            long cancelledCount = subtasks.stream()
                .filter(s -> TaskStatus.CANCELLED.equals(s.getStatus()))
                .count();
            long failedCount = subtasks.stream()
                .filter(s -> TaskStatus.FAILED.equals(s.getStatus()))
                .count();
            long cancellingCount = subtasks.stream()
                .filter(s -> TaskStatus.CANCELLING.equals(s.getStatus()))
                .count();

            int totalIterations = subtasks.stream()
                .mapToInt(s -> s.getCurrentIteration() == null ? 0 : s.getCurrentIteration())
                .sum();

            int maxPossibleIterations = subtasks.stream()
                .mapToInt(Subtask::getMaxIterations)
                .sum();

            double avgResidual = subtasks.stream()
                .filter(s -> s.getCurrentResidual() != null)
                .mapToDouble(Subtask::getCurrentResidual)
                .average()
                .orElse(1.0);

            task.setCurrentIteration(subtasks.size() > 0 ? totalIterations / subtasks.size() : 0);
            task.setCurrentResidual(avgResidual);

            long doneTerminal = completedCount + cancelledCount + failedCount;
            task.setProgressPercent(doneTerminal * 100.0 / subtasks.size());

            Set<String> assignedNodes = subtasks.stream()
                .map(Subtask::getNodeId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
            task.setAssignedNodes(assignedNodes.toArray(new String[0]));

            boolean allSubtasksCancellingOrTerminal = subtasks.stream()
                .allMatch(s -> TaskStatus.CANCELLING.equals(s.getStatus()) || TaskStatus.isTerminal(s.getStatus()));

            if (TaskStatus.CANCELLING.equals(task.getStatus())) {
                if (allSubtasksCancellingOrTerminal && cancellingCount == 0) {
                    task.setStatus(TaskStatus.CANCELLED);
                    task.setCompletedAt(LocalDateTime.now());
                    if (task.getProgressPercent() < 100) {
                        task.setProgressPercent(100.0);
                    }
                    log.info("[{}] 任务取消完成", taskId);
                }
            } else {
                if (completedCount == subtasks.size()) {
                    task.setStatus(TaskStatus.COMPLETED);
                    task.setCompletedAt(LocalDateTime.now());
                    task.setProgressPercent(100.0);
                } else if (failedCount > 0 && (completedCount + cancelledCount + failedCount) == subtasks.size()) {
                    task.setStatus(TaskStatus.FAILED);
                    task.setCompletedAt(LocalDateTime.now());
                }
            }

            taskRepository.save(task);
        });
    }

    public Map<String, Object> cancelTask(String taskId) {
        Map<String, Object> result = new HashMap<>();
        result.put("taskId", taskId);

        Optional<ComputeTask> taskOpt = taskRepository.findById(taskId);
        if (!taskOpt.isPresent()) {
            result.put("status", "ERROR");
            result.put("error", "Task not found");
            result.put("acknowledged", false);
            return result;
        }

        ComputeTask task = taskOpt.get();

        if (TaskStatus.isTerminal(task.getStatus())) {
            result.put("status", task.getStatus());
            result.put("acknowledged", true);
            result.put("message", "Task already in terminal state: " + task.getStatus());
            return result;
        }

        if (TaskStatus.CANCELLING.equals(task.getStatus())) {
            result.put("status", TaskStatus.CANCELLING);
            result.put("acknowledged", true);
            result.put("message", "Cancellation already in progress");
            return result;
        }

        if (!TaskStatus.isCancellable(task.getStatus())) {
            result.put("status", "ERROR");
            result.put("error", "Task state " + task.getStatus() + " cannot be cancelled");
            result.put("acknowledged", false);
            return result;
        }

        task.setStatus(TaskStatus.CANCELLING);
        task.setCancelledAt(LocalDateTime.now());
        taskRepository.save(task);

        List<Subtask> subtasks = subtaskRepository.findByTaskId(taskId);
        int runningCount = 0;

        for (Subtask subtask : subtasks) {
            if (TaskStatus.PENDING.equals(subtask.getStatus()) || TaskStatus.QUEUED.equals(subtask.getStatus())) {
                subtask.setStatus(TaskStatus.CANCELLED);
                subtask.setCompletedAt(LocalDateTime.now());
                subtaskRepository.save(subtask);
            } else if (TaskStatus.RUNNING.equals(subtask.getStatus())) {
                subtask.setStatus(TaskStatus.CANCELLING);
                subtaskRepository.save(subtask);
                runningCount++;
                dispatchCancelToNodeAsync(subtask, task);
            } else if (TaskStatus.isTerminal(subtask.getStatus())) {
                // already done
            } else {
                subtask.setStatus(TaskStatus.CANCELLING);
                subtaskRepository.save(subtask);
                runningCount++;
                dispatchCancelToNodeAsync(subtask, task);
            }
        }

        updateTaskProgress(taskId);

        result.put("status", TaskStatus.CANCELLING);
        result.put("acknowledged", true);
        result.put("totalSubtasks", subtasks.size());
        result.put("runningSubtasksBeingCancelled", runningCount);
        result.put("message", runningCount > 0
            ? "Cancellation dispatched. Poll GET /api/tasks/" + taskId + " for final status."
            : "All subtasks were pending; cancelled immediately.");

        log.info("[{}] 取消请求已派发, 需要节点确认的子任务数: {}", taskId, runningCount);
        return result;
    }

    private void dispatchCancelToNodeAsync(Subtask subtask, ComputeTask task) {
        cancelExecutor.submit(() -> {
            Optional<ComputeNode> nodeOpt = getNodeById(subtask.getNodeId());
            if (!nodeOpt.isPresent()) {
                log.warn("[{}] 子任务 {} 关联节点不存在, 直接标记 CANCELLED",
                    task.getId(), subtask.getId());
                subtask.setStatus(TaskStatus.CANCELLED);
                subtask.setCompletedAt(LocalDateTime.now());
                subtaskRepository.save(subtask);
                updateTaskProgress(task.getId());
                return;
            }

            ComputeNode node = nodeOpt.get();
            String cancelUrl = String.format("http://%s:%d/api/compute/tasks/%s/cancel",
                node.getHostname(), node.getPort(), subtask.getId());

            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<Void> req = new HttpEntity<>(headers);

                ResponseEntity<Map> resp = fastRestTemplate.exchange(
                    cancelUrl, HttpMethod.POST, req, Map.class);

                log.info("[{}] 节点 {} 返回取消响应: {}",
                    subtask.getId(), node.getId(), resp.getStatusCode());

            } catch (ResourceAccessException e) {
                log.warn("[{}] 取消请求发送超时 node={}: {}; 不重试, 依赖定时清理卡死的 CANCELLING 状态",
                    subtask.getId(), node.getId(), e.getMessage());
            } catch (RestClientException e) {
                log.warn("[{}] 取消请求失败 node={}, HTTP 错误: {}",
                    subtask.getId(), node.getId(), e.getMessage());
            } catch (Exception e) {
                log.error("[{}] 取消请求异常 node={}", subtask.getId(), node.getId(), e);
            }
        });
    }

    private Optional<ComputeNode> getNodeById(String nodeId) {
        if (nodeId == null) return Optional.empty();
        try {
            if (nodeMonitorService != null) {
                return nodeMonitorService.getAllNodes().stream()
                    .filter(n -> nodeId.equals(n.getId())).findFirst();
            }
        } catch (Exception ignored) {}
        return Optional.empty();
    }

    @Scheduled(fixedDelay = 10000)
    public void cleanupStuckCancellingTasks() {
        List<ComputeTask> stuckTasks = taskRepository.findByStatus(TaskStatus.CANCELLING);
        LocalDateTime now = LocalDateTime.now();

        for (ComputeTask task : stuckTasks) {
            if (task.getCancelledAt() != null &&
                Duration.between(task.getCancelledAt(), now).compareTo(STUCK_CANCELLING_TIMEOUT) > 0) {

                log.warn("[{}] CANCELLING 状态超过 {}s, 强制转为 CANCELLED",
                    task.getId(), STUCK_CANCELLING_TIMEOUT.getSeconds());

                task.setStatus(TaskStatus.CANCELLED);
                if (task.getCompletedAt() == null) {
                    task.setCompletedAt(now);
                }
                task.setProgressPercent(100.0);
                taskRepository.save(task);

                List<Subtask> subtasks = subtaskRepository.findByTaskId(task.getId());
                for (Subtask s : subtasks) {
                    if (!TaskStatus.isTerminal(s.getStatus())) {
                        s.setStatus(TaskStatus.CANCELLED);
                        s.setCompletedAt(now);
                        subtaskRepository.save(s);
                    }
                }
            }
        }
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

    public Map<String, Object> getDashboardSummary() {
        Map<String, Object> result = new HashMap<>();

        List<ComputeTask> tasks = getAllTasks();
        Map<String, Object> clusterStatus = loadBalancerService.getClusterStatus();
        result.put("summary", clusterStatus);
        result.put("tasks", tasks);
        result.put("nodes", nodeMonitorService != null
            ? nodeMonitorService.getAllNodes()
            : Collections.emptyList());

        return result;
    }

    @Autowired(required = false)
    private NodeMonitorService nodeMonitorService;

    public FluidFieldResponse generateFluidField(FluidFieldRequest request) {
        List<ComputeNode> onlineNodes = nodeMonitorService != null
                ? nodeMonitorService.getOnlineNodes()
                : Collections.emptyList();

        if (onlineNodes.isEmpty()) {
            FluidFieldResponse resp = new FluidFieldResponse();
            resp.setSuccess(false);
            resp.setGridSize(request.getGridSize());
            resp.setMode(request.getMode());
            resp.setFlowType(request.getFlowType());
            return resp;
        }

        ComputeNode targetNode = onlineNodes.get(0);
        String url = String.format("http://%s:%d/api/compute/fluid/field",
                targetNode.getHostname(), targetNode.getPort());

        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("gridSize", request.getGridSize());
            payload.put("mode", request.getMode());
            payload.put("flowType", request.getFlowType());
            payload.put("matrixDimension", request.getMatrixDimension());
            if (request.getTaskId() != null) {
                payload.put("taskId", request.getTaskId());
            }

            ResponseEntity<FluidFieldResponse> resp = fastRestTemplate.postForEntity(
                    url, payload, FluidFieldResponse.class);
            return resp.getBody();

        } catch (ResourceAccessException e) {
            logger.warn("Failed to generate fluid field on node {}: {}", targetNode.getId(), e.getMessage());
            FluidFieldResponse resp = new FluidFieldResponse();
            resp.setSuccess(false);
            return resp;
        } catch (Exception e) {
            logger.error("Error generating fluid field", e);
            FluidFieldResponse resp = new FluidFieldResponse();
            resp.setSuccess(false);
            return resp;
        }
    }

    private String generateTaskId() {
        return "task-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
