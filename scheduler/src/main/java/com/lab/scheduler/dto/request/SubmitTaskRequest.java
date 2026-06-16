package com.lab.scheduler.dto.request;

import lombok.Data;
import jakarta.validation.constraints.*;

@Data
public class SubmitTaskRequest {
    @NotBlank(message = "任务名称不能为空")
    private String name;
    
    @Min(value = 100, message = "矩阵维度最小为100")
    @Max(value = 100000, message = "矩阵维度最大为100000")
    private int matrixDimension;
    
    private String physicsFormula;
    
    @DecimalMin(value = "1e-15", message = "目标残差不能太小")
    @DecimalMax(value = "0.1", message = "目标残差不能太大")
    private double targetResidual;
    
    @Min(value = 10, message = "最小迭代次数为10")
    @Max(value = 100000, message = "最大迭代次数为100000")
    private int maxIterations;
    
    @Min(value = 1, message = "最少拆分为1个子任务")
    @Max(value = 16, message = "最多拆分为16个子任务")
    private int splitCount;
}
