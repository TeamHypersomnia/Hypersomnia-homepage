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
	$response['error'] = "Missing required parameter.";
	die(json_encode($response));
}

$apikey = $_POST['apikey'];
$arena = $_POST['arena'];
$filename = $_POST['filename'];

$path = "$arenas_path/authorized_mappers.json";
$authorized_mappers = file_get_contents($path);
if ($authorized_mappers == false) {
	$response['error'] = "File $arenas_path/authorized_mappers.json does not exist.";
	die(json_encode($response));
}

$authorized_mappers = json_decode($authorized_mappers, true);
if (!isset($authorized_mappers[$apikey])) {
	$response['error'] = "You are not authorized to upload maps.";
	die(json_encode($response));
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
	$response['error'] = "You are not authorized to create new maps.";
	die(json_encode($response));
}

$allowed = ['json', 'png', 'jpg', 'gif', 'ogg', 'wav'];
$ext = pathinfo($_FILES['upload']['name'], PATHINFO_EXTENSION);
$ext2 = pathinfo($filename, PATHINFO_EXTENSION);
if (!in_array($ext, $allowed) || !in_array($ext2, $allowed)) {
	$response['error'] = "You are not allowed to upload this file type.";
	die(json_encode($response));
}

// To prevent the use of .. or . in file paths and avoid directory traversal attacks
$filename = str_replace('\\', '/', $filename);
$pathComponents = explode('/', $filename);
foreach ($pathComponents as $component) {
	if ($component === '.' || $component === '..') {
		$response['error'] = "Parameter `filename` is invalid.";
		die(json_encode($response));
	}
}

$desiredPath = "$arenas_path/$arena/$filename";
ensurePathExists($desiredPath);
move_uploaded_file($_FILES['upload']['tmp_name'], $desiredPath);
$response['success'] = "The file has been uploaded.";
die(json_encode($response));
