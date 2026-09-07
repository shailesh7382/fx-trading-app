package com.example.fx.backend.pricing.controller;

import com.example.fx.backend.pricing.dto.WorkspaceNotificationResponse;

import com.example.fx.backend.pricing.service.NotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public WorkspaceNotificationResponse getNotifications(@RequestParam(defaultValue = "12") int limit) {
        return notificationService.getNotifications(limit);
    }
}

