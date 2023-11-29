<?php
namespace fileModificationTime;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;
use Twig\Environment;
use voku\helper\HtmlMin;

class CustomTwigExtension extends AbstractExtension
{
	public function getFunctions()
	{
		return [
			new TwigFunction('filemtime', [$this, 'getFileModificationTime']),
		];
	}

	public function getFileModificationTime($filePath)
	{
		if (file_exists($filePath)) {
			return filemtime($filePath);
		}
		return null;
	}
}

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
$twig->addExtension(new \fileModificationTime\CustomTwigExtension());

$twig->addGlobal('s', $_SESSION);

$alert = $memcached->get('alert');
if ($alert) {
	$twig->addGlobal('alert', $alert);
}

if (!is_logged()) {
	$_SESSION['redirect'] = $uri;
}
