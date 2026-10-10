<?php
// Shared bootstrap for every endpoint: config, database, session and helpers.
declare(strict_types=1);

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    http_response_code(404);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): never
{
    respond(['error' => $message], $status);
}

$configFile = getenv('CODEART_CONFIG') ?: __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fail('The server is not configured yet.', 503);
}
$CONFIG = require $configFile;

function db(): PDO
{
    static $pdo = null;
    global $CONFIG;
    if ($pdo === null) {
        try {
            $pdo = new PDO($CONFIG['db']['dsn'], $CONFIG['db']['user'] ?? null, $CONFIG['db']['password'] ?? null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            error_log('codeart db connect failed: ' . $e->getMessage());
            fail('Database unavailable, please try again shortly.', 503);
        }
        if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            $pdo->exec('PRAGMA foreign_keys = ON');
        }
    }
    return $pdo;
}

function is_mysql(): bool
{
    return db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
}

function now(): string
{
    return gmdate('Y-m-d H:i:s');
}

// ---- session ---------------------------------------------------------------
$secure = $CONFIG['secure_cookies'] ?? (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
session_name('codeart_sid');
session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30,
    'path' => '/',
    'secure' => (bool) $secure,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// ---- request helpers -------------------------------------------------------
// POSTs must carry X-CodeArt: 1. Browsers won't add a custom header to a
// cross-site request without a CORS preflight (which we never approve), so
// this blocks CSRF alongside the SameSite cookie.
function allow(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        fail('Method not allowed', 405);
    }
    if ($method === 'POST' && ($_SERVER['HTTP_X_CODEART'] ?? '') !== '1') {
        fail('Missing request header', 403);
    }
}

function body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 600000);
    $data = json_decode($raw === false || $raw === '' ? '{}' : $raw, true);
    if (!is_array($data)) {
        fail('Invalid JSON body');
    }
    return $data;
}

function current_user(): ?array
{
    $id = $_SESSION['uid'] ?? null;
    if (!$id) {
        return null;
    }
    $st = db()->prepare('SELECT id, email, display_name FROM users WHERE id = ?');
    $st->execute([$id]);
    $u = $st->fetch();
    if (!$u) {
        unset($_SESSION['uid']);
        return null;
    }
    return ['id' => (int) $u['id'], 'email' => $u['email'], 'name' => $u['display_name']];
}

function require_user(): array
{
    $user = current_user();
    if ($user === null) {
        fail('Please sign in first.', 401);
    }
    return $user;
}

function level_id(mixed $value): string
{
    if (!is_string($value) || !preg_match('/^[a-z0-9-]{1,64}$/', $value)) {
        fail('Invalid level id');
    }
    return $value;
}

function code_text(mixed $value): string
{
    if (!is_string($value)) {
        fail('Code must be a string');
    }
    if (strlen($value) > 65536) {
        fail('Code is too long (64 KB max)');
    }
    return $value;
}

function client_ip(): string
{
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
}

// ---- writes shared by several endpoints -------------------------------------
function upsert_progress(int $uid, string $level, bool $solved, int $attempts): void
{
    $t = now();
    $sql = is_mysql()
        ? 'INSERT INTO progress (user_id, level_id, solved, attempts, solved_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE attempts = attempts + VALUES(attempts),
               solved_at = COALESCE(solved_at, VALUES(solved_at)),
               solved = GREATEST(solved, VALUES(solved)),
               updated_at = VALUES(updated_at)'
        : 'INSERT INTO progress (user_id, level_id, solved, attempts, solved_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, level_id) DO UPDATE SET attempts = attempts + excluded.attempts,
               solved_at = COALESCE(solved_at, excluded.solved_at),
               solved = MAX(solved, excluded.solved),
               updated_at = excluded.updated_at';
    db()->prepare($sql)->execute([$uid, $level, $solved ? 1 : 0, $attempts, $solved ? $t : null, $t]);
}

function upsert_draft(int $uid, string $level, string $code, bool $overwrite = true): void
{
    $t = now();
    if (!$overwrite) {
        $sql = is_mysql()
            ? 'INSERT IGNORE INTO drafts (user_id, level_id, code, updated_at) VALUES (?, ?, ?, ?)'
            : 'INSERT OR IGNORE INTO drafts (user_id, level_id, code, updated_at) VALUES (?, ?, ?, ?)';
    } else {
        $sql = is_mysql()
            ? 'INSERT INTO drafts (user_id, level_id, code, updated_at) VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE code = VALUES(code), updated_at = VALUES(updated_at)'
            : 'INSERT INTO drafts (user_id, level_id, code, updated_at) VALUES (?, ?, ?, ?)
               ON CONFLICT (user_id, level_id) DO UPDATE SET code = excluded.code, updated_at = excluded.updated_at';
    }
    db()->prepare($sql)->execute([$uid, $level, $code, $t]);
}

function progress_payload(int $uid): array
{
    $progress = [];
    $st = db()->prepare('SELECT level_id, solved, attempts, solved_at FROM progress WHERE user_id = ?');
    $st->execute([$uid]);
    foreach ($st as $row) {
        $progress[$row['level_id']] = [
            'solved' => (bool) $row['solved'],
            'attempts' => (int) $row['attempts'],
            'solved_at' => $row['solved_at'],
        ];
    }
    $drafts = [];
    $st = db()->prepare('SELECT level_id, code FROM drafts WHERE user_id = ?');
    $st->execute([$uid]);
    foreach ($st as $row) {
        $drafts[$row['level_id']] = $row['code'];
    }
    return ['progress' => (object) $progress, 'drafts' => (object) $drafts];
}
