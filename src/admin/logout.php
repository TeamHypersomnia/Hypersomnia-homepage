<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

session_start();

$_SESSION['admin'] = false;
header("Location: {$url}admin");
