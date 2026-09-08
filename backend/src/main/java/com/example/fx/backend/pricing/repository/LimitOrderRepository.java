package com.example.fx.backend.pricing.repository;

import com.example.fx.backend.pricing.model.LimitOrder;
import com.example.fx.backend.pricing.model.LimitOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LimitOrderRepository extends JpaRepository<LimitOrder, String> {
    List<LimitOrder> findAllByOrderBySubmittedAtDesc();

    List<LimitOrder> findByStatusOrderBySubmittedAtDesc(LimitOrderStatus status);

    List<LimitOrder> findByCallbackStatusOrderBySubmittedAtDesc(String callbackStatus);
}
