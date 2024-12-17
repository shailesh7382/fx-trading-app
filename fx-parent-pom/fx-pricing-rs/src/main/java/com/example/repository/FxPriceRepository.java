package com.example.repository;

import com.example.Tenor;
import com.example.model.FxPrice;
import com.example.model.FxPriceId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FxPriceRepository extends JpaRepository<FxPrice, FxPriceId> {
    void deleteByCcyPairAndTenor(String ccyPair, Tenor tenor);
}