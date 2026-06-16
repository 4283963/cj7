package com.lab.scheduler.service;

import com.lab.scheduler.entity.ComputeNode;
import com.lab.scheduler.repository.NodeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class LoadBalancerService {

    @Autowired
    private NodeRepository nodeRepository;

    public ComputeNode selectBestNode() {
        List<ComputeNode> availableNodes = nodeRepository.findAvailableNodesOrderByLoad();
        if (availableNodes.isEmpty()) {
            return null;
        }
        return availableNodes.get(0);
    }

    public List<ComputeNode> selectNodes(int count) {
        List<ComputeNode> availableNodes = nodeRepository.findAvailableNodesOrderByLoad();
        if (availableNodes.isEmpty()) {
            return Collections.emptyList();
        }
        
        List<ComputeNode> selected = new ArrayList<>();
        for (int i = 0; i < count && i < availableNodes.size(); i++) {
            selected.add(availableNodes.get(i));
        }
        return selected;
    }

    public ComputeNode selectNodeByStrategy(String strategy) {
        List<ComputeNode> availableNodes = nodeRepository.findAvailableNodesOrderByLoad();
        if (availableNodes.isEmpty()) {
            return null;
        }
        
        switch (strategy.toLowerCase()) {
            case "least_loaded":
                return availableNodes.get(0);
            case "round_robin":
                Random rand = new Random();
                return availableNodes.get(rand.nextInt(availableNodes.size()));
            case "most_memory":
                return availableNodes.stream()
                    .max(Comparator.comparing(ComputeNode::getMemoryTotalGB))
                    .orElse(availableNodes.get(0));
            default:
                return availableNodes.get(0);
        }
    }

    public double getClusterAverageLoad() {
        List<ComputeNode> nodes = nodeRepository.findByStatusNot("OFFLINE");
        if (nodes.isEmpty()) return 0.0;
        
        double totalLoad = nodes.stream()
            .mapToDouble(n -> (n.getCpuUsage() + n.getMemoryUsage()) / 2.0)
            .sum();
        return totalLoad / nodes.size();
    }

    public Map<String, Object> getClusterStatus() {
        List<ComputeNode> allNodes = nodeRepository.findAll();
        long onlineCount = nodeRepository.countOnlineNodes();
        
        double avgCpu = allNodes.stream()
            .filter(n -> !"OFFLINE".equals(n.getStatus()))
            .mapToDouble(ComputeNode::getCpuUsage)
            .average()
            .orElse(0.0);
            
        double avgMemory = allNodes.stream()
            .filter(n -> !"OFFLINE".equals(n.getStatus()))
            .mapToDouble(ComputeNode::getMemoryUsage)
            .average()
            .orElse(0.0);
            
        int totalActiveTasks = allNodes.stream()
            .filter(n -> !"OFFLINE".equals(n.getStatus()))
            .mapToInt(ComputeNode::getActiveTasks)
            .sum();
            
        Map<String, Object> status = new HashMap<>();
        status.put("totalNodes", allNodes.size());
        status.put("onlineNodes", onlineCount);
        status.put("avgCpuUsage", avgCpu);
        status.put("avgMemoryUsage", avgMemory);
        status.put("totalActiveTasks", totalActiveTasks);
        
        return status;
    }
}
