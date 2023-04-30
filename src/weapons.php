<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$firearms = json_decode(file_get_contents('src/data/all_firearms.json'), true);
$melees = json_decode(file_get_contents('src/data/all_melees.json'), true);
$explosives = json_decode(file_get_contents('src/data/all_explosives.json'), true);
$spells = json_decode(file_get_contents('src/data/all_spells.json'), true);

usort($firearms, fn($a, $b) => $a['price'] <=> $b['price']);
usort($melees, fn($a, $b) => $a['price'] <=> $b['price']);
usort($explosives, fn($a, $b) => $a['price'] <=> $b['price']);
usort($spells, fn($a, $b) => $a['price'] <=> $b['price']);

echo $twig->render('weapons.twig', [
	'url' => $url,
	'page' => 'Weapons',
	'firearms' => $firearms,
	'melees' => $melees,
	'explosives' => $explosives,
	'spells' => $spells
]);
