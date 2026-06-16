package com.lab.scheduler.service;

import com.lab.scheduler.entity.ComputeTask;
import com.lab.scheduler.entity.Subtask;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class TaskSplitterService {

    public List<Subtask> splitTask(ComputeTask task, List<String> nodeIds) {
        List<Subtask> subtasks = new ArrayList<>();
        int dimension = task.getMatrixDimension();
        int splitCount = Math.min(task.getSplitCount(), nodeIds.size());
        int rowsPerSubtask = dimension / splitCount;
        int remainingRows = dimension % splitCount;
        
        int startRow = 0;
        for (int i = 0; i < splitCount; i++) {
            int endRow = startRow + rowsPerSubtask + (i < remainingRows ? 1 : 0);
            
            Subtask subtask = new Subtask();
            subtask.setId(generateSubtaskId(task.getId(), i));
            subtask.setTaskId(task.getId());
            subtask.setNodeId(nodeIds.get(i));
            subtask.setMatrixStartRow(startRow);
            subtask.setMatrixEndRow(endRow);
            subtask.setMaxIterations(task.getTotalIterations() / splitCount + 100);
            subtask.setStatus("PENDING");
            
            subtasks.add(subtask);
            startRow = endRow;
        }
        
        return subtasks;
    }

    public Map<String, Object> generateSubtaskPayload(Subtask subtask, ComputeTask task) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("subtaskId", subtask.getId());
        payload.put("taskId", subtask.getTaskId());
        payload.put("matrixStartRow", subtask.getMatrixStartRow());
        payload.put("matrixEndRow", subtask.getMatrixEndRow());
        payload.put("matrixDimension", task.getMatrixDimension());
        payload.put("physicsFormula", mapFormulaType(task.getPhysicsFormula()));
        payload.put("targetResidual", task.getTargetResidual());
        payload.put("maxIterations", subtask.getMaxIterations());
        payload.put("callbackUrl", "http://localhost:8080/api/compute/callback");
        
        return payload;
    }

    private String mapFormulaType(String formula) {
        if (formula == null) return "default";
        if (formula.contains("薛定谔") || formula.toLowerCase().contains("schrodinger")) {
            return "schrodinger";
        } else if (formula.contains("结构") || formula.toLowerCase().contains("structural")) {
            return "structural";
        } else if (formula.contains("亥姆霍兹") || formula.toLowerCase().contains("helmholtz")) {
            return "helmholtz";
        }
        return "default";
    }

    private String generateSubtaskId(String taskId, int index) {
        return "sub-" + taskId.replace("task-", "") + "-" + String.format("%04d", index);
    }
}
