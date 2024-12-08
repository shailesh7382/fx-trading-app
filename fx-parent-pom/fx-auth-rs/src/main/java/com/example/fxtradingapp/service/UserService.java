package com.example.fxtradingapp.service;

import com.example.fxtradingapp.model.FxUser;
import com.example.fxtradingapp.model.LoginResponse;
import com.example.fxtradingapp.model.Region;
import com.example.fxtradingapp.model.UserType;
import com.example.fxtradingapp.repository.FxUserRepository;
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
            return new LoginResponse(fxUser.getUsername(), "Login successful");
        } else if (existingUser == null) {
            // Populate dummy values
            fxUser.setUserType(UserType.TRADER );
            fxUser.setLastLoginTimestamp(LocalDateTime.now());
            fxUser.setEmail("dummy@example.com");
            fxUser.setRegion(Region.SG);
            // Save new user to the database
            fxUserRepository.save(fxUser);
            return new LoginResponse(fxUser.getUsername(), "User created with dummy values");
        } else {
            return new LoginResponse(fxUser.getUsername(), "Invalid credentials");
        }
    }
}