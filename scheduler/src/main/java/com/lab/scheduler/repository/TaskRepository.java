package com.lab.scheduler.repository;

import com.lab.scheduler.entity.ComputeTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<ComputeTask, String> {
    List<ComputeTask> findByStatusIn(List<String> statuses);

    List<ComputeTask> findByStatus(String status);

    List<ComputeTask> findByStatusOrderByCreatedAtDesc(String status);

    @Query("SELECT t FROM ComputeTask t ORDER BY t.createdAt DESC")
    List<ComputeTask> findAllOrderByCreatedAtDesc();

    long countByStatus(String status);

    @Query("SELECT t FROM ComputeTask t WHERE t.status = 'PENDING' OR t.status = 'QUEUED' ORDER BY t.createdAt ASC")
    List<ComputeTask> findPendingTasks();
}
