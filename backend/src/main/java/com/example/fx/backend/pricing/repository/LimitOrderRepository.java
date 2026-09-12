package com.example.fx.backend.pricing.repository;

import com.example.fx.backend.pricing.model.LimitOrder;
import com.example.fx.backend.pricing.model.LimitOrderStatus;
import java.time.OffsetDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LimitOrderRepository extends JpaRepository<LimitOrder, String> {
    List<LimitOrder> findAllByOrderBySubmittedAtDesc();

    List<LimitOrder> findByStatusOrderBySubmittedAtDesc(LimitOrderStatus status);

    List<LimitOrder> findByCallbackStatusOrderBySubmittedAtDesc(String callbackStatus);

    List<LimitOrder> findByStatusAndClosedAtGreaterThanEqualAndClosedAtLessThanOrderByClosedAtAsc(
            LimitOrderStatus status, OffsetDateTime startInclusive, OffsetDateTime endExclusive);

    @Query("""
            select limitOrder from LimitOrder limitOrder
            where limitOrder.responseAt < :endOffset
              and (limitOrder.status = :activeStatus or limitOrder.closedAt >= :endOffset)
            order by limitOrder.responseAt asc
            """)
    List<LimitOrder> findLiveAtEndOfDay(@Param("endOffset") OffsetDateTime endOffset,
                                        @Param("activeStatus") LimitOrderStatus activeStatus);
}
