<?php
require_once 'src/config.php';

if (file_exists("$arenas_path/$arena") == false) {
	http_response_code(404);
	die();
}

$miniature_path = "$arenas_path/$arena/miniature.png";
if (file_exists($miniature_path) == false) {
	http_response_code(404);
	die();
}

header('Content-Type: image/png');
readfile($miniature_path);
