# Manual Prerequisites - Przed Ansible

Kroki które musisz wykonać **ręcznie** zanim uruchomisz Ansible playbooki.

**Założenie:** Masz już dostęp SSH:
- `ssh ubuntu@hub.hypersomnia.io` (57.128.242.21)

---

## 🔧 Krok 1: Instalacja Ansible (na lokalnej maszynie)

```bash
# Na TWOJEJ maszynie (nie na serwerze)
sudo apt update
sudo apt install -y ansible

# Weryfikacja
ansible --version
```

---

## 🔧 Krok 2: Podstawowa Konfiguracja Serwera

**Na hub.hypersomnia.io:**

```bash
ssh ubuntu@hub.hypersomnia.io

# Update systemu i instalacja wszystkich wymaganych pakietów
sudo apt update
sudo apt upgrade -y
sudo apt install -y python3 python3-pip nginx certbot
# NOTE: do NOT install python3-certbot-nginx. Renewal uses webroot (built into
# certbot core). The nginx plugin can vanish on an OS dist-upgrade and silently
# break renewal (regression 2026-06: certs expired).

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Weryfikacja
python3 --version
sudo systemctl status nginx
curl http://localhost
```

**Dlaczego nginx teraz?** Certbot potrzebuje działającego nginx + poprawnego DNS żeby zweryfikować domenę.

---

## 🔒 Krok 3: Generowanie Certyfikatów SSL

### Na hub.hypersomnia.io

We use the **webroot** method (not the --nginx plugin). nginx must already serve
`/var/www/certbot` under `/.well-known/acme-challenge/` (defined in nginx.conf.j2),
so deploy that config via the playbook first, or create the directory manually.

```bash
ssh ubuntu@hub.hypersomnia.io

# Webroot for the ACME challenge
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo chown -R www-data:www-data /var/www/certbot

# Certyfikat dla hub.hypersomnia.io
sudo certbot certonly --webroot -w /var/www/certbot -d hub.hypersomnia.io

# Podczas pierwszego uruchomienia:
# - Podaj email (do powiadomień o wygasaniu)
# - Zaakceptuj ToS (Y)
# - Opcjonalnie: newsletter (N)

# Weryfikacja
sudo ls -la /etc/letsencrypt/live/hub.hypersomnia.io/
# Powinny być: fullchain.pem, privkey.pem
```

**Jeśli planujesz już teraz używać hypersomnia.io (bez hub):**
```bash
# Tylko jeśli DNS już wskazuje na ten serwer
sudo certbot certonly --webroot -w /var/www/certbot -d hypersomnia.io
sudo certbot certonly --webroot -w /var/www/certbot -d masterserver.hypersomnia.io
```

---

## 📋 Krok 4: Test Auto-Renewal

```bash
# Na każdym serwerze
sudo certbot renew --dry-run

# Powinno pokazać: "Congratulations, all simulated renewals succeeded"
```

---

## ✅ Checklist - Gotowość do Ansible

Przed uruchomieniem Ansible playbooka, upewnij się że:

**Na hub.hypersomnia.io:**
- [ ] Python3 zainstalowany
- [ ] Nginx zainstalowany i działa
- [ ] Certbot zainstalowany
- [ ] Certyfikat dla `hub.hypersomnia.io` wygenerowany
- [ ] Test renewal przeszedł (`certbot renew --dry-run`)

**Na lokalnej maszynie:**
- [ ] Ansible zainstalowany
- [ ] SSH działa do `hub.hypersomnia.io` bez hasła (klucze publiczne)

---

## 🚀 Co Dalej?

Po wykonaniu powyższych kroków, możesz uruchomić Ansible playbooki:

```bash
# Na lokalnej maszynie, w repo Hypersomnia-homepage
cd ansible
ansible-playbook -i inventory/hypersomnia.io.yml playbooks/site.yml
```

Ansible zajmie się:
- Instalacją Node.js, PM2
- Konfiguracją nginx (vhosts)
- Setupem certbot renewal hooks
- Deploymentem homepage
- Instalacją masterservera i gameservera (systemd)
- Konfiguracją firewall

---

## 🆘 Troubleshooting

### Certbot: "Could not bind to IPv4 or IPv6"
```bash
# Sprawdź czy nginx nie blokuje portu 80
sudo systemctl stop nginx
sudo certbot certonly --standalone -d hub.hypersomnia.io
sudo systemctl start nginx
```

### Certbot: "DNS problem: NXDOMAIN"
```bash
# DNS jeszcze nie propagowało, poczekaj 15-30 minut
# Sprawdź:
dig hub.hypersomnia.io +short
```

### SSH: "Permission denied"
```bash
# Upewnij się że klucz publiczny jest na serwerze
ssh-copy-id ubuntu@hub.hypersomnia.io
```

### Ansible: "Failed to connect to the host"
```bash
# Test połączenia
ansible all -i inventory/hypersomnia.io.yml -m ping

# Jeśli nie działa, sprawdź inventory i SSH
```
