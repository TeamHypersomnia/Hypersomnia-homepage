<?php
require_once 'src/config.php';
require_once 'src/twig.php';

echo $twig->render('cookie_policy.twig', [
	'url' => $url,
	'page' => 'Cookie Policy'
]);
