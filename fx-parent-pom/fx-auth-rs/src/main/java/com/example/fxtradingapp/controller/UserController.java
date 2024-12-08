package com.example.fxtradingapp.controller;

import com.example.fxtradingapp.model.LoginRequest;
import com.example.fxtradingapp.model.FxUser;
import com.example.fxtradingapp.model.LoginResponse;
import com.example.fxtradingapp.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest loginRequest) {
        FxUser fxUser = new FxUser();
        fxUser.setUsername(loginRequest.getUsername());
        fxUser.setPassword(loginRequest.getPassword());
        return userService.login(fxUser);
    }
}