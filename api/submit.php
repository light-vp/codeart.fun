<?php
// POST {level_id, code, passed, total} — record a submission and update progress.
declare(strict_types=1);
require __DIR__ . '/lib.php';

allow('POST');
$user = require_user();
$in = body();
$level = level_id($in['level_id'] ?? null);
$code = code_text($in['code'] ?? null);
$passed = filter_var($in['passed'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 1000]]);
$total = filter_var($in['total'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]);
if ($passed === false || $total === false || $passed > $total) {
    fail('Invalid test counts');
}

$pdo = db();
$pdo->beginTransaction();
$pdo->prepare('INSERT INTO submissions (user_id, level_id, code, passed, total, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    ->execute([$user['id'], $level, $code, $passed, $total, now()]);
upsert_progress($user['id'], $level, $passed === $total, 1);
upsert_draft($user['id'], $level, $code);
$pdo->commit();

respond(['ok' => true, 'solved' => $passed === $total], 201);
