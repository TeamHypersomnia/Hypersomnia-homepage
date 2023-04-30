<?php
require_once 'src/config.php';
require_once 'src/twig.php';

echo $twig->render('guide.twig', [
	'url' => $url,
	'page' => 'Guide'
]);
