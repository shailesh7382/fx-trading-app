package com.example.fx.backend.auth.repository;

import com.example.fx.backend.auth.model.FxUser;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FxUserRepository extends JpaRepository<FxUser, String> {
}