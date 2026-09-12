package com.example.fx.backend.support;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/** Generates compact, URL-safe identifiers without database-managed state. */
@Component
public class AlphanumericIdGenerator {
    public static final int ID_LENGTH = 12;

    private static final char[] ALPHABET =
            "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".toCharArray();

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        char[] id = new char[ID_LENGTH];
        for (int index = 0; index < id.length; index++) {
            id[index] = ALPHABET[random.nextInt(ALPHABET.length)];
        }
        return new String(id);
    }
}
