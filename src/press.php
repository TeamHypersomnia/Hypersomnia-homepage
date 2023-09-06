<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

echo $twig->render('press.twig', [
	'url' => $url,
	'page' => 'Press'
]);
