package com.example.fx.backend.support;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * The allocation high-water mark for one identifier sequence.
 *
 * <p>This entity exists so schema generation creates the table; the counter itself is
 * bumped with plain JDBC in {@link IdBlockAllocator}, because a persistence-context
 * read-modify-write cannot give the atomicity the allocation needs.
 */
@Entity
@Table(name = "id_block_allocation")
public class IdBlockAllocation {

    /** Usually the system identifier, so each system counts independently. */
    @Id
    @Column(name = "sequence_name", length = 64, nullable = false)
    private String sequenceName;

    /** The next value not yet handed to any instance. */
    @Column(name = "next_value", nullable = false)
    private long nextValue;

    protected IdBlockAllocation() {
    }

    public IdBlockAllocation(String sequenceName, long nextValue) {
        this.sequenceName = sequenceName;
        this.nextValue = nextValue;
    }

    public String getSequenceName() {
        return sequenceName;
    }

    public long getNextValue() {
        return nextValue;
    }

    public void setNextValue(long nextValue) {
        this.nextValue = nextValue;
    }
}
