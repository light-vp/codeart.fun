<?php
// POST {action: "register" | "login" | "logout", ...}
declare(strict_types=1);
require __DIR__ . '/lib.php';

allow('POST');
$in = body();
$action = $in['action'] ?? '';

const MAX_FAILURES = 8;          // per email or IP ...
const FAILURE_WINDOW = 15 * 60;  // ... within this many seconds

function sign_in(int $id): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
    db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([now(), $id]);
}

function clean_email(mixed $value): string
{
    $email = strtolower(trim((string) $value));
    if (strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address.');
    }
    return $email;
}

function clean_password(mixed $value): string
{
    $password = (string) $value;
    if (strlen($password) < 8) {
        fail('Passwords need at least 8 characters.');
    }
    if (strlen($password) > 200) {
        fail('That password is too long.');
    }
    return $password;
}

switch ($action) {
    case 'register':
        $email = clean_email($in['email'] ?? '');
        $password = clean_password($in['password'] ?? '');
        $name = trim(preg_replace('/\s+/u', ' ', (string) ($in['name'] ?? '')) ?? '');
        $name = mb_substr($name !== '' ? $name : strstr($email, '@', true), 0, 40);

        $st = db()->prepare('SELECT 1 FROM users WHERE email = ?');
        $st->execute([$email]);
        if ($st->fetch()) {
            fail('An account with that email already exists — try signing in.', 409);
        }
        try {
            db()->prepare('INSERT INTO users (email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?)')
                ->execute([$email, $name, password_hash($password, PASSWORD_DEFAULT), now()]);
        } catch (PDOException $e) {
            fail('An account with that email already exists — try signing in.', 409);
        }
        sign_in((int) db()->lastInsertId());
        respond(['user' => current_user()], 201);

    case 'login':
        $email = clean_email($in['email'] ?? '');
        $password = (string) ($in['password'] ?? '');
        $since = gmdate('Y-m-d H:i:s', time() - FAILURE_WINDOW);

        $st = db()->prepare('SELECT COUNT(*) FROM auth_attempts WHERE (email = ? OR ip = ?) AND created_at > ?');
        $st->execute([$email, client_ip(), $since]);
        if ((int) $st->fetchColumn() >= MAX_FAILURES) {
            fail('Too many attempts. Please wait a few minutes and try again.', 429);
        }

        $st = db()->prepare('SELECT id, password_hash FROM users WHERE email = ?');
        $st->execute([$email]);
        $user = $st->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            db()->prepare('INSERT INTO auth_attempts (ip, email, created_at) VALUES (?, ?, ?)')->execute([client_ip(), $email, now()]);
            if (random_int(1, 50) === 1) {
                db()->prepare('DELETE FROM auth_attempts WHERE created_at < ?')->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
            }
            fail('Email or password is incorrect.', 401);
        }
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        sign_in((int) $user['id']);
        respond(['user' => current_user()]);

    case 'logout':
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Lax']);
        session_destroy();
        respond(['ok' => true]);

    default:
        fail('Unknown action');
}
