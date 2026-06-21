CREATE TABLE IF NOT EXISTS auth_refresh_token (
    refresh_token_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    created_ip VARCHAR(100) NULL,
    created_user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_auth_refresh_token_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_token_emp ON auth_refresh_token(emp_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_token_expires ON auth_refresh_token(expires_at);
