<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';
require_once 'src/admin/permissions.php';

array_multisort(array_column($visitors, 'ts'), SORT_DESC, $visitors);
foreach ($visitors as $k => $v) {
	$visitors[$k]['ts'] = time_elapsed($dt->setTimestamp($v['ts'])->format('Y-m-d H:i:s'));
}

echo $twig->render('admin/visitors.twig', [
	'page' => 'Visitors',
	'visitors' => $visitors
]);
