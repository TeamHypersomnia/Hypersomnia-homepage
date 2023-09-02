<?php
require_once 'src/config.php';
require_once 'src/twig.php';

session_start();

if (!isset($_SESSION['admin']) || $_SESSION['admin'] == false) {
	header("Location: {$url}admin/login");
	die();
}

$content = @file_get_contents('src/data/visitors.json');
if ($content == false) {
	$visitors = [];
} else {
	$visitors = json_decode($content, true);
}

echo $twig->render('admin/visitors.twig', [
	'url' => $url,
	'page' => 'Visitors',
	'visitors' => $visitors
]);
