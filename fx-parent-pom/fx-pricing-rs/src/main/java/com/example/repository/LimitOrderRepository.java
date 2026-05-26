package com.example.repository;

import com.example.model.LimitOrder;
import com.example.model.LimitOrderStatus;
import com.example.model.TimeInForce;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface LimitOrderRepository extends JpaRepository<LimitOrder, String> {
    List<LimitOrder> findAllByOrderBySubmittedAtDesc();

    List<LimitOrder> findByStatusOrderBySubmittedAtDesc(LimitOrderStatus status);

    List<LimitOrder> findByStatusAndCcyPairAndTenorOrderBySubmittedAtAsc(LimitOrderStatus status, String ccyPair, String tenor);

    List<LimitOrder> findByStatusAndTimeInForceAndGoodTillDateBefore(
            LimitOrderStatus status,
            TimeInForce timeInForce,
            LocalDate goodTillDate
    );
}

