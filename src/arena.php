<?php
require_once 'src/config.php';
require_once 'src/twig.php';

if (file_exists("$arenas_path/$arena") == false) {
	header("Location: {$url}arenas");
	die();
}

echo $twig->render('arena.twig', [
	'url' => $url,
	'page' => 'Arenas',
	'arena' => $arena
]);
