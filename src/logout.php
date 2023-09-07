<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';

if (!is_logged()) {
	header("Location: {$url}");
	die();
}

$_SESSION['logged'] = false;
$_SESSION['id'] = '';
$_SESSION['username'] = '';
$_SESSION['avatar'] = '';
$_SESSION['global_name'] = '';
$_SESSION['admin'] = false;
header("Location: {$url}");
