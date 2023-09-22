<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

$weapons = $memcached->get('weapons');
if (!$weapons) {
	$weapons = [
		'firearms' => get_json('src/data/firearms.json'),
		'melees' => get_json('src/data/melees.json'),
		'explosives' => get_json('src/data/explosives.json'),
		'spells' => get_json('src/data/spells.json')
	];
	$memcached->set('weapons', $weapons);
}

echo $twig->render('weapons.twig', [
	'page' => 'Weapons',
	'firearms' => $weapons['firearms'],
	'melees' => $weapons['melees'],
	'explosives' => $weapons['explosives'],
	'spells' => $weapons['spells']
]);
