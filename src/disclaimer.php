<?php
require_once 'src/config.php';
require_once 'src/twig.php';

echo $twig->render('disclaimer.twig', [
	'url' => $url,
	'page' => 'Disclaimer'
]);