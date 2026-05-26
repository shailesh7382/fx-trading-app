package com.example.repository;

import com.example.model.Trade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TradeRepository extends JpaRepository<Trade, String> {
    List<Trade> findAllByOrderByBookedAtDesc();
}

