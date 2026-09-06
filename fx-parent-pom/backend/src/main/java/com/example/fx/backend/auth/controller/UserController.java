package com.example.fx.backend.auth.controller;

import com.example.fx.backend.auth.model.LoginRequest;
import com.example.fx.backend.auth.model.FxUser;
import com.example.fx.backend.auth.model.LoginResponse;
import com.example.fx.backend.auth.service.UserService;
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