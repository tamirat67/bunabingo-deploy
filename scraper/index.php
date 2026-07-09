<?php
/**
 * Telebirr Receipt Scraper - PHP Edition
 * Optimized for Instant Bot Verification
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, x-api-key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// --- 1. Simple .env Loader ---
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) < 2) continue;
        $_ENV[trim($parts[0])] = trim($parts[1]);
        putenv(trim($parts[0]) . "=" . trim($parts[1]));
    }
}
loadEnv(__DIR__ . '/.env');

// --- 2. Authentication ---
$BUNA_ENGINE_KEY = getenv('BUNA_ENGINE_KEY') ?: $_ENV['BUNA_ENGINE_KEY'] ?? '9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9';
$headers = getallheaders();
$apiKey = $headers['x-api-key'] ?? $headers['X-API-KEY'] ?? $headers['X-Api-Key'] ?? '';

if ($BUNA_ENGINE_KEY && $apiKey !== $BUNA_ENGINE_KEY) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

// --- 3. Routing (Handles /validate/ID or ?transactionId=ID or ?txnId=ID) ---
// Support both ?transactionId= and ?txnId= (the Node.js backend sends ?txnId=)
$txnId = $_GET['transactionId'] ?? $_GET['txnId'] ?? null;

// Handle path-based routing (/validate/ID)
if (!$txnId) {
    $uri = $_SERVER['REQUEST_URI'];
    if (preg_match('/\/validate\/([a-zA-Z0-9_-]+)/i', $uri, $matches)) {
        $txnId = $matches[1];
    }
}

if (!$txnId) {
    echo json_encode(['success' => true, 'status' => 'ok', 'message' => 'Buna Engine Scraper (PHP) is Live 🚀']);
    exit;
}

// --- 4. Scraper Logic ---
$result = scrapeTelebirrReceipt($txnId);

if (!$result) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'valid'   => false,
        'txnId'   => strtoupper(trim($txnId)),
        'error'   => 'Receipt not found or amount could not be parsed'
    ]);
} else {
    echo json_encode([
        'success'       => true,
        'valid'         => true,
        'status'        => 'success',
        'txnId'         => $result['transactionId'],
        'transactionId' => $result['transactionId'],
        'data'          => $result
    ]);
}

/**
 * Scrapes Telebirr receipt info from the official portal
 */
function scrapeTelebirrReceipt($transactionId) {
    $transactionId = strtoupper(trim($transactionId));
    $url = "https://transactioninfo.ethiotelecom.et/receipt/" . $transactionId;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
            'Cache-Control: no-cache',
        ],
    ]);
    $html = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    // Fallback: use file_get_contents if cURL fails
    if (!$html) {
        $options = [
            "http" => [
                "method"  => "GET",
                "header"  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n",
                "timeout" => 15
            ],
            "ssl" => [
                "verify_peer"      => false,
                "verify_peer_name" => false
            ]
        ];
        $context = stream_context_create($options);
        $html = @file_get_contents($url, false, $context);
    }

    if (!$html) return null;

    $data = [
        'transactionId' => $transactionId,
        'amount'        => '',
        'senderName'    => '',
        'receiverName'  => '',
        'receiverPhone' => '',
        'dateTime'      => '',
        'status'        => 'Success'
    ];

    // Extract Payer Name (Sender)
    if (preg_match('/Payer Name\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is', $html, $matches)) {
        $data['senderName'] = trim(strip_tags($matches[1]));
    }

    // Extract Credited Party name (Receiver)
    if (preg_match('/Credited Party name\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is', $html, $matches)) {
        $data['receiverName'] = trim(strip_tags($matches[1]));
    }

    // Extract Credited party account no (Receiver Phone)
    if (preg_match('/Credited party account no\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is', $html, $matches)) {
        $data['receiverPhone'] = trim(strip_tags($matches[1]));
    }

    // Extract Transaction details (TxId, Date, Amount)
    $detailsRegex = '/class="receipttableTd receipttableTd2">\s*([a-zA-Z0-9_-]+)\s*<\/td>\s*<td class="receipttableTd">\s*([^<]+)<\/td>\s*<td class="receipttableTd">\s*([^<]+)<\/td>/is';
    if (preg_match($detailsRegex, $html, $matches)) {
        $data['transactionId'] = trim($matches[1]);
        $data['dateTime']      = trim($matches[2]);
        $rawAmt = trim($matches[3]);
        if (preg_match('/[\d.]+/', $rawAmt, $amtMatches)) {
            $data['amount'] = $amtMatches[0];
        } else {
            $data['amount'] = $rawAmt;
        }
    }

    // Fallback: look for Total Paid Amount
    if (empty($data['amount'])) {
        if (preg_match('/Total Paid Amount\s*.*?\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is', $html, $matches)) {
            $rawAmt = trim(strip_tags($matches[1]));
            if (preg_match('/[\d.]+/', $rawAmt, $amtMatches)) {
                $data['amount'] = $amtMatches[0];
            }
        }
    }

    // Fallback: find ETB pattern anywhere in page
    if (empty($data['amount'])) {
        if (preg_match('/(?:ETB|Birr)\s*([\d,]+\.?\d{0,2})/i', $html, $amtMatches)) {
            $data['amount'] = str_replace(',', '', $amtMatches[1]);
        }
    }

    // Verify we got a valid amount
    if (empty($data['amount'])) return null;

    return $data;
}
