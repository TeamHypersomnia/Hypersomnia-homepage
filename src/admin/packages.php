<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

exec('composer show -l --direct --format=json', $data);
$packages = json_decode(implode('', $data), true);

echo $twig->render('admin/packages.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Packages',
	'packages' => $packages
]);
