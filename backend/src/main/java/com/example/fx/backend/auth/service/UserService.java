package com.example.fx.backend.auth.service;

import com.example.fx.backend.auth.model.FxUser;
import com.example.fx.backend.auth.model.LoginResponse;
import com.example.fx.backend.auth.model.Region;
import com.example.fx.backend.auth.model.UserLoginEvent;
import com.example.fx.backend.auth.model.UserType;
import com.example.fx.backend.auth.repository.FxUserRepository;
import com.example.fx.backend.auth.repository.UserLoginEventRepository;
import com.example.fx.backend.reporting.DailyReportProperties;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
    private final FxUserRepository fxUserRepository;
    private final UserLoginEventRepository loginEventRepository;
    private final Clock clock;
    private final DailyReportProperties reportProperties;

    public UserService(FxUserRepository fxUserRepository, UserLoginEventRepository loginEventRepository, Clock clock,
                       DailyReportProperties reportProperties) {
        this.fxUserRepository = fxUserRepository;
        this.loginEventRepository = loginEventRepository;
        this.clock = clock;
        this.reportProperties = reportProperties;
    }

    @Transactional
    public LoginResponse login(FxUser fxUser) {
        FxUser existingUser = fxUserRepository.findById(fxUser.getUsername()).orElse(null);
        if (existingUser != null && Objects.equals(existingUser.getPassword(), fxUser.getPassword())) {
            recordSuccessfulLogin(existingUser);
            return new LoginResponse(existingUser, "Login successful");
        } else if (existingUser == null) {
            // Populate dummy values
            fxUser.setUserType(UserType.TRADER);
            fxUser.setEmail("dummy@example.com");
            fxUser.setRegion(Region.SG);
            recordSuccessfulLogin(fxUser);
            return new LoginResponse(fxUser, "User created with dummy values");
        } else {
            return new LoginResponse(fxUser.getUsername(), "Invalid credentials", null, null, null, null);
        }
    }

    private void recordSuccessfulLogin(FxUser user) {
        OffsetDateTime loggedAt = OffsetDateTime.now(clock);
        user.setLastLoginTimestamp(LocalDateTime.ofInstant(loggedAt.toInstant(), reportProperties.zoneId()));
        fxUserRepository.save(user);

        UserLoginEvent event = new UserLoginEvent();
        event.setId(UUID.randomUUID().toString());
        event.setUsername(user.getUsername());
        event.setLoggedAt(loggedAt);
        loginEventRepository.save(event);
    }
}
