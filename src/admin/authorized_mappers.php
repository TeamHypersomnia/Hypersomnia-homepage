<?php
require_once 'src/config.php';
require_once 'src/twig.php';

session_start();

if (!isset($_SESSION['admin']) || $_SESSION['admin'] == false) {
	header("Location: {$url}admin/login");
	die();
}

echo $twig->render('admin/authorized_mappers.twig', [
	'url' => $url,
	'page' => 'Authorized Mappers'
]);
