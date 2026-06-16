package com.lab.scheduler.common;

public final class TaskStatus {
    public static final String PENDING = "PENDING";
    public static final String QUEUED = "QUEUED";
    public static final String RUNNING = "RUNNING";
    public static final String CANCELLING = "CANCELLING";
    public static final String CANCELLED = "CANCELLED";
    public static final String COMPLETED = "COMPLETED";
    public static final String FAILED = "FAILED";

    private TaskStatus() {}

    public static boolean isActive(String status) {
        return PENDING.equals(status) || QUEUED.equals(status) || RUNNING.equals(status);
    }

    public static boolean isCancellable(String status) {
        return PENDING.equals(status) || QUEUED.equals(status) || RUNNING.equals(status);
    }

    public static boolean isTerminal(String status) {
        return CANCELLED.equals(status) || COMPLETED.equals(status) || FAILED.equals(status);
    }
}
