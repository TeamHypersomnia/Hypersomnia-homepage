<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

http_response_code(404);

echo $twig->render('404.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Error 404'
]);
