package com.example.fxtradingapp.repository;

import com.example.fxtradingapp.model.FxUser;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FxUserRepository extends JpaRepository<FxUser, String> {
}