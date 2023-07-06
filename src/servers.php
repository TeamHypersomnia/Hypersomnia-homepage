<?php
require_once 'src/config.php';
require_once 'src/twig.php';
require_once 'src/common.php';

$content = @file_get_contents("http://hypersomnia.xyz:8420/server_list_json");
if ($content == false) {
	$servers = false;
} else {
	$servers = json_decode($content, true);
	foreach ($servers as $key => $value) {
		$servers[$key]['time_hosted_ago'] = time_elapsed_string(date('Y-m-d H:i:s', $value['time_hosted']));
	}
	usort($servers, fn($a, $b) => $b['num_playing'] <=> $a['num_playing']);
}

if (isset($address)) {
	$key = array_search($address, array_column($servers, 'ip'));
	if (is_numeric($key)) {
		echo $twig->render('server.twig', [
			'url' => $url,
			'page' => $servers[$key]['name'] . ' - Server',
			'sv' => $servers[$key]
		]);
		exit();
	}
}

echo $twig->render('servers.twig', [
	'url' => $url,
	'page' => 'Servers',
	'servers' => $servers
]);
