# Ansible Quick Reference

Szybka ściągawka z najważniejszymi komendami Ansible.

## 🚀 Podstawowe Komendy

### Test połączenia
```bash
cd ansible
ansible all -i inventory/production.yml -m ping
```

### Dry-run (sprawdź co się zmieni)
```bash
ansible-playbook -i inventory/production.yml playbooks/site.yml --check --diff
```

### Deploy wszystkiego
```bash
# Bez backupu
ansible-playbook -i inventory/production.yml playbooks/site.yml

# Z backupem
ansible-playbook -i inventory/production.yml playbooks/site.yml \
    -e "backup_archive=../backups/hypersomnia-xyz-20251207.tar.gz"
```

### Deploy tylko homepage
```bash
ansible-playbook -i inventory/production.yml playbooks/homepage.yml
```

### Restart serwerów
```bash
# Wszystkie
ansible-playbook -i inventory/production.yml playbooks/restart_servers.yml

# Tylko masterserver
ansible-playbook -i inventory/production.yml playbooks/restart_servers.yml --tags masterserver

# Tylko gameserver
ansible-playbook -i inventory/production.yml playbooks/restart_servers.yml --tags gameserver
```

## 🏷️ Tags

### Deploy tylko określonych ról
```bash
# Setup (common, nodejs, certbot, nginx)
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags setup

# Tylko nginx
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags nginx

# Tylko masterserver
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags masterserver

# Tylko gameserver
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags gameserver

# Tylko homepage
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags homepage
```

### Dostępne tagi
- `common` - Podstawowa konfiguracja (ufw, fail2ban)
- `nodejs` - Node.js + PM2
- `certbot` - Certbot + renewal hooks
- `nginx` - Nginx + vhosts
- `data` - Struktura katalogów + backup
- `homepage` - Homepage deployment
- `masterserver` - Masterserver + systemd
- `gameserver` - Game server + systemd
- `setup` - Wszystkie role setupowe (common, nodejs, certbot, nginx)
- `app` - Aplikacje (homepage)
- `servers` - Serwery gry (masterserver, gameserver)

## 🔧 Przydatne Komendy

### Wyświetl zmienne dla hosta
```bash
ansible-inventory -i inventory/production.yml --host hub.hypersomnia.io
```

### Wyświetl wszystkie hosty
```bash
ansible-inventory -i inventory/production.yml --list
```

### Uruchom pojedyncze zadanie (ad-hoc)
```bash
# Sprawdź uptime
ansible all -i inventory/production.yml -a "uptime"

# Sprawdź status serwisu
ansible all -i inventory/production.yml -b -m systemd -a "name=nginx state=started"

# Restart nginx
ansible all -i inventory/production.yml -b -m systemd -a "name=nginx state=restarted"
```

### Verbose mode (debugging)
```bash
# -v, -vv, -vvv, -vvvv (więcej v = więcej detali)
ansible-playbook -i inventory/production.yml playbooks/site.yml -vv
```

## 📝 Workflow

### Pierwszy deploy
```bash
# 1. Prereq steps (manual)
# Patrz: deploy/MANUAL_PREREQUISITES.md

# 2. Backup ze starego serwera
./deploy/backup_from_server.sh

# 3. Deploy z backupem
cd ansible
ansible-playbook -i inventory/production.yml playbooks/site.yml \
    -e "backup_archive=../backups/hypersomnia-xyz-YYYYMMDD.tar.gz"
```

### Update homepage
```bash
cd ansible
ansible-playbook -i inventory/production.yml playbooks/homepage.yml
```

### Update konfiguracji masterservera
```bash
# 1. Edytuj group_vars/all.yml
# 2. Deploy
cd ansible
ansible-playbook -i inventory/production.yml playbooks/site.yml --tags masterserver
```

## 🆘 Troubleshooting

### "Failed to connect to the host"
```bash
# Sprawdź SSH
ssh ubuntu@hub.hypersomnia.io

# Sprawdź inventory
cat inventory/production.yml
```

### "Permission denied"
```bash
# Upewnij się że używasz sudo (become: yes w taskach)
# Lub dodaj -b do komendy
ansible-playbook -i inventory/production.yml playbooks/site.yml -b
```

### "Module not found"
```bash
# Zainstaluj wymagane moduły
pip3 install ansible
```

### Sprawdź logi na serwerze
```bash
ssh ubuntu@hub.hypersomnia.io

# Systemd services
sudo journalctl -u hypersomnia-masterserver -f
sudo journalctl -u hypersomnia-gameserver-pl -f

# PM2
pm2 logs app

# Nginx
sudo tail -f /var/log/nginx/error.log
```
