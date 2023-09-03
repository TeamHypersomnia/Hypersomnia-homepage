<?php
require_once 'src/config.php';

function ensurePathExists($path) {
	$path = dirname($path);
	$directories = explode('/', $path);
	$currentPath = '';
	foreach ($directories as $directory) {
		$currentPath .= $directory . '/';
		if (!is_dir($currentPath)) {
			mkdir($currentPath, 0777);
		}
	}
}

if (!isset($_POST['apikey']) || !isset($_POST['arena']) || !isset($_POST['filename'])) {
	die(json_encode(['error' => 'Missing required parameters.']));
}

$apikey = $_POST['apikey'];
$arena = $_POST['arena'];
$filename = $_POST['filename'];

$path = $arenas_path . '/authorized_mappers.json';
$authorized_mappers = @file_get_contents($path);
if ($authorized_mappers == false) {
	die(json_encode(['error' => 'File authorized_mappers.json does not exist.']));
}

$authorized_mappers = json_decode($authorized_mappers, true);
if (!isset($authorized_mappers[$apikey])) {
	die(json_encode(['error' => 'You are not authorized to upload maps.']));
}

$allow_creating_new = false;
if (isset($authorized_mappers[$apikey]['allow_creating_new'])) {
	if ($authorized_mappers[$apikey]['allow_creating_new'] == 1) {
		$allow_creating_new = true;
	}
}

$arenas = [];
if (isset($authorized_mappers[$apikey]['maps'])) {
	$arenas = $authorized_mappers[$apikey]['maps'];
}
if ($allow_creating_new == false && in_array($arena, $arenas) == false) {
	die(json_encode(['error' => 'You are not authorized to create new maps.']));
}

$allowed = ['json', 'png', 'jpg', 'gif', 'ogg', 'wav'];
$ext = pathinfo($_FILES['upload']['name'], PATHINFO_EXTENSION);
$ext2 = pathinfo($filename, PATHINFO_EXTENSION);
if (!in_array($ext, $allowed) || !in_array($ext2, $allowed)) {
	die(json_encode(['error' => 'You are not allowed to upload this file type.']));
}

// To prevent the use of .. or . in file paths and avoid directory traversal attacks
$filename = str_replace('\\', '/', $filename);
$pathComponents = explode('/', $filename);
foreach ($pathComponents as $component) {
	if ($component === '.' || $component === '..') {
		die(json_encode(['error' => 'Parameter `filename` is invalid.']));
	}
}

$desiredPath = "$arenas_path/$arena/$filename";
ensurePathExists($desiredPath);
move_uploaded_file($_FILES['upload']['tmp_name'], $desiredPath);
die(json_encode(['success' => 'The file has been uploaded.']));
