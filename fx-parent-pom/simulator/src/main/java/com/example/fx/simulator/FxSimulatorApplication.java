package com.example.fx.simulator;

import java.time.Clock;
import java.util.random.RandomGenerator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class FxSimulatorApplication {

    public static void main(String[] args) {
        SpringApplication.run(FxSimulatorApplication.class, args);
    }

    @Bean
    Clock simulatorClock() {
        return Clock.systemUTC();
    }

    @Bean
    RandomGenerator simulatorRandomGenerator() {
        return RandomGenerator.getDefault();
    }
}
