<?php
// Copy this file to config.php (same folder) and fill in the database details
// from hPanel → Databases → MySQL Databases. config.php is git-ignored.
return [
    'db' => [
        // Hostinger databases live on localhost; the name and user carry your account prefix.
        'dsn'      => 'mysql:host=localhost;dbname=u900531748_codeart;charset=utf8mb4',
        'user'     => 'u900531748_codeart',
        'password' => 'CHANGE_ME',
    ],
    // Send the session cookie over HTTPS only. Keep true in production.
    'secure_cookies' => true,
];
