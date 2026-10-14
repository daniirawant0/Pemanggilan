<?php
/**
 * API Panggilan
 * Mengelola status panggilan antara pemanggil dan penerima
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-cache, no-store, must-revalidate');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/../data';
$callFile = $dataDir . '/call_status.json';
$logFile = $dataDir . '/call_log.json';

// Ensure data directory exists
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0777, true);
}

// Initialize call status file if not exists
if (!file_exists($callFile)) {
    file_put_contents($callFile, json_encode([
        'status' => 'idle', // idle, calling, answered, ended
        'caller_active' => false,
        'receiver_active' => false,
        'caller_name' => '',
        'call_start_time' => null,
        'last_updated' => time()
    ]));
}

// Initialize call log file if not exists
if (!file_exists($logFile)) {
    file_put_contents($logFile, json_encode([]));
}

/**
 * Read call status
 */
function getCallStatus($callFile) {
    $data = file_get_contents($callFile);
    return json_decode($data, true) ?: [
        'status' => 'idle',
        'caller_active' => false,
        'receiver_active' => false,
        'caller_name' => '',
        'call_start_time' => null,
        'last_updated' => time()
    ];
}

/**
 * Write call status
 */
function setCallStatus($callFile, $status) {
    $status['last_updated'] = time();
    file_put_contents($callFile, json_encode($status));
    return $status;
}

/**
 * Add to call log
 */
function addCallLog($logFile, $entry) {
    $log = json_decode(file_get_contents($logFile), true) ?: [];
    $entry['timestamp'] = date('Y-m-d H:i:s');
    $entry['id'] = uniqid();
    array_unshift($log, $entry); // Add to beginning
    
    // Keep only last 50 entries
    if (count($log) > 50) {
        $log = array_slice($log, 0, 50);
    }
    
    file_put_contents($logFile, json_encode($log));
    return $entry;
}

/**
 * Get call log
 */
function getCallLog($logFile) {
    return json_decode(file_get_contents($logFile), true) ?: [];
}

// Route handling
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    switch ($action) {
        case 'status':
            // Get current call status
            $status = getCallStatus($callFile);
            echo json_encode(['success' => true, 'data' => $status]);
            break;

        case 'call':
            // Initiate a call
            if ($method !== 'POST') {
                throw new Exception('Method not allowed', 405);
            }
            $input = json_decode(file_get_contents('php://input'), true);
            $callerName = isset($input['caller_name']) ? trim($input['caller_name']) : '';
            
            $status = getCallStatus($callFile);
            if ($status['status'] === 'calling') {
                throw new Exception('Panggilan sedang berlangsung', 409);
            }
            $status['status'] = 'calling';
            $status['call_start_time'] = time();
            $status['caller_name'] = $callerName;
            $status = setCallStatus($callFile, $status);
            
            $logMessage = $callerName ? "Panggilan dari {$callerName}" : 'Panggilan dimulai';
            addCallLog($logFile, [
                'type' => 'outgoing',
                'action' => 'call_initiated',
                'message' => $logMessage,
                'caller_name' => $callerName
            ]);
            
            echo json_encode(['success' => true, 'data' => $status, 'message' => 'Panggilan dimulai']);
            break;

        case 'cancel':
            // Cancel/end a call from caller side
            if ($method !== 'POST') {
                throw new Exception('Method not allowed', 405);
            }
            $status = getCallStatus($callFile);
            $prevStatus = $status['status'];
            $status['status'] = 'idle';
            $status['call_start_time'] = null;
            $status = setCallStatus($callFile, $status);
            
            addCallLog($logFile, [
                'type' => 'outgoing',
                'action' => 'call_cancelled',
                'message' => 'Panggilan dibatalkan oleh pemanggil'
            ]);
            
            echo json_encode(['success' => true, 'data' => $status, 'message' => 'Panggilan dibatalkan']);
            break;

        case 'answer':
            // Answer a call from receiver side
            if ($method !== 'POST') {
                throw new Exception('Method not allowed', 405);
            }
            $status = getCallStatus($callFile);
            if ($status['status'] !== 'calling') {
                throw new Exception('Tidak ada panggilan masuk', 404);
            }
            $status['status'] = 'answered';
            $status = setCallStatus($callFile, $status);
            
            addCallLog($logFile, [
                'type' => 'incoming',
                'action' => 'call_answered',
                'message' => 'Panggilan dijawab'
            ]);
            
            echo json_encode(['success' => true, 'data' => $status, 'message' => 'Panggilan dijawab']);
            break;

        case 'reject':
            // Reject a call from receiver side
            if ($method !== 'POST') {
                throw new Exception('Method not allowed', 405);
            }
            $status = getCallStatus($callFile);
            $status['status'] = 'idle';
            $status['call_start_time'] = null;
            $status = setCallStatus($callFile, $status);
            
            addCallLog($logFile, [
                'type' => 'missed',
                'action' => 'call_rejected',
                'message' => 'Panggilan ditolak oleh penerima'
            ]);
            
            echo json_encode(['success' => true, 'data' => $status, 'message' => 'Panggilan ditolak']);
            break;

        case 'end':
            // End an answered call
            if ($method !== 'POST') {
                throw new Exception('Method not allowed', 405);
            }
            $status = getCallStatus($callFile);
            $status['status'] = 'idle';
            $status['call_start_time'] = null;
            $status = setCallStatus($callFile, $status);
            
            addCallLog($logFile, [
                'type' => 'incoming',
                'action' => 'call_ended',
                'message' => 'Panggilan diakhiri'
            ]);
            
            echo json_encode(['success' => true, 'data' => $status, 'message' => 'Panggilan diakhiri']);
            break;

        case 'heartbeat':
            // Update presence
            if ($method !== 'POST') {
                throw new Exception('Method not allowed', 405);
            }
            $input = json_decode(file_get_contents('php://input'), true);
            $role = isset($input['role']) ? $input['role'] : '';
            
            $status = getCallStatus($callFile);
            if ($role === 'caller') {
                $status['caller_active'] = true;
                $status['caller_last_seen'] = time();
            } elseif ($role === 'receiver') {
                $status['receiver_active'] = true;
                $status['receiver_last_seen'] = time();
            }
            
            // Check if other party is still active (10 second timeout)
            if (isset($status['caller_last_seen']) && (time() - $status['caller_last_seen']) > 10) {
                $status['caller_active'] = false;
            }
            if (isset($status['receiver_last_seen']) && (time() - $status['receiver_last_seen']) > 10) {
                $status['receiver_active'] = false;
            }
            
            $status = setCallStatus($callFile, $status);
            echo json_encode(['success' => true, 'data' => $status]);
            break;

        case 'log':
            // Get call log
            $log = getCallLog($logFile);
            echo json_encode(['success' => true, 'data' => $log]);
            break;

        case 'reset':
            // Reset everything
            if ($method !== 'POST') {
                throw new Exception('Method not allowed', 405);
            }
            $status = [
                'status' => 'idle',
                'caller_active' => false,
                'receiver_active' => false,
                'caller_name' => '',
                'call_start_time' => null,
                'last_updated' => time()
            ];
            setCallStatus($callFile, $status);
            echo json_encode(['success' => true, 'data' => $status, 'message' => 'Status direset']);
            break;

        default:
            throw new Exception('Action tidak valid', 400);
    }
} catch (Exception $e) {
    $code = $e->getCode() ?: 500;
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
