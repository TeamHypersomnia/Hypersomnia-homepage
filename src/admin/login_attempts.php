<?php
function logFailedLogin($ip) {
	$logFile = 'src/data/login_attempts.json';
	
	$loginAttempts = [];
	if (file_exists($logFile)) {
		$loginAttempts = json_decode(file_get_contents($logFile), true);
	}

	$loginAttempts[] = [
		'ip' => $ip,
		'ts' => time()
	];

	file_put_contents($logFile, json_encode($loginAttempts));
}

function isIPBlocked($ip) {
	$logFile = 'src/data/login_attempts.json';

	$loginAttempts = [];
	if (file_exists($logFile)) {
		$loginAttempts = json_decode(file_get_contents($logFile), true);
	}

	$failedAttempts = array_filter($loginAttempts, function ($attempt) use ($ip) {
		return $attempt['ip'] === $ip && (time() - $attempt['ts']) <= 900; // 15 min
	});

	return count($failedAttempts) >= 3;
}
