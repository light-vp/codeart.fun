<?php
// GET → {user: {id, email, name} | null}
declare(strict_types=1);
require __DIR__ . '/lib.php';

allow('GET');
respond(['user' => current_user()]);
