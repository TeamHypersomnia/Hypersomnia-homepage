<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

echo $twig->render('cookie_policy.twig', [
	'page' => 'Cookie Policy'
]);
