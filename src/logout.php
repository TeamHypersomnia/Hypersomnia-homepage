<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';

if (is_user_logged() == false) {
	header("Location: {$url}");
	die();
}

$_SESSION['logged'] = false;
$_SESSION['id'] = '';
$_SESSION['username'] = '';
$_SESSION['avatar'] = '';
$_SESSION['global_name'] = '';
header("Location: {$url}");
