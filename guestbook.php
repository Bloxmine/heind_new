<?php
/*
 * logbook.cgi, but it's 2026: a tiny flat-file guestbook for heind.nl.
 *
 *   GET  guestbook.php                         -> { "entries": [ {name, msg, date}, ... ] }   (newest first)
 *   POST guestbook.php  {"name": "...", "msg": "...", "website": ""}  -> same, after saving
 *
 * Storage: guestbook-data/entries.json (the folder has an .htaccess that blocks direct access).
 * The folder must be writable by PHP. Messages are stored as plain text and escaped by the page.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const DATA_DIR    = __DIR__ . '/guestbook-data';
const DATA_FILE   = DATA_DIR . '/entries.json';
const RATE_FILE   = DATA_DIR . '/rate.json';
const MAX_ENTRIES = 300;   // oldest entries fall off the bottom
const SHOW        = 60;    // how many the page gets
const COOLDOWN    = 30;    // seconds between posts from the same visitor
const MAX_NAME    = 24;
const MAX_MSG     = 140;

function out(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean(string $s, int $max): string {
    $s = strip_tags($s);
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';   // no control characters / newlines
    $s = preg_replace('/\s+/u', ' ', $s) ?? '';
    return trim(function_exists('mb_substr') ? mb_substr(trim($s), 0, $max) : substr(trim($s), 0, $max));
}

function read_json(string $file): array {
    if (!is_file($file)) return [];
    $d = json_decode((string) file_get_contents($file), true);
    return is_array($d) ? $d : [];
}

if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0755, true)) {
    out(500, ['error' => 'the logbook is locked (data folder is not writable).']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    out(200, ['entries' => array_slice(read_json(DATA_FILE), 0, SHOW)]);
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    out(405, ['error' => 'method not allowed']);
}

// Only accept posts from this site.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== $host) {
    out(403, ['error' => 'that bottle came from another ocean.']);
}

$raw = (string) file_get_contents('php://input', false, null, 0, 4096);
$in  = json_decode($raw, true);
if (!is_array($in)) out(400, ['error' => 'that bottle was empty.']);

// Honeypot: humans never see this field.
if (!empty($in['website'])) out(200, ['entries' => array_slice(read_json(DATA_FILE), 0, SHOW)]);

$name = clean((string) ($in['name'] ?? ''), MAX_NAME);
$msg  = clean((string) ($in['msg'] ?? ''), MAX_MSG);
if ($name === '' || $msg === '') out(400, ['error' => 'you need a name and a message.']);
if (preg_match('~https?://|www\.~i', $name . ' ' . $msg)) out(400, ['error' => 'no links in the logbook, sorry. spam bots ruined it for everyone.']);

$fp = fopen(DATA_FILE, 'c+');
if (!$fp) out(500, ['error' => 'the logbook is locked (data file is not writable).']);
flock($fp, LOCK_EX);

// Rate limit per visitor (IP is hashed, never stored as-is).
$now   = time();
$who   = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . __FILE__);
$rate  = array_filter(read_json(RATE_FILE), fn($t) => $now - (int) $t < COOLDOWN);
if (isset($rate[$who])) {
    flock($fp, LOCK_UN); fclose($fp);
    out(429, ['error' => 'easy, sailor. one message every ' . COOLDOWN . ' seconds.']);
}
$rate[$who] = $now;
file_put_contents(RATE_FILE, json_encode($rate), LOCK_EX);

$entries = json_decode((string) stream_get_contents($fp), true);
if (!is_array($entries)) $entries = [];
array_unshift($entries, ['name' => $name, 'msg' => $msg, 'date' => gmdate('Y-m-d')]);
$entries = array_slice($entries, 0, MAX_ENTRIES);

ftruncate($fp, 0);
rewind($fp);
fwrite($fp, json_encode($entries, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
fflush($fp);
flock($fp, LOCK_UN);
fclose($fp);

out(201, ['entries' => array_slice($entries, 0, SHOW)]);
