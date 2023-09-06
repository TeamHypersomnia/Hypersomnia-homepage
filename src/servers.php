<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

$servers = request('http://hypersomnia.xyz:8420/server_list_json');
foreach ($servers as $k => $v) {
	$servers[$k]['time_hosted_ago'] = time_elapsed(date('Y-m-d H:i:s', $v['time_hosted']));
	$servers[$k]['time_last_heartbeat_ago'] = time_elapsed(date('Y-m-d H:i:s', $v['time_last_heartbeat']));
}
usort($servers, fn($a, $b) => $b['num_playing'] <=> $a['num_playing']);

if (isset($address)) {
	$k = array_search($address, array_column($servers, 'ip'));
	if ($k === false) {
		header("Location: {$url}servers");
		die();
	}
	echo $twig->render('server.twig', [
		'url' => $url,
		'page' => $servers[$k]['name'] . ' - Servers',
		'sv' => $servers[$k]
	]);
	die();
}

echo $twig->render('servers.twig', [
	'url' => $url,
	'page' => 'Servers',
	'servers' => $servers
]);
