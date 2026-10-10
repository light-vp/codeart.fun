<?php
// GET → {progress: {levelId: {solved, attempts, solved_at}}, drafts: {levelId: code}}
declare(strict_types=1);
require __DIR__ . '/lib.php';

allow('GET');
$user = require_user();
respond(progress_payload($user['id']));
