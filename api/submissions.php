<?php
// GET ?level=<id> → {submissions: [{id, passed, total, created_at, code}]}, newest first.
declare(strict_types=1);
require __DIR__ . '/lib.php';

allow('GET');
$user = require_user();
$level = level_id($_GET['level'] ?? null);

$st = db()->prepare('SELECT id, passed, total, created_at, code FROM submissions
                     WHERE user_id = ? AND level_id = ? ORDER BY created_at DESC, id DESC LIMIT 20');
$st->execute([$user['id'], $level]);
$rows = array_map(static fn (array $r): array => [
    'id' => (int) $r['id'],
    'passed' => (int) $r['passed'],
    'total' => (int) $r['total'],
    'created_at' => str_replace(' ', 'T', $r['created_at']) . 'Z',
    'code' => $r['code'],
], $st->fetchAll());
respond(['submissions' => $rows]);
