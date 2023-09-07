<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (!is_logged()) {
	header("Location: {$url}");
	die();
}

echo $twig->render('profile.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Profile'
]);
