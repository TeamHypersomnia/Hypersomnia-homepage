<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';

if (is_logged()) {
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
	$authUrl = $provider->getAuthorizationUrl(['scope' => ['identify']]);
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

		$_SESSION['logged'] = true;
		$_SESSION['id'] = $id;
		$_SESSION['username'] = $user['username'];
		$_SESSION['avatar'] = $user['avatar'];
		$_SESSION['global_name'] = $user['global_name'];
		$_SESSION['admin'] = in_array($id, $admins) ? true : false;

		$users = get_json('src/data/users.json');
		$users[$id] = $users[$id] ?? [];
		$users[$id]['username'] = $user['username'];
		$users[$id]['global_name'] = $user['global_name'];
		$users[$id]['last_login'] = $ts;
		$users[$id]['last_page'] = $uri;
		$users[$id]['last_seen'] = $ts;
		$users[$id]['ip'] = $ip;
		put_json('src/data/users.json', $users);

		if (isset($_SESSION['redirect'])) {
			$redirect = $_SESSION['redirect'];
			header("Location: {$redirect}");
		} else {
			header("Location: {$url}");
		}
		die();
	} catch (Exception $e) {
		// Failed to get user details
		require_once 'src/404.php';
		die();
	}
}
