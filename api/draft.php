<?php
// POST {level_id, code} — autosave the editor contents for a level.
declare(strict_types=1);
require __DIR__ . '/lib.php';

allow('POST');
$user = require_user();
$in = body();
upsert_draft($user['id'], level_id($in['level_id'] ?? null), code_text($in['code'] ?? null));
respond(['ok' => true]);
