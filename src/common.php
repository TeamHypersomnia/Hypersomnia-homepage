<?php
function error($v = true) {
	die(json_encode(['error' => $v]));
}

function success($v = true) {
	die(json_encode(['success' => $v]));
}

function time_elapsed($dt, $full = false) {
	$now = new DateTime;
	$then = new DateTime($dt);
	$diff = (array)$now->diff($then);
	$diff['w'] = (int)floor($diff['d'] / 7);
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
		return [];
	}
	curl_close($ch);
	return json_decode($result, true);
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

function is_admin() {
	if (!isset($_SESSION['logged'])) {
		return false;
	}
	if (!isset($_SESSION['admin'])) {
		return false;
	}
	if ($_SESSION['admin'] == false) {
		return false;
	}
	return true;
}

function is_logged() {
	if (!isset($_SESSION['logged'])) {
		return false;
	}
	if ($_SESSION['logged'] == false) {
		return false;
	}
	return true;
}

function load_arenas($arenas_path, $memcached) {
	if (!is_dir($arenas_path)) {
		return [];
	}
	$folders = array_diff(scandir($arenas_path), array('..', '.'));
	foreach ($folders as $k => $v) {
		if (!is_dir("$arenas_path/$v")) {
			continue;
		}
		$json = get_json("$arenas_path/$v/$v.json");
		$version_timestamp = $json['meta']['version_timestamp'] ?? '';
		$author = $json['about']['author'] ?? 'N/A';
		$short_description = $json['about']['short_description'] ?? 'N/A';
		$arenas[] = [
			'name' => $v,
			'version_timestamp' => $version_timestamp,
			'author' => $author,
			'short_description' => $short_description
		];
	}
	$memcached->set('arenas', $arenas);
	return $arenas;
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

function seconds_to_hhmmss($seconds) {
	$days = floor($seconds / (60 * 60 * 24));
	$hours = floor(($seconds % (60 * 60 * 24)) / (60 * 60));
	$minutes = floor(($seconds % (60 * 60)) / 60);
	$seconds = $seconds % 60;
	$formattedTime = '';
	if ($days > 0) {
		$formattedTime .= $days . ' days, ';
	}
	$formattedTime .= sprintf("%02d:%02d:%02d", $hours, $minutes, $seconds);
	return $formattedTime;
}
