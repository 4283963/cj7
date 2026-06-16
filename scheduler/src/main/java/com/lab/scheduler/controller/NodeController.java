package com.lab.scheduler.controller;

import com.lab.scheduler.dto.request.HeartbeatRequest;
import com.lab.scheduler.entity.ComputeNode;
import com.lab.scheduler.service.NodeMonitorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/nodes")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:3000"})
public class NodeController {

    @Autowired
    private NodeMonitorService nodeMonitorService;

    @GetMapping
    public ResponseEntity<List<ComputeNode>> getAllNodes() {
        List<ComputeNode> nodes = nodeMonitorService.getAllNodes();
        return ResponseEntity.ok(nodes);
    }

    @GetMapping("/{nodeId}")
    public ResponseEntity<ComputeNode> getNodeById(@PathVariable String nodeId) {
        return nodeMonitorService.getNodeById(nodeId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{nodeId}/heartbeat")
    public ResponseEntity<ComputeNode> receiveHeartbeat(
            @PathVariable String nodeId,
            @RequestBody HeartbeatRequest request) {
        request.setNodeId(nodeId);
        ComputeNode node = nodeMonitorService.processHeartbeat(request);
        return ResponseEntity.ok(node);
    }

    @PostMapping("/register")
    public ResponseEntity<ComputeNode> registerNode(@RequestBody ComputeNode node) {
        ComputeNode registered = nodeMonitorService.registerNode(node);
        return ResponseEntity.ok(registered);
    }

    @PostMapping("/{nodeId}/offline")
    public ResponseEntity<Map<String, String>> markNodeOffline(@PathVariable String nodeId) {
        boolean marked = nodeMonitorService.markNodeOffline(nodeId);
        if (marked) {
            return ResponseEntity.ok(Map.of("status", "offline", "nodeId", nodeId));
        }
        return ResponseEntity.notFound().build();
    }
}
