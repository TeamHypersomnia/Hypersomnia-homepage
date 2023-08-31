<?php
require_once 'src/config.php';
require_once 'src/twig.php';

echo $twig->render('statistics.twig', [
	'url' => $url,
	'page' => 'Statistics'
]);
