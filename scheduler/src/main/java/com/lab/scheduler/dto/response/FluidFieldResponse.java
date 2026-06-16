package com.lab.scheduler.dto.response;

import lombok.Data;
import java.util.List;

@Data
public class FluidFieldResponse {
    private Boolean success;
    private Integer gridSize;
    private Integer mode;
    private String flowType;
    private VelocityGridDTO velocityField;
    private String generatedAt;

    @Data
    public static class VelocityGridDTO {
        private Integer width;
        private Integer height;
        private List<Double> u;
        private List<Double> v;
        private List<Double> speed;
        private Double maxSpeed;
        private Double minSpeed;
        private Double eigenvalue;
        private Integer mode;
        private String flowType;
    }
}
