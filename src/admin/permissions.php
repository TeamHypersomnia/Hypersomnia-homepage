<?php
if (is_logged() == false) {
	require_once 'src/discord.php';
	die();
}

if (is_admin($admins) == false) {
	require_once 'src/403.php';
	die();
}
