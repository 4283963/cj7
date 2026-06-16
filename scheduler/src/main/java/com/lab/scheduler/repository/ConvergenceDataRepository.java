package com.lab.scheduler.repository;

import com.lab.scheduler.entity.ConvergenceData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ConvergenceDataRepository extends JpaRepository<ConvergenceData, Long> {
    List<ConvergenceData> findBySubtaskIdOrderByIterationAsc(String subtaskId);
    
    @Query("SELECT cd FROM ConvergenceData cd JOIN Subtask s ON cd.subtaskId = s.id WHERE s.taskId = ?1 ORDER BY cd.iteration ASC")
    List<ConvergenceData> findByTaskIdOrderByIterationAsc(String taskId);
    
    @Query("SELECT cd FROM ConvergenceData cd JOIN Subtask s ON cd.subtaskId = s.id WHERE s.taskId = ?1 ORDER BY cd.iteration DESC, cd.timestamp DESC LIMIT 1000")
    List<ConvergenceData> findLatestByTaskId(String taskId);
}
