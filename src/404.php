<?php
require_once 'src/config.php';
require_once 'src/twig.php';

echo $twig->render('404.twig', [
	'url' => $url,
	'page' => 'Error 404'
]);
