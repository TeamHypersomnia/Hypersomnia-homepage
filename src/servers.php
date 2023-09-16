<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

$servers = request('http://hypersomnia.xyz:8420/server_list_json');
foreach ($servers as $k => $v) {
	$servers[$k]['time_hosted_ago'] = time_elapsed(date('Y-m-d H:i:s', (int)$v['time_hosted']));
	$servers[$k]['time_last_heartbeat_ago'] = time_elapsed(date('Y-m-d H:i:s', (int)$v['time_last_heartbeat']));
}
usort($servers, fn($a, $b) => $b['num_playing'] <=> $a['num_playing']);

if (isset($address)) {
	$k = array_search($address, array_column($servers, 'ip'));
	if ($k === false) {
		header("Location: {$url}servers");
		die();
	}
	echo $twig->render('server.twig', [
		's' => $_SESSION,
		'url' => $url,
		'page' => $servers[$k]['name'] . ' - Servers',
		'sv' => $servers[$k]
	]);
	die();
}

$icons = [
	'ubuntu' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAY1BMVEVHcEziYDTfTx7gWCnfUyLfUB/fUSDfVCTeTBrtl23eThvgWSrfUyThXzLdRxHdSBT////cPADdQgLaKgDbNQD/+/frnYr64djld1zpkn3gViniaUn31cr98Orxu63oiXHYEwBKkK98AAAADnRSTlMANc5ZSdPIk+0J11LwPHo8NZgAAAFfSURBVDiNlVPZloMgDLWtaxcIiwhaq///lRNMRTg4Z87kgYfkhiQ3N0VxWFc29fNZN2VXnNnjyskY59UjC19axiNj7SWNNzwJS0Q3cbxO0sW4CHTUUTxKZlxaAMA/2DX8v+cLpaXU6xsBRvBQ5fINS2EGDIH74GOld1GnLcW11T4VoF8/g9Gbr93mpwJ6gY8CmGdEuMkSgN0QQPzICXOnSSilXR9K8DvySwUUeudtfiYUttIr8ndFuX0ljPd9p2EevY3BeelnlFqumOREYMoBDPRFgySxsYc3AxAHnRq7IHhVPLny09lhVhHZzhiCj78BnNsBNU6IJSSAPi9x2uQSNfnnmBFRg5S004SooiKqbaB6San+LotpdyzL2HhZ2bpBpevOBGMOwbxyyeFPQXIsCPt6UORFiywAi0W7i2bHiNF5UVf/OZzs9Hj7yq7zdt/ulvi5ZWFveP7VOFbp+f8AlfkzPV60sCIAAAAASUVORK5CYII=',
	'debian' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAG1BMVEUAAAC3ACXAAEDWAADWAFXNADPBAACsAFbBAIGLYPOCAAAACXRSTlMA3/+/v59/X38Ac3jtAAAAwklEQVR4AVyNQQ6CQBAEC1S4ika5Qkvw7h+4E15A8AMbX+DTTbubPVCHmUltb5pIoeu0kqGUaSG/RzoS0hB1/jCmnSKLQkr2mFVnIptiss9lo6trdZ4XrZwewefr7PRKTd3/hZxroYLe50m2M8Z1VBYlwDcJl2wYfHIckqjgifdoEeBAEYUTRccbPgELueXmMWCQbXOndodZPA6NNBNRh/NTIFFaZGLDDrHjNycHNAEmwnqYBAgqYVHEEMEwt9ENygAAJioXQs4qXOcAAAAASUVORK5CYII=',
	'centos' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAWlBMVEVHcEyhT4yhT4yhT4yhT4yhT4yhT4yhT4yhT4yhT4yhT4yhT4z////8+fqYNX+dRIfav9LgyNjvqSrwpRTTssrPg1Lizdzo2OSqY5j99+/Job743LfClLW8b3CZoxOGAAAAC3RSTlMA6snK7KNNEpI6y5ip0LsAAAExSURBVDiNjZPZkoQgDEXFlRoSsIV27fn/35wEWbS1yrlPYI7hJoSiyGplWStVV7ItbtQ16qCm+45L9SV5/l3E78bElTgk6dJ/ehx12nQ38RfA60oIn5rE8SMhsj/z6UkTwLoS8Sb9Jqf+ANODF2qNAJu19p0OaSKwYgRgsMMONASoAKxa4Q4gxUMGRf2NACpDxDzDQnHYAtCGFmryh0p7J5sdMNUii59YPxH9AoiwbEuutizqEEdkj8swcNRvPFGzRzNSCVrrme1Rfpxp4wBGvpdn4HQE3BxRHky6iU1ODrPJ6lymY8Bxx2CKZV4btS96ExqVWu1yqzlVAI6X5dJlIZWwA839dbN2oLsMjKOfJ15/TB7ty8j5TR6556F9HPvnh/P89P7xeFmtrOhuRXl6/n8+qCmYIWBNmAAAAABJRU5ErkJggg==',
	'arch' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAxZJREFUWEftls9PE0EUx78zXW0RpfVAm3jmYkgsmuBf4B/g2YMmXkwEKUTvM3M0mBSq8eZBrybixYvx6sWIZTmQoMEYYpBy0LZIWrTMMzPbBQr9sbskEhPfYU+z8z7z3vt+ZxiOOdgx58e/DkAMBIAx840UR6pAarYoyxrA1EUZKbthj/ojiNhAwdUMDJXcBQ5Eq0J0gLwr0w6ESVva0SpqFY4AUJSZGBNgDKXGXwYgIpYquDrOGcwQbhOhMpHlUYYxWgXuz8vMqZhoKgCGovSLFO6GH8ZIALdfrcjHHzdFOsZMB2zUdoCqGcaQkgwPQMRer5T13PIPvPi82SKiUgMKU9lQkgwHQMTYjKsHOHBtKIlSrYG337Z21VzTQNXOgm1OoAgHkC/KtMOt9Ork5UiYHnizaE0lrCKCAxCx5OyijsfMzJHXe/KSm/ABappQzWUDG1NwgHxRZhwu/HQE44FeamqCWCYCNkIYUzAAAksWFnTC6H43vDP7JyfsIZklpfFgiggGMD0vMwlH2GTNjLbUmilAI8mZ8OF8rFKDAtlzbwAiln7kXTo+gBnA8kSWM1/zdj5cnYj5FfEwglShJwCfnpeDCafZe6CuO9iugSi42qrCBAM2GgBNdm9Fd4Dmpsbz7YCBsNGttHlXZhy0wPY7TK2NdTanrgA8X5SDDhdmss3BzOn7OFPrd9pveO6hK39qEn3ca4VZX9UM6FKFLgDNvu5OPqGugX6H1NpY+0vnytNl+a5cswBm7ejZk1iq1NXa+IjqdEe0B2habtrZ7zIewGgqrt7cON/W76/PrchnXzZFxv5H2NZMlXPd74b2AC2ms6d8U9Jk4oRavTXcFuDq80/y5dctC+D7w2+t1ffciOr0ZDsMcEBS2xqoQKsUOIZOO3h/c1h1vmyIXX6yJFbrDazXNZIOE0YVh2S7z84OAVjZxR1hfqpoUpjs3L+e1x0R4zML4gxnVhntXk2tAMbUZxY1Gg2Fe5c6Dk7PxAcXmH0ffBCIxQSmWp9uhwGsiUR7YvcEM9eFmY59+/d0wp6bHnHBf4A/Kut0MNN4YTYAAAAASUVORK5CYII=',
	'fedora' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADfUlEQVR4AWIgFrisussPqLUcgOQIojDcsVOKbZWCMmJjZ2Lbtm3b2kFs23bOmD7bNjuvD3PquduZ2/xVy8b7+s1Dm2Q8npfcLnCS8ocTcTgv4TR4JfKSEgSfXzhROTHE7Dxs8NnfVZG1ZLrk0hY2F6ihoTImlrwAKIYX8THO7NAYGRU9BZz0EC/jVIYRS0ESOQlv7HL2dwWkR4PM7q1hsaMhw4wXJytfTRdcGljmcgl3AneHGTeo6Q1veCwtUXEaIru14mUlVF1ofQivgYJjPcTSiBu+VeCZOxjZeMZtT3L4UxA59TWYrHvuS4ZfKgZCdvsw8ubNcizX79drePQVN/ISR5OMzEySX8GxKWTbK//iYmJFoaBzokGnK9qHwcsmIJ5oKSMjk+x6G6DxKHBs/4u4tgoAxi/oPT11ea5C41LJ8S/BZCuc+rZ9BElLz/ZIVGIa9RJzvUly3Ymo+h/FNQEgQS/AL784QpUOJ513z6vA2KU/YSrcjjf+Wl4I7rb5XXlkkpUxRgLPPTyJUAXEpBQZWw+BmCsITM09TKJbD8RJ+KwRAI+IbAD/6KIAKx77kMycwNz5pphglPB2BK74aW0A+jrwIZDGRQl1AT9GauExCOBHAYwXJgdkSbNZDi499iWInPkeQs7Ba1g+gEiI9HM/Qsh5eB39HERGXNIBIGN/pDGoBpN3ZDIprJGXVYAiOguAVgHY9z4gK8VAbIDwogA08PbCOssfAXZgAsyE2p6UmqFu+tkrlux9F5BV59c+86VzVICQuNSs/9bAa8F9L50xgB8zAR46R5JcXfzJdCkAlD4IORnvYALQ1KIKilU31wTwLw2A4NqLBQDuTydUP3zjSkxDn6hkgymIQ7q9I+WZALS5ZLuXvTlNtbjkbEjH4ASj17TdiIo1+MY9muQKul6RcfOvUHX8qk2YkdPHDTnvUVcTYPFDbzUF6edDp0iy4YUv2fzSjzxXotQLSHxKOpl8w0P/6UW8GuVKaxJUN7WhsJQGYNBo9J9eVL7QNswAYBej8PhUUlgQG7RK6jcuYx/1es4GYAccdf2FnyHUK7To0F5gwLjiy0sebVBhsZuR1a/jP4dewo0QSzD4+z8aTjaJyrYOmx0rIi1xZmUgL+F06xrGcZDnpznBpRmyRJzkPpAXXf/CwjQDxtLgFQavn/R6x4tuo7rddKyOLNQ/S7s8m713xUoAAAAASUVORK5CYII='
];

echo $twig->render('servers.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Servers',
	'servers' => $servers,
	'icons' => $icons
]);
