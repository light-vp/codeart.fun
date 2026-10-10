<?php
// Database settings for the API. Copy this file and fill in the details from
// hPanel → Databases → MySQL Databases. Save the copy as, in order of preference:
//   1. codeart-config.php in the folder ABOVE public_html
//      (e.g. domains/codeart.fun/codeart-config.php). No URL can reach it there.
//   2. api/config.php, inside the site. This works too; api/.htaccess blocks it.
// Never commit the copy: both names are git-ignored.
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
