<?php
require_once 'src/config.php';
require_once 'src/common.php';

function zip($source, $destination, $flag = '') {
	if (!extension_loaded('zip') || !file_exists($source)) {
		return false;
	}
	$zip = new ZipArchive();
	if (!$zip->open($destination, ZIPARCHIVE::CREATE)) {
		return false;
	}
	$source = str_replace('\\', '/', realpath($source));
	if($flag) {
		$flag = basename($source) . '/';
	}
	if (is_dir($source) === true) {
		$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source), RecursiveIteratorIterator::SELF_FIRST);
		$files->setFlags(RecursiveDirectoryIterator::SKIP_DOTS);
		foreach ($files as $file) {
			$file = str_replace('\\', '/', realpath($file));
			if (is_dir($file) === true) {
				$zip->addEmptyDir(str_replace($source . '/', '', $flag.$file . '/'));
			} else if (is_file($file) === true) {
				$zip->addFromString(str_replace($source . '/', '', $flag.$file), file_get_contents($file));
			}
		}
	} else if (is_file($source) === true) {
		$zip->addFromString($flag.basename($source), file_get_contents($source));
	}
	return $zip->close();
}

if (file_exists("$arenas_path/$arena") == false) {
	header("Location: {$url}arenas");
	die();
}

$json_path = "$arenas_path/$arena/$arena.json";
if (file_exists($json_path)) {
	$json = json_decode(file_get_contents($json_path), true);
	if (isset($json['meta']['version_timestamp'])) {
		$name = "$arena-" . strtotime($json['meta']['version_timestamp']);
	} else {
		$name = $arena;
	}
} else {
	$name = $arena;
}

if (file_exists("cache/$name.zip") == false) {
	zip("$arenas_path/$arena", "cache/$name.zip", true);
}

header("Content-type: application/zip"); 
header("Content-Disposition: attachment; filename=$arena.zip");
header("Content-length: " . filesize("cache/$name.zip"));
header("Pragma: no-cache"); 
header("Expires: 0"); 
readfile("cache/$name.zip");
