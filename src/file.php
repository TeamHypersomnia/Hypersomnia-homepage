<?php
require_once('src/config.php');

if (file_exists("$arenas_path/$arena") == false) {
	require_once('src/404.php');
	die();
}

$path = "$arenas_path/$arena/$file";
if (file_exists($path) == false) {
	require_once('src/404.php');
	die();
}

// Allow downloading files contained in the map folder
function getDirContents($dir, &$results = array()) {
	$files = scandir($dir);
	foreach ($files as $k => $v) {
		$path = realpath($dir . DIRECTORY_SEPARATOR . $v);
		if (!is_dir($path)) {
			$results[] = $path;
		} else if ($v != "." && $v != "..") {
			getDirContents($path, $results);
		}
	}
	return $results;
}

$arr = getDirContents("$arenas_path/$arena");
$str = "$arenas_path/$arena";
$len = strlen($str) + 1;
for ($i=0; $i < sizeof($arr); $i++) { 
	$arr[$i] = substr($arr[$i], $len);
	$arr[$i] = str_replace('\\', '/', $arr[$i]);
}

if (in_array($file, $arr) == false) {
	require_once('src/404.php');
	die();
}

header('Cache-Control: public, max-age=3600');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="'.basename($path).'"');
header('Content-Length: ' . filesize($path));
readfile($path);
