<?php
require_once 'config.php';

if ($_SERVER['REMOTE_ADDR'] != '127.0.0.1') {
	die();
}

$it = new RecursiveDirectoryIterator($cache, RecursiveDirectoryIterator::SKIP_DOTS);
$files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
foreach($files as $file) {
	if ($file->isDir()) {
		rmdir($file->getRealPath());
	} else {
		unlink($file->getRealPath());
	}
}

rmdir($cache);
