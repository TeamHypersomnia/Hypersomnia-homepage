<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';

if (!is_logged()) {
	header("Location: {$url}");
	die();
}

unset($_SESSION['logged']);
unset($_SESSION['id']);
unset($_SESSION['username']);
unset($_SESSION['avatar']);
unset($_SESSION['global_name']);
unset($_SESSION['admin']);

header("Location: {$url}");
