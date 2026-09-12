WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT Dropping FX backend tables...
@@999_drop_tables.sql

PROMPT FX backend schema removed successfully.
