package com.lab.scheduler.repository;

import com.lab.scheduler.entity.Subtask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SubtaskRepository extends JpaRepository<Subtask, String> {
    List<Subtask> findByTaskId(String taskId);
    
    List<Subtask> findByNodeId(String nodeId);
    
    List<Subtask> findByTaskIdAndStatus(String taskId, String status);
    
    @Query("SELECT COUNT(s) FROM Subtask s WHERE s.taskId = ?1 AND s.status = ?2")
    long countByTaskIdAndStatus(String taskId, String status);
    
    @Query("SELECT s FROM Subtask s WHERE s.status = 'PENDING' ORDER BY s.createdAt ASC")
    List<Subtask> findPendingSubtasks();
    
    List<Subtask> findByTaskIdOrderByMatrixStartRowAsc(String taskId);
}
