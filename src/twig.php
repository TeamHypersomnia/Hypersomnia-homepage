<?php
use Twig\Environment;
use voku\helper\HtmlMin;

class CustomTwigEnvironment extends Environment
{
	public function render($name, $context = []): string
	{
		$html = parent::render($name, $context);
		$htmlMinifier = new HtmlMin();
		$minifiedHtml = $htmlMinifier->minify($html);
		return $minifiedHtml;
	}
}

$loader = new \Twig\Loader\FilesystemLoader('templates');
$twig = new CustomTwigEnvironment($loader, ['cache' => $cache]);
$twig->addGlobal('s', $_SESSION);
$twig->addGlobal('v', $_VERSION);

$alert = $memcached->get('alert');
if ($alert) {
	$twig->addGlobal('alert', $alert);
}

if (!is_logged()) {
	$_SESSION['redirect'] = $uri;
}
