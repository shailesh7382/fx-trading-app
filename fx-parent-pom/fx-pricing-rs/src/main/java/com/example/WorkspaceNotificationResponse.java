package com.example;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class WorkspaceNotificationResponse {

    private List<WorkspaceNotification> notifications = new ArrayList<>();
    private int unreadCount;
    private LocalDateTime generatedAt;

    public List<WorkspaceNotification> getNotifications() {
        return notifications;
    }

    public void setNotifications(List<WorkspaceNotification> notifications) {
        this.notifications = notifications;
    }

    public int getUnreadCount() {
        return unreadCount;
    }

    public void setUnreadCount(int unreadCount) {
        this.unreadCount = unreadCount;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }
}

