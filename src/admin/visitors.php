<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (is_admin_logged() == false) {
	header("Location: {$url}admin");
	die();
}

$visitors = get_json('src/data/visitors.json');
array_multisort(array_column($visitors, 'ts'), SORT_DESC, $visitors);

foreach ($visitors as $k => $v) {
	$dt = new DateTime();
	$dt->setTimestamp($v['ts']);
	$visitors[$k]['ts'] = time_elapsed($dt->format('Y-m-d H:i:s'));
	$result = @new WhichBrowser\Parser($v['ua']);
	$visitors[$k]['result'] = $result->toString();
}

echo $twig->render('admin/visitors.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Visitors',
	'visitors' => $visitors
]);
