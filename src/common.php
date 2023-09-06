<?php
function time_elapsed($datetime, $full = false) {
	$now = new DateTime;
	$then = new DateTime($datetime);
	$diff = (array)$now->diff($then);
	$diff['w']  = floor($diff['d'] / 7);
	$diff['d'] -= $diff['w'] * 7;
	$string = array(
		'y' => 'year',
		'm' => 'month',
		'w' => 'week',
		'd' => 'day',
		'h' => 'hour',
		'i' => 'minute',
		's' => 'second'
	);
	foreach($string as $k => & $v) {
		if ($diff[$k]) {
			$v = $diff[$k] . ' ' . $v .($diff[$k] > 1 ? 's' : '');
		} else {
			unset($string[$k]);
		}
	}
	if (!$full) $string = array_slice($string, 0, 1);
	return $string ? implode(', ', $string) . ' ago' : 'just now';
}

function request($url, $headers = []) {
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_USERAGENT, 'Hypersomnia-App');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
	curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
	$result = curl_exec($ch);
	if (curl_errno($ch)) {
		print(curl_error($ch));
		return [];
	}
	curl_close($ch);
	return json_decode($result, true);
}

function cut_title($title, $maxLength) {
	if (strlen($title) <= $maxLength) {
		return $title;
	}
	$shortenedTitle = substr($title, 0, $maxLength);
	$lastDotPosition = strrpos($shortenedTitle, '.');
	if ($lastDotPosition !== false) {
		return substr($shortenedTitle, 0, $lastDotPosition + 1);
	} else {
		return $shortenedTitle . '...';
	}
}

function get_json($filename) {
	if (file_exists($filename) === false) {
		return [];
	}
	$content = file_get_contents($filename);
	if ($content === false) {
		return [];
	}
	return json_decode($content, true);
}

function put_json($filename, $json = []) {
	file_put_contents($filename, json_encode($json));
}
