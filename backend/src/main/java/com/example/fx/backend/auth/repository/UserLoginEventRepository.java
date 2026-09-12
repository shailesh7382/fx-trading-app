package com.example.fx.backend.auth.repository;

import com.example.fx.backend.auth.model.UserLoginEvent;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserLoginEventRepository extends JpaRepository<UserLoginEvent, String> {
    List<UserLoginEvent> findByLoggedAtGreaterThanEqualAndLoggedAtLessThanOrderByLoggedAtAsc(
            OffsetDateTime startInclusive, OffsetDateTime endExclusive);
}
