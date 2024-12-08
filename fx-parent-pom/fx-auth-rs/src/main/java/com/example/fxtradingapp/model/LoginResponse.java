package com.example.fxtradingapp.model;

import java.time.LocalDateTime;

public class LoginResponse {
    private String username;
    private String password;
    private UserType userType;
    private LocalDateTime lastLoginTimestamp;
    private String email;
    private Region region;
    private String message;

    // Constructor
    public LoginResponse(String username, String password, UserType userType, LocalDateTime lastLoginTimestamp, String email, Region region) {
        this.username = username;
        this.password = password;
        this.userType = userType;
        this.lastLoginTimestamp = lastLoginTimestamp;
        this.email = email;
        this.region = region;
    }

    // Constructor to create LoginResponse from FxUser
    public LoginResponse(FxUser fxUser) {
        this.username = fxUser.getUsername();
        this.password = fxUser.getPassword();
        this.userType = fxUser.getUserType();
        this.lastLoginTimestamp = fxUser.getLastLoginTimestamp();
        this.email = fxUser.getEmail();
        this.region = fxUser.getRegion();
    }

    // Constructor to create LoginResponse with username and message
    public LoginResponse(String username, String message) {
        this.username = username;
        this.message = message;
    }

    // Getters and Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public UserType getUserType() {
        return userType;
    }

    public void setUserType(UserType userType) {
        this.userType = userType;
    }

    public LocalDateTime getLastLoginTimestamp() {
        return lastLoginTimestamp;
    }

    public void setLastLoginTimestamp(LocalDateTime lastLoginTimestamp) {
        this.lastLoginTimestamp = lastLoginTimestamp;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Region getRegion() {
        return region;
    }

    public void setRegion(Region region) {
        this.region = region;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}