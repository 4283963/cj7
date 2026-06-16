package com.lab.scheduler.repository;

import com.lab.scheduler.entity.ComputeNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NodeRepository extends JpaRepository<ComputeNode, String> {
    List<ComputeNode> findByStatusNot(String status);
    
    List<ComputeNode> findByStatusIn(List<String> statuses);
    
    @Query("SELECT n FROM ComputeNode n WHERE n.status = 'ONLINE' OR n.status = 'BUSY' ORDER BY n.cpuUsage ASC, n.memoryUsage ASC")
    List<ComputeNode> findAvailableNodesOrderByLoad();
    
    List<ComputeNode> findByLastHeartbeatBefore(LocalDateTime time);
    
    @Query("SELECT COUNT(n) FROM ComputeNode n WHERE n.status != 'OFFLINE'")
    long countOnlineNodes();
}
