# Oracle backend schema

These scripts create the five tables persisted by the backend, including the login-event audit table used
by daily reporting. They target Oracle
Database 19c or later and must be run as the application schema owner.

Install with SQL*Plus or SQLcl:

```text
sqlplus <user>/<password>@<service> @install.sql
```

The scripts run in this order:

1. `001_create_tables.sql` creates the tables, primary keys, checks, and foreign key.
2. `002_create_indexes.sql` adds indexes for the repository query paths.

For a destructive local reset, run `@uninstall.sql`, then `@install.sql`. The uninstall
script permanently drops all `BKND_` tables and their data.

Hibernate should use `spring.jpa.hibernate.ddl-auto=validate` (or `none`) with this
managed schema. Do not use `update` against production Oracle databases.
