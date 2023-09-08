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
