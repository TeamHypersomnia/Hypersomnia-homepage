<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

http_response_code(403);

echo $twig->render('403.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Error 403'
]);
