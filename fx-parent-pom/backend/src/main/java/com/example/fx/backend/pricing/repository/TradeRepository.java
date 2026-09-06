package com.example.fx.backend.pricing.repository;

import com.example.fx.backend.pricing.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TradeRepository extends JpaRepository<Trade, String> {
    List<Trade> findAllByOrderByBookedAtDesc();
}

