<?php
require_once 'src/config.php';
require_once 'src/twig.php';

echo $twig->render('index.twig', [
	'url' => $url,
	'page' => 'Index'
]);
