<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (!is_logged()) {
	error('You are not logged in');
}

if (!isset($_POST['arena'])) {
	error('Missing query parameters');
}

$arena = $_POST['arena'];

if (!file_exists("$arenas_path/$arena")) {
	error('Arena does not exist');
}

if (!file_exists('src/data/arenas')) {
	mkdir('src/data/arenas');
}

$d = get_json("src/data/arenas/$arena.json");

if (!isset($d['likes'])) {
	$d['likes'] = [];
}

if (in_array($_SESSION['id'], $d['likes'])) {
	error('You already like this arena');
}

$d['likes'][] = $_SESSION['id'];
put_json("src/data/arenas/$arena.json", $d);
success('You liked it');
