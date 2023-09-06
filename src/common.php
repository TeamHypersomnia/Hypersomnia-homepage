<?php
function time_elapsed($dt, $full = false) {
	$now = new DateTime;
	$then = new DateTime($dt);
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

function request($url) {
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_USERAGENT, 'Hypersomnia-App');
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
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

function get_json($file) {
	if (file_exists($file) === false) {
		return [];
	}
	$content = file_get_contents($file);
	if ($content === false) {
		return [];
	}
	return json_decode($content, true);
}

function put_json($file, $json = []) {
	file_put_contents($file, json_encode($json));
}

function directory_size($dir) {
	$size = 0;
	$files = glob(rtrim($dir, '/') . '/*');
	if ($files === false) {
		return false;
	}
	foreach ($files as $file) {
		if (is_file($file)) {
			$size += filesize($file);
		} elseif (is_dir($file)) {
			$size += directory_size($file);
		}
	}
	return $size;
}

function format_size($size, $decimalPlaces = 0) {
	$units = array('B', 'KB', 'MB', 'GB', 'TB');
	$i = 0;
	while ($size >= 1024 && $i < 4) {
		$size /= 1024;
		$i++;
	}
	$size = round($size, $decimalPlaces);
	return $size . ' ' . $units[$i];
}
