<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

echo $twig->render('contact.twig', [
	'url' => $url,
	'page' => 'Contact'
]);
