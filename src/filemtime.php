<?php
namespace fileModificationTime;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;

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
