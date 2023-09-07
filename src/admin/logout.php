<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';

if (is_admin_logged() == false) {
	header("Location: {$url}admin");
	die();
}

$_SESSION['admin'] = false;
$_SESSION['ip'] = '';
header("Location: {$url}admin");
