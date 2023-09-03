<?php
require_once 'src/config.php';
require_once 'src/twig.php';
require_once 'src/admin/login_attempts.php';

session_start();

if (isset($_SESSION['admin']) && $_SESSION['admin'] == true) {
	header("Location: {$url}admin/visitors");
	die();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$ip = $_SERVER['REMOTE_ADDR'];
	$username = isset($_POST['username']) ? $_POST['username'] : '';
	$password = isset($_POST['password']) ? $_POST['password'] : '';

	if (isIPBlocked($ip)) {
		$error = 'You exceeded the maximum allowed number of login attempts.';
	} else {
		foreach ($admins as $key => $value) {
			if ($value['username'] == $username && $value['password'] == $password) {
				$_SESSION['admin'] = true;
				header("Location: {$url}admin/system");
				die();
			}
		}
		$error = 'You have specified an incorrect username or password.';
		logFailedLogin($ip, $username, $password);
	}
}

$error = isset($error) ? $error : '';
echo $twig->render('admin/login.twig', [
	'url' => $url,
	'page' => 'Admin Login',
	'error' => $error
]);
