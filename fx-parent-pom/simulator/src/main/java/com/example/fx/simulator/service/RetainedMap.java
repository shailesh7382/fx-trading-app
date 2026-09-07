package com.example.fx.simulator.service;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;

/** Expiry queue makes cleanup proportional to expired entries, rather than scanning the full store per request. */
final class RetainedMap<K, V> {

    private final int capacity;
    private final Map<K, V> entries = new HashMap<>();
    private final PriorityQueue<Expiry<K>> expiries = new PriorityQueue<>(Comparator.comparing(Expiry::at));
    RetainedMap(int capacity) { this.capacity = capacity; }
    int size() { return entries.size(); }
    V get(K key) { return entries.get(key); }
    void requireCapacity() {
        if (entries.size() >= capacity) throw SimulatorApiException.capacityExceeded();
    }
    void put(K key, V value, Instant expiresAt) {
        entries.put(key, value);
        expiries.add(new Expiry<>(key, expiresAt));
    }
    void replace(K key, V value) { entries.replace(key, value); }
    void remove(K key) { entries.remove(key); }
    void purge(Instant now) {
        while (!expiries.isEmpty() && !now.isBefore(expiries.peek().at())) {
            entries.remove(expiries.remove().key());
        }
    }
    List<V> values() { return List.copyOf(entries.values()); }
    private record Expiry<K>(K key, Instant at) {}
}
