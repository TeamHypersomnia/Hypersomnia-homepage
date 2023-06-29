<?php
require_once 'src/config.php';
require_once 'src/twig.php';
require_once 'src/common.php';

$servers = json_decode(file_get_contents("http://hypersomnia.xyz:8420/server_list_json"), true);

foreach ($servers as $key => $value) {
    $servers[$key]['time_hosted_ago'] = time_elapsed_string(date('Y-m-d H:i:s', $value['time_hosted']));
}

usort($servers, fn($a, $b) => $b['num_playing'] <=> $a['num_playing']);

echo $twig->render('servers.twig', [
	'url' => $url,
	'page' => 'Servers',
    'servers' => $servers
]);
