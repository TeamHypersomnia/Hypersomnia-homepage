<?php
session_start();

$ip = $_SERVER['REMOTE_ADDR'];
$ts = time();
$dt = new DateTime();
$ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
$uri = $_SERVER['REQUEST_URI'];

$visitors = $memcached->get('visitors');
$visitors = $visitors ?? [];
$visitors[$ip] = ['ts' => $ts, 'ua' => $ua, 'uri' => $uri];
$memcached->set('visitors', $visitors);
