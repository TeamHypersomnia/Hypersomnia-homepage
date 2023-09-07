<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

echo $twig->render('weapons.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Weapons',
	'firearms' => get_json('src/data/firearms.json'),
	'melees' => get_json('src/data/melees.json'),
	'explosives' => get_json('src/data/explosives.json'),
	'spells' => get_json('src/data/spells.json')
]);
