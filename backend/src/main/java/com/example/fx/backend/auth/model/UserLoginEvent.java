package com.example.fx.backend.auth.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "BKND_USER_LOGIN_EVENT")
public class UserLoginEvent {
    @Id
    private String id;
    private String username;
    private OffsetDateTime loggedAt;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public OffsetDateTime getLoggedAt() {
        return loggedAt;
    }

    public void setLoggedAt(OffsetDateTime loggedAt) {
        this.loggedAt = loggedAt;
    }
}
