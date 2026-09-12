WHENEVER SQLERROR EXIT SQL.SQLCODE

PROMPT Creating FX backend tables...
@@001_create_tables.sql

PROMPT Creating FX backend indexes...
@@002_create_indexes.sql

PROMPT FX backend schema installed successfully.
