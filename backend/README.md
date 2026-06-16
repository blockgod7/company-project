# Groupware Backend

Phase 1 backend scaffold for the company integrated groupware project.

## Stack

- Java 21
- Spring Boot
- Maven
- Spring Web
- Spring Data JPA
- Spring Security
- PostgreSQL
- JWT

## Package Root

`com.kjh.groupware`

## API Prefix

All APIs use `/api/v1`.

Current endpoint:

- `GET /api/v1/health`

## Database

The PostgreSQL schema baseline is stored at:

`src/main/resources/db/schema/groupware_schema.sql`

Runtime DB settings are environment-variable driven:

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`

JPA is configured with `ddl-auto: validate`; create/update database tables from the SQL schema first.

## Local Run

After Java 21 and Maven are available on PATH:

```powershell
mvn test
mvn spring-boot:run
```

Then check:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/v1/health
```

## Development Order

1. Backend scaffold and basic settings
2. PostgreSQL validation
3. JWT login using `emp`
4. Notice CRUD
5. Board CRUD
6. Attach files, notifications, and logs

Approval and PDM packages are intentionally placeholders for later phases.
