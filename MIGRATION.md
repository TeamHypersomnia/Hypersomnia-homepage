# Table of contents

- [Co potrzebujemy](#co-potrzebujemy)
  - [Landing page, taka strona główna](#landing-page-taka-strona-gwna)
  - [Webowa wersja gry](#webowa-wersja-gry)
  - [Masterserver](#masterserver)
  - [Dodatkowo: serwer gry](#dodatkowo-serwer-gry)
- [Do zrobienia](#do-zrobienia)
- [Gdzie to wszystko stagować](#gdzie-to-wszystko-stagowa)
- [Oszczędności](#oszczdnoci)
- [Finishing thoughts](#finishing-thoughts)
- [Kwestia https://github.com/TeamHypersomnia/Hypersomnia-admin-shell](#kwestia-httpsgithubcomteamhypersomniahypersomnia-admin-shell)

# Co obecnie jest

- hypersomnia.xyz - strona z informacjami
        - chcemy miec pod hypersomnia.io
- hypersomnia.io - strona z webowa wersja gry
        - chcemy miec pod play.hypersomnia.io

# Co potrzebujemy

## Landing page, taka strona główna

**Migrujemy z https://hypersomnia.xyz na .io**

- https://hypersomnia.io powinien mieć dokładnie to co obecny https://hypersomnia.xyz
	- https://play.hypersomnia.io - webowa wersja gry, inny host w stanach
- Lokalizacja plików strony na serwerze: `/var/www/app/
- Nginx config: /etc/nginx/nginx.conf albo /var/www/app/nginx.conf ale już kurwa sam nie pamiętam który jest brany, i chyba ręcznie kopiowałem go tam
	- workflow linuxowy na hypersomnia-homepage tylko restartuje coś takiego
		- `pm2 restart app`

W skład landing page (huba), oprócz podstawowych informacji jak guide, bronie itp. wchodzą infrastrukturalne elementy:

### Hosting buildów

**Migrujemy z https://hypersomnia.xyz/builds/ na .io**
- Lokalizacja buildów: `/var/www/html/builds`

### Hosting map

**Migrujemy z https://hypersomnia.xyz/arenas/ na .io**
- Lokalizacja map: `/var/www/app/public/arenas`

#### UWAGA

- Oficjalny serwer [PL] (na hypersomnia.xyz) ma zasymlinkowany `~/.config/Hypersomnia/user/downloads` na `/var/www/app/public/arenas` żeby nie musiał ściągać map sam od siebie, i miał bez restartu zawsze aktualne mapy.

### Baza danych i informacje o rankedach

- SQLite
	- /var/www/app/private/mmr.db
- To wszystko co widzimy pod 
	- https://hypersomnia.xyz/leaderboards/
	- https://hypersomnia.xyz/matches
	- strony z profilami graczy
	- itp.

### Inne dane "bazodanowe"

- Autoryzowani maperzy którzy mogą wrzucać mapy
	- `/var/www/app/private/authorized_mappers.json`
- Autoryzwane serwery do raportowania rezultatów meczy
	- `/var/www/app/private/authorized_ranked_servers.json`
- Lista map ktore sa w katalogu ale nie pokazywać w katalogu w głównym menu
	- `/var/www/app/private/unplayable.json`
- Historia logowań na stronę
	- `/var/www/app/private/users.json`
- Historia odwiedzin na stronę
	- `/var/www/app/private/sessions.db`
- Adres webhooka discordowego do powiadamiania o nowej wrzuconej wersji gry
        - `~/.update_notification_webhook_url`
        - Używane w repo [Hypersomnia-admin-shell](#kwestia-httpsgithubcomteamhypersomniahypersomnia-admin-shell)
                - triggerowane tylko na manualnie odpalaną akcje updejtu przez mnie

## Webowa wersja gry

**Migracja na https://play.hypersomnia.io**

- Pliki .wasm itp: `/var/www/html`
- Nginx config: `/etc/nginx/sites-available/hypersomnia.io`

## Masterserver

**Migrujemy z https://masterserver.hypersomnia.xyz na masterserver.hypersomnia.io** (ten sam host co: hypersomnia.io)

Przedrostek ``masterserver.`` na razie przekierowuje na ten sam host co hypersomnia.xyz.

- Outputowe endpointy:
	- `/server_list_json`
		- http://masterserver.hypersomnia.xyz:8410/server_list_json
		- https://masterserver.hypersomnia.xyz:8420/server_list_json
	- `/server_list_binary`
		- http://masterserver.hypersomnia.xyz:8410/server_list_binary
		- https://masterserver.hypersomnia.xyz:8420/server_list_binary
- Inputowe endpointy:
	- Port UDP `8000`: **Signalling server**
		- Dla klientów webowych do nawiązywania bezpośrednich połączeń po webrtc
	- Port UDP `8430` po którym przychodzą pakiety od serwerów
		- Głównie heartbeaty (info o tym jaka mapa, ile graczy itp) i pomoc w odnalezieniu swojego adresu (taki STUN)
	- Ma otwarte 30 portów UDP (`8430-8459`) po tym żeby klienci mogli sprawdzić czy ich NAT jest sensytywny na porty, ale tą ilość będzie można zmniejszyć

- Jest **w tej samej binarce** co Headless Dedicated Server, odpala się tylko flagą `--masterserver`
- Obecnie serwuje pod HTTPS i HTTP...
	- Dlatego że webowe klienty umieją tylko łączyć się po https
		- `server_list_port`
	- zostawiam równoległy po http bo natywnie po http jest szybciej i wkurwiał mnie ten delay ~200 milisekund na handshake httpsowy
		- `fallback_http_server_list_port`

Umie ładować certy do https z configa, oto domyślny:
```json
    "masterserver": {
        "ip": "0.0.0.0",
        "ssl_cert_path": "",
        "ssl_private_key_path": "",
        "signalling_ssl_cert_path": "",
        "signalling_ssl_private_key_path": "",
        "server_entry_timeout_secs": 65,
        "suppress_community_server_webhooks_after_launch_for_secs": 20,
        "signalling_peer_timeout_secs": 25,
        "signalling_server_bind_address": "0.0.0.0",
        "signalling_server_port": 8000,
        "first_udp_command_port": 8430,
        "num_udp_command_ports": 30,
        "server_list_port": 8420,
        "fallback_http_server_list_port": 8410,
        "cert_pem_path": "",
        "key_pem_path": "",
        "sleep_ms": 8.0,
        "report_rtc_errors_to_webhook": true,
        "official_hosts": [
            "arena.hypersomnia.xyz",
            "arena-us.hypersomnia.xyz",
            "arena-de.hypersomnia.xyz",
            "arena-au.hypersomnia.xyz",
            "arena-ru.hypersomnia.xyz",
            "arena-ch.hypersomnia.xyz",
            "arena-fi.hypersomnia.xyz",
            "arena-nl.hypersomnia.xyz"
        ]
    },
```

Customowy config na hypersomnia.xyz:

```json
  "masterserver": {
    "ssl_cert_path": "/home/ubuntu/fullchain.pem",
    "ssl_private_key_path": "/home/ubuntu/privkey.pem",
    "signalling_ssl_cert_path": "/home/ubuntu/fullchain.pem",
    "signalling_ssl_private_key_path": "/home/ubuntu/privkey.pem",
    "report_rtc_errors_to_webhook": true,
    "official_hosts": [
        "arena.hypersomnia.xyz",
        "arena-us.hypersomnia.xyz",
        "arena-de.hypersomnia.xyz",
        "arena-au.hypersomnia.xyz",
        "arena-ru.hypersomnia.xyz",
        "arena-ch.hypersomnia.xyz",
        "arena-fi.hypersomnia.xyz",
        "arena-nl.hypersomnia.xyz",
        "fossgralnia.hypersomnia.io"
    ]
```

- Trzeba zrobić żeby umiał czytać te ścieżki do pemów bez odpalania go przez sudo.
        - tylko nie wiem jak - bo te pemy sa robione przez letsencrypt i są zaszyte w jakichś pojebanych ścieżkach. a chciałbym żeby masterserver miał dostęp do tych pemów żeby mógł przez https lecieć
- decyduje które serwery są oficjalne, dostając listę `official_hosts`
        - tu już zmieniłem wartości w configach z .xyz na .io i pododawałem dns mappingi

## Dodatkowo: serwer gry

Po prostu chcemy żeby tego samego hosta co wykorzystamy do landing page'a, wykorzystać też do hostowania samej gry, jak już masterserver jest itp to równie dobrze może lecieć też gameserver.

Obecnie zarządzam:

- Oficjalnym [PL] na adresie hypersomnia.xyz
	- Zostaje, tylko przeniesiony na tanszy vps
- Oficjalnym [US] na adresie hypersomnia.io
	- Reużywany jest ten sam vps na webowa wersje gry i na jeden serwer gry.

# Do zrobienia

- Zaktualizowanie nginxów obu stron
- Wpierdolenie wszystkiego z homepage https://github.com/TeamHypersomnia/Hypersomnia-homepage tutaj
	- konfiguracja hypersomnia.io pewnie też tutaj, już przekleilem nginxa bo to w sumie 99% chyba potrzebnych rzeczy stamtąd
- Ogarnięcie jebanych letsencryptów - zarówno hypersomnia.xyz i hypersomnia.io używają letsencrypta żeby mieć ruch https
        - trzeba wygenerować dla play.hypersomnia.io na hoście z polski

# Gdzie to wszystko stagować

Jak się za to zabrać?

**Po prostu możemy zacząć stawiać cały homepage pod hub.hypersomnia.io nie ruszając na razie hypersomnia.xyz!**
- Tam nikt nie spodziewa się że coś pod hub.hypersomnia.io już jest.

Jak już homepage działający będzie tam postawiony, to możemy wydupcyć cały hypersomnia.xyz i dodać przekierowanie.
i wtedy zmieniamy hypersomnia.io na ten sam adres co hub.hypersomnia.io a play.hypersomnia.io juz bedzie wskazywal na hypersomnia.io

# Oszczędności

- Wyjebując domenę hypersomnia.xyz zaoszczędzę kilka dych na rok
- Zamieniając VPS w polsce zaoszczędzę 4 dychy na miesiąc na ovh

# Finishing thoughts

- https://hypersomnia.xyz póki jest opłacona musi przekierowywać na https://hypersomnia.io
	- Czy da się to przekierowanie zrobić na tym samym vpsie, w jednym configu nginx?
- Czy da się zrobic żeby `hub.hypersomnia.io` i `hypersomnia.io` były pod jednym adresem IP tylko nginx wychywytał z jakiej domeny leci i wczytywał albo homepage albo webowa wersje gry?
- Wychodzi że wszystko tu wymienione chcemy mieć pod jednym IP na ten moment, żeby zaoszczędzić na vpsach.
- Fajnie jakby tak dało sie elastycznie te serwery ogarnąć żeby wpierdolić ten serwer do jakiegoś darmowego hostingu dla projektów open source.

## Kwestia https://github.com/TeamHypersomnia/Hypersomnia-admin-shell

Pewnie będzie do wyjebki i zmergowania tutaj.

To repo jest dość mocno nieaktualne już, opisuje jeszcze configi lua i jakieś pliki .discord_webhook_url

Głównie używam teraz tego do deployowania nowych wersji na steam, web i builds/, po ściągnięciu artefaktów z github actions. Inne rzeczy które na pewno chciałbym żeby stamtąd działaly jakoś łatwo albo przepisane:

- `deploy_web` do deployu nowego builda webowego
- `deploy_web_config` pewnie wyjebiemy bo to może się z CI aktualizować, to do wrzucania nowego nginx confa gdybym go zmieniał
- `servers_restart` do restartu samej listy serwerów i gameservera (obecnie [PL] bo to na tym samym hoscie)
- `set_latest_version` żeby ustawić szybko wersję jakąś inną na latest/
- `sign_and_upload_last_builds` żeby wrzucać nowe buildy nonsteamowe do builds/
- `servers_update` do wyjeby bo to restart robi

Być może to co z powyższego potrzebne, w tym samym repo tutaj?

# Tipy dla AI

Mam porobione klucze publiczne tak że mogę:

- ssh ubuntu@154.12.226.211 - obecny host hypersomnia.io, ten host będzie od teraz dostępny pod play.hypersomnia.io
  ssh ubuntu@hypersomnia.io
- ssh ubuntu@51.38.132.173 - obecny host hypersomnia.xyz
  ssh ubuntu@hypersomnia.xyz
  chyba trzeba stamtad backup wszystkich rzeczy sensownych zrobic
- ssh ubuntu@57.128.242.21 - NOWY tańszy host vps w polsce na który ma być strona pod adresem hypersomnia.io
  ssh ubuntu@hub.hypersomnia.io

hub.hypersomnia.io wskazuje na 57.128.242.21 dla testów tymczasowo, na to tez można zrobić lets encrypta

Kod strony jest tutaj, uzywa node jsa, sa instrukcje instalacji ale nie wiem czy aktualne. byc moze warto z tego zrobic docker?

## Serwisy

Dobrze byloby zrobic serwisy zarowno z servera jak i masterservera.
Hypersomnia-Headless.AppImage
