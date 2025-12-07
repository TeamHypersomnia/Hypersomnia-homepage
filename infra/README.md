# Ansible Infrastructure

Ansible playbooki do automatycznego deploymentu infrastruktury Hypersomnia.

## 📋 Struktura

```
ansible/
├── ansible.cfg                 # Konfiguracja Ansible
├── inventory/
│   └── production.yml          # Lista serwerów
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
        ├── hypersomnia-masterserver.service.j2
        └── hypersomnia-gameserver-pl.service.j2
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
ansible-playbook -i inventory/production.yml playbooks/site.yml \
    -e "backup_archive=../backups/hypersomnia-xyz-YYYYMMDD-HHMMSS.tar.gz"
```

### Deploy bez backupu (czysty setup)

```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/site.yml
```

### Deploy tylko homepage

```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/homepage.yml
```

### Restart serwerów

```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/restart_servers.yml

# Lub tylko masterserver:
ansible-playbook -i inventory/production.yml playbooks/restart_servers.yml --tags masterserver

# Lub tylko gameserver:
ansible-playbook -i inventory/production.yml playbooks/restart_servers.yml --tags gameserver
```

### Deploy tylko określonych tasków

```bash
# Tylko nginx
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags nginx

# Tylko masterserver
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags masterserver

# Setup (common, nodejs, certbot, nginx)
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags setup
```

## 🔧 Konfiguracja

### Zmienne globalne (`group_vars/all.yml`)

Edytuj ten plik aby zmienić:
- **Domeny**
- **Ścieżki** na serwerze
- **URL do binarki** (`hypersomnia_headless_url`) - zmień na `.io` po migracji
- **Porty** masterservera
- **Lista** official_hosts
- **Wersja** Node.js

### Inventory (`inventory/production.yml`)

Dodaj/usuń serwery tutaj. Obecnie:
- `hub.hypersomnia.io`

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
ansible-playbook -i inventory/production.yml playbooks/site.yml --check --diff
```

### Test połączenia

```bash
ansible all -i inventory/production.yml -m ping
```

### Weryfikacja po deploymencie

```bash
# SSH do serwera
ssh ubuntu@hub.hypersomnia.io

# Sprawdź serwisy
sudo systemctl status hypersomnia-masterserver
sudo systemctl status hypersomnia-gameserver-pl
pm2 status

# Sprawdź logi
sudo journalctl -u hypersomnia-masterserver -f
sudo journalctl -u hypersomnia-gameserver-pl -f
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
