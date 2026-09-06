package com.example.fx.backend.auth.service;

import com.example.fx.backend.auth.model.FxUser;
import com.example.fx.backend.auth.model.LoginResponse;
import com.example.fx.backend.auth.model.Region;
import com.example.fx.backend.auth.model.UserType;
import com.example.fx.backend.auth.repository.FxUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class UserService {

    @Autowired
    private FxUserRepository fxUserRepository;

    public LoginResponse login(FxUser fxUser) {
        FxUser existingUser = fxUserRepository.findById(fxUser.getUsername()).orElse(null);
        if (existingUser != null && existingUser.getPassword().equals(fxUser.getPassword())) {
            return new LoginResponse(existingUser, "Login successful");
        } else if (existingUser == null) {
            // Populate dummy values
            fxUser.setUserType(UserType.TRADER);
            fxUser.setLastLoginTimestamp(LocalDateTime.now());
            fxUser.setEmail("dummy@example.com");
            fxUser.setRegion(Region.SG);
            // Save new user to the database
            fxUserRepository.save(fxUser);
            return new LoginResponse(fxUser, "User created with dummy values");
        } else {
            return new LoginResponse(fxUser.getUsername(), "Invalid credentials", null, null, null, null);
        }
    }
}