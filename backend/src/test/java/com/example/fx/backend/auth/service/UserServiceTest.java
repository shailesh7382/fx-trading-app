package com.example.fx.backend.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.fx.backend.auth.model.FxUser;
import com.example.fx.backend.auth.model.UserLoginEvent;
import com.example.fx.backend.auth.repository.FxUserRepository;
import com.example.fx.backend.auth.repository.UserLoginEventRepository;
import com.example.fx.backend.reporting.DailyReportProperties;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock FxUserRepository users;
    @Mock UserLoginEventRepository events;
    private UserService service;

    @BeforeEach
    void setUp() {
        service = new UserService(users, events,
                Clock.fixed(Instant.parse("2026-09-13T08:30:00Z"), ZoneOffset.UTC),
                new DailyReportProperties(java.time.ZoneId.of("Asia/Singapore")));
    }

    @Test
    void recordsEverySuccessfulLogin() {
        FxUser persisted = user("alice", "correct");
        when(users.findById("alice")).thenReturn(Optional.of(persisted));

        service.login(user("alice", "correct"));

        assertThat(persisted.getLastLoginTimestamp()).isEqualTo(LocalDateTime.parse("2026-09-13T16:30:00"));
        ArgumentCaptor<UserLoginEvent> event = ArgumentCaptor.forClass(UserLoginEvent.class);
        verify(events).save(event.capture());
        assertThat(event.getValue().getUsername()).isEqualTo("alice");
        assertThat(event.getValue().getLoggedAt()).isEqualTo(OffsetDateTime.parse("2026-09-13T08:30:00Z"));
    }

    @Test
    void doesNotAuditRejectedLogin() {
        when(users.findById("alice")).thenReturn(Optional.of(user("alice", "correct")));

        service.login(user("alice", "wrong"));

        verify(events, never()).save(any());
    }

    private FxUser user(String username, String password) {
        FxUser user = new FxUser();
        user.setUsername(username);
        user.setPassword(password);
        return user;
    }
}
