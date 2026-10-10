<?php
// POST {solved: [levelId], drafts: {levelId: code}} — merge progress made while
// signed out into the account, then return the merged state. Server drafts win
// over local ones so a fresh browser never overwrites work saved elsewhere.
declare(strict_types=1);
require __DIR__ . '/lib.php';

allow('POST');
$user = require_user();
$in = body();
$solved = is_array($in['solved'] ?? null) ? array_slice($in['solved'], 0, 500) : [];
$drafts = is_array($in['drafts'] ?? null) ? array_slice($in['drafts'], 0, 500, true) : [];

$pdo = db();
$pdo->beginTransaction();
foreach ($solved as $id) {
    upsert_progress($user['id'], level_id($id), true, 0);
}
foreach ($drafts as $id => $code) {
    upsert_draft($user['id'], level_id((string) $id), code_text($code), false);
}
$pdo->commit();

respond(progress_payload($user['id']));
