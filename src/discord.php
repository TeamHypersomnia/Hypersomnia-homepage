<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';

if (is_user_logged() == true) {
	header("Location: {$url}");
	die();
}

use Wohali\OAuth2\Client\Provider\Discord;

$provider = new Discord([
	'clientId'     => $discord_client_id,
	'clientSecret' => $discord_client_secret,
	'redirectUri'  => $discord_redirect_uri,
]);

if (!isset($_GET['code'])) {
	$options = ['scope' => ['identify']];
	$authUrl = $provider->getAuthorizationUrl($options);
	$_SESSION['oauth2state'] = $provider->getState();
	header("Location: {$authUrl}");
	die();
} elseif (empty($_GET['state']) || ($_GET['state'] !== $_SESSION['oauth2state'])) {
	// Invalid state
	unset($_SESSION['oauth2state']);
	require_once 'src/404.php';
	die();
} else {
	$token = $provider->getAccessToken('authorization_code', ['code' => $_GET['code']]);
	try {
		$user = $provider->getResourceOwner($token)->toArray();
		$id = $user['id'];
		$ts = time();

		$_SESSION['logged'] = true;
		$_SESSION['id'] = $id;
		$_SESSION['username'] = $user['username'];
		$_SESSION['avatar'] = $user['avatar'];
		$_SESSION['global_name'] = $user['global_name'];

		$users = get_json('src/data/users.json');
		$users[$id] = $users[$id] ?? [];
		$users[$id]['username'] = $user['username'];
		$users[$id]['global_name'] = $user['global_name'];
		$users[$id]['email'] = $user['email'];
		$users[$id]['last_login'] = $ts;
		$users[$id]['last_page'] = $_SERVER['REQUEST_URI'];
		$users[$id]['last_seen'] = $ts;
		$users[$id]['ip'] = $_SERVER['REMOTE_ADDR'];
		put_json('src/data/users.json', $users);

		header("Location: {$url}");
		die();
	} catch (Exception $e) {
		// Failed to get user details
		require_once 'src/404.php';
		die();
	}
}
