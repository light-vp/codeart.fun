-- codeart.fun — MySQL / MariaDB schema.
-- Import once in hPanel → Databases → phpMyAdmin → (your database) → Import.
-- Safe to re-run: every statement is CREATE ... IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email         VARCHAR(190) NOT NULL,
    display_name  VARCHAR(40)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL,
    last_login_at DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per (user, level): whether it's solved and how many submissions it took.
CREATE TABLE IF NOT EXISTS progress (
    user_id    INT UNSIGNED NOT NULL,
    level_id   VARCHAR(64)  NOT NULL,
    solved     TINYINT(1)   NOT NULL DEFAULT 0,
    attempts   INT UNSIGNED NOT NULL DEFAULT 0,
    solved_at  DATETIME     NULL,
    updated_at DATETIME     NOT NULL,
    PRIMARY KEY (user_id, level_id),
    CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The code currently in the editor for each level (autosaved).
CREATE TABLE IF NOT EXISTS drafts (
    user_id    INT UNSIGNED NOT NULL,
    level_id   VARCHAR(64)  NOT NULL,
    code       MEDIUMTEXT   NOT NULL,
    updated_at DATETIME     NOT NULL,
    PRIMARY KEY (user_id, level_id),
    CONSTRAINT fk_drafts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every time someone presses Submit: the code and how many tests passed.
CREATE TABLE IF NOT EXISTS submissions (
    id         BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
    user_id    INT UNSIGNED      NOT NULL,
    level_id   VARCHAR(64)       NOT NULL,
    code       MEDIUMTEXT        NOT NULL,
    passed     SMALLINT UNSIGNED NOT NULL,
    total      SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME          NOT NULL,
    PRIMARY KEY (id),
    KEY ix_submissions_user_level (user_id, level_id, created_at),
    CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Failed sign-ins, used to slow down password guessing.
CREATE TABLE IF NOT EXISTS auth_attempts (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ip         VARCHAR(45)     NOT NULL,
    email      VARCHAR(190)    NOT NULL,
    created_at DATETIME        NOT NULL,
    PRIMARY KEY (id),
    KEY ix_attempts_ip (ip, created_at),
    KEY ix_attempts_email (email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
