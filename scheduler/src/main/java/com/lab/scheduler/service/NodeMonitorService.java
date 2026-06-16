package com.lab.scheduler.service;

import com.lab.scheduler.dto.request.HeartbeatRequest;
import com.lab.scheduler.entity.ComputeNode;
import com.lab.scheduler.repository.NodeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class NodeMonitorService {

    @Autowired
    private NodeRepository nodeRepository;

    private static final int HEARTBEAT_TIMEOUT_SECONDS = 30;

    public ComputeNode processHeartbeat(HeartbeatRequest request) {
        Optional<ComputeNode> nodeOpt = nodeRepository.findById(request.getNodeId());
        
        ComputeNode node;
        if (nodeOpt.isPresent()) {
            node = nodeOpt.get();
        } else {
            node = new ComputeNode();
            node.setId(request.getNodeId());
            node.setRegisteredAt(LocalDateTime.now());
        }
        
        node.setName(request.getName());
        node.setHostname(request.getHostname());
        node.setPort(request.getPort());
        node.setCpuUsage(request.getCpuUsage());
        node.setMemoryUsage(request.getMemoryUsage());
        node.setMemoryTotalGB(request.getMemoryTotalGB());
        node.setMemoryUsedGB(request.getMemoryUsedGB());
        node.setActiveTasks(request.getActiveTasks());
        node.setStatus(request.getStatus());
        node.setLastHeartbeat(LocalDateTime.now());
        
        return nodeRepository.save(node);
    }

    public ComputeNode registerNode(ComputeNode node) {
        node.setRegisteredAt(LocalDateTime.now());
        node.setLastHeartbeat(LocalDateTime.now());
        return nodeRepository.save(node);
    }

    public List<ComputeNode> getAllNodes() {
        return nodeRepository.findAll();
    }

    public Optional<ComputeNode> getNodeById(String nodeId) {
        return nodeRepository.findById(nodeId);
    }

    public List<ComputeNode> getOnlineNodes() {
        return nodeRepository.findByStatusNot("OFFLINE");
    }

    @Scheduled(fixedRate = 10000)
    public void checkNodeHealth() {
        LocalDateTime timeout = LocalDateTime.now().minusSeconds(HEARTBEAT_TIMEOUT_SECONDS);
        List<ComputeNode> deadNodes = nodeRepository.findByLastHeartbeatBefore(timeout);
        
        for (ComputeNode node : deadNodes) {
            if (!"OFFLINE".equals(node.getStatus())) {
                node.setStatus("OFFLINE");
                node.setActiveTasks(0);
                nodeRepository.save(node);
            }
        }
    }

    public boolean markNodeOffline(String nodeId) {
        return nodeRepository.findById(nodeId).map(node -> {
            node.setStatus("OFFLINE");
            node.setActiveTasks(0);
            nodeRepository.save(node);
            return true;
        }).orElse(false);
    }
}
