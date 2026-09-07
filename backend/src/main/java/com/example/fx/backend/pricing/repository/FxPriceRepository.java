package com.example.fx.backend.pricing.repository;

import com.example.fx.backend.pricing.model.FxPrice;
import com.example.fx.backend.pricing.model.FxPriceId;
import com.example.fx.backend.pricing.model.Tenor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FxPriceRepository extends JpaRepository<FxPrice, FxPriceId> {
    void deleteByCcyPairAndTenor(String ccyPair, Tenor tenor);

    List<FxPrice> findByCcyPairAndTenor(String ccyPair, Tenor tenor);
}