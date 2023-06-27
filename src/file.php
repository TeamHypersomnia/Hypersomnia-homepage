<?php
require_once 'src/config.php';

if (file_exists("$arenas_path/$arena") == false) {
	http_response_code(404);
	die();
}

$path = "$arenas_path/$arena/$file";
if (file_exists($path) == false) {
	http_response_code(404);
	die();
}

/*
	Allow downloading files contained in the map folder
*/
function getDirContents($dir, &$results = array()) {
	$files = scandir($dir);
	foreach ($files as $key => $value) {
		$path = realpath($dir . DIRECTORY_SEPARATOR . $value);
		if (!is_dir($path)) {
			$results[] = $path;
		} else if ($value != "." && $value != "..") {
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
	http_response_code(404);
	die();
}

header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="'.basename($path).'"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($path));
readfile($path);
