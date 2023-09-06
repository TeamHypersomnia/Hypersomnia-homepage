<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

header('HTTP/1.1 404 Not Found');

echo $twig->render('404.twig', [
	'url' => $url,
	'page' => 'Error 404'
]);
