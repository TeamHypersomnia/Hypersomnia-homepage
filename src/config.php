<?php
if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
	// testing
	$url = 'http://localhost/Hypersomnia-homepage/';
	$cache = false;
	$arenas_path = 'C:\hypersomnia\content\arenas';
} else {
	// production
	$url = 'https://hypersomnia.xyz/';
	$cache = '/var/www/html/cache';
	$arenas_path = '/home/ubuntu/community_arenas';
}
