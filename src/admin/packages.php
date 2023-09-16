<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

$packages = [];
$require = get_json('composer.json')['require'];
$composer = get_json('composer.lock');
foreach ($composer['packages'] as $k => $v) {
	$name = $v['name'];
	if (!isset($require[$name])) {
		continue;
	}
	$d = request("https://repo.packagist.org/p2/{$name}.json");
	$packages[] = [
		'name' => $name,
		'version' => $v['version'],
		'url' => $d['packages'][$name][0]['source']['url'],
		'latest' => $d['packages'][$name][0]['version']
	];
}

echo $twig->render('admin/packages.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Packages',
	'packages' => $packages
]);
