<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (is_admin_logged() == true) {
	header("Location: {$url}admin/system");
	die();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
	$ip = $_SERVER['REMOTE_ADDR'];
	$username = isset($_POST['username']) ? $_POST['username'] : '';
	$password = isset($_POST['password']) ? $_POST['password'] : '';

	$login_attempts = get_json('src/data/login_attempts.json');
	$attempts = array_filter($login_attempts, function ($attempt) use ($ip) {
		return $attempt['ip'] === $ip && (time() - $attempt['ts']) <= 900;
	});

	if (count($attempts) >= 3) {
		$error = 'You exceeded the maximum allowed number of login attempts';
	} else {
		foreach ($admins as $k => $v) {
			$hash = hash('sha256', $password);
			if ((empty($v['user']) && empty($v['hash'])) || ($v['user'] == $username && $v['hash'] == $hash)) {
				$_SESSION['admin'] = true;
				$_SESSION['ip'] = $ip;
				header("Location: {$url}admin/system");
				die();
			}
		}
		$error = 'You have specified an incorrect username or password';
		$login_attempts[] = [
			'ip' => $ip,
			'ts' => time()
		];
		put_json('src/data/login_attempts.json', $login_attempts);
	}
}

echo $twig->render('admin/login.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Admin Login',
	'error' => isset($error) ? $error : ''
]);
