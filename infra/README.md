# Fast commands

Setup a gameserver with a service from scratch:

```
ansible-playbook -i inventory/gameservers.yml playbooks/gameserver_only.yml -l nl
```

# Ansible Infrastructure

Ansible playbooki do automatycznego deploymentu infrastruktury Hypersomnia.

## 📋 Struktura

```
ansible/
├── ansible.cfg                 # Konfiguracja Ansible
├── inventory/
│   └── hypersomnia.io.yml          # Lista serwerów
├── group_vars/
│   └── all.yml                 # Zmienne globalne
└── playbooks/
    ├── site.yml                # Deploy wszystkiego
    ├── homepage.yml            # Deploy tylko homepage
    ├── restart_servers.yml     # Restart serwerów
    ├── tasks/                  # Taski (include_tasks)
    │   ├── common.yml
    │   ├── nodejs.yml
    │   ├── certbot.yml
    │   ├── nginx.yml
    │   ├── data.yml
    │   ├── homepage.yml
    │   ├── masterserver.yml
    │   └── gameserver.yml
    └── templates/              # Jinja2 templates
        ├── copy-certs.sh.j2
        ├── masterserver-config.json.j2
        ├── nginx.conf.j2
        ├── masterserver.service.j2
        └── hypersomnia.service.j2
```

## 🚀 Użycie

### Wymagania

1. **Ansible zainstalowany lokalnie:**
   ```bash
   sudo apt install ansible
   ```

2. **SSH access do serwera:**
   ```bash
   ssh ubuntu@hub.hypersomnia.io
   ```

3. **Prereq steps wykonane** (patrz: `../deploy/MANUAL_PREREQUISITES.md`):
   - Python3, nginx, certbot na serwerze
   - Certyfikaty wygenerowane

### Pierwszy Deploy (z backupem danych)

```bash
# 1. Zrób backup ze starego serwera
cd ..
./deploy/backup_from_server.sh

# 2. Deploy z backupem
cd ansible
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/site.yml \
    -e "backup_archive=../backups/hypersomnia-xyz-YYYYMMDD-HHMMSS.tar.gz"
```

### Deploy bez backupu (czysty setup)

```bash
cd ansible
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/site.yml
```

### Deploy tylko homepage

```bash
cd ansible
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/homepage.yml
```

### Restart serwerów

```bash
cd ansible
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/restart_servers.yml

# Lub tylko masterserver:
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/restart_servers.yml --tags masterserver

# Lub tylko gameserver:
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/restart_servers.yml --tags gameserver
```

### Deploy tylko określonych tasków

```bash
# Tylko nginx
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/site.yml --tags nginx

# Tylko masterserver
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/site.yml --tags masterserver

# Setup (common, nodejs, certbot, nginx)
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/site.yml --tags setup
```

## 🔧 Konfiguracja

### Zmienne globalne (`group_vars/all.yml`)

Edytuj ten plik aby zmienić:
- **Domeny**
- **Ścieżki** na serwerze
- **URL do binarki** (`hypersomnia_headless_url`) - zmień na `.io` po migracji
- **Porty** masterservera
- **Wersja** Node.js

### Inventory (`inventory/hypersomnia.io.yml`)

Dodaj/usuń serwery tutaj. Obecnie:
- `hub.hypersomnia.io`

### Oficjalne serwery (`official_servers.d`)

Każdy oficjalny serwer to jeden plik w `/var/www/app/private/official_servers.d/`:
nazwa pliku = id serwera (`de`, `pl`, `us-central`…), treść = jego `official_server_secret`.

- Dodanie serwera: `openssl rand -base64 36 | tr -d '/+=' | head -c 50 > official_servers.d/<id>` (`chmod 600`), ten sam sekret do `server_private.official_server_secret` na dedyku.
- Odebranie dostępu: `rm official_servers.d/<id>`.
- Master przeładowuje folder co minutę, strona czyta go przy każdym raporcie meczu. Restart niepotrzebny.
- Ten sekret raportuje mecze (nagłówek `apikey`) i podpisuje heartbeaty, więc master pokazuje serwer jako oficjalny.
- Na dedyku musi działać synchronizacja czasu: podpis z zegarem przesuniętym o ponad 30 s jest odrzucany.
- Jednorazowa migracja ze starej tabeli `authorized_servers`: `deploy/migrate_authorized_servers.py` (uruchomić na serwerze).

## 📝 Co Robi Ansible

### 1. Common Setup
- Update systemu
- Instalacja pakietów (curl, wget, git, ufw, fail2ban)
- Konfiguracja firewall (UFW)
- Porty dla masterservera

### 2. Node.js + PM2
- Instalacja Node.js 18 LTS
- Instalacja PM2 globalnie
- Setup PM2 startup script

### 3. Certbot
- Konfiguracja renewal hook (kopiowanie certów do `/home/ubuntu/certs`)
- Włączenie certbot.timer (auto-renewal)

### 4. Nginx
- Usunięcie default site
- Konfiguracja vhost dla `hub.hypersomnia.io`
- Proxy do PM2 (port 3000)
- Serwowanie `/builds/` i `/arenas/`

### 5. Data
- Tworzenie struktury katalogów
- Opcjonalnie: upload i rozpakowanie backupu

### 6. Homepage
- Clone repo Hypersomnia-homepage
- `npm install`
- Start/restart PM2

### 7. Masterserver
- **Download binarki** z `hypersomnia_headless_url`
- Utworzenie config.json
- Systemd service
- Start masterservera

### 8. Gameserver
- Symlink map (`/var/www/app/hosting/arenas` → `~/.config/Hypersomnia/user/downloads`)
- Systemd service
- Start gameservera

## 🧪 Testowanie

### Dry-run (sprawdź co się zmieni)

```bash
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/site.yml --check --diff
```

### Test połączenia

```bash
ansible all -i inventory/hypersomnia.io.yml -m ping
```

### Weryfikacja po deploymencie

```bash
# SSH do serwera
ssh ubuntu@hub.hypersomnia.io

# Sprawdź serwisy
sudo systemctl status masterserver
sudo systemctl status hypersomnia
pm2 status

# Sprawdź logi
sudo journalctl -u masterserver -f
sudo journalctl -u hypersomnia -f
pm2 logs app

# Sprawdź endpointy
curl https://hub.hypersomnia.io
curl http://hub.hypersomnia.io:8410/server_list_json
```

## 🔄 Workflow Migracji

1. **Prereq steps** (manual): `../deploy/MANUAL_PREREQUISITES.md`
2. **Backup**: `../deploy/backup_from_server.sh`
3. **Deploy**: `ansible-playbook site.yml -e "backup_archive=..."`
4. **Weryfikacja**: Sprawdź czy wszystko działa
5. **DNS**: Przełącz DNS na nowy serwer (jeśli potrzeba)

## 📚 Dokumentacja

- [Implementation Plan](../../.gemini/antigravity/brain/c384ae07-a17f-425f-baad-247c0a0e69f5/implementation_plan.md)
- [Manual Prerequisites](../deploy/MANUAL_PREREQUISITES.md)
- [Quick Reference](QUICK_REFERENCE.md)
