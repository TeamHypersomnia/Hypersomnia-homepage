# Manual Prerequisites - play.hypersomnia.io

**Status:** DO ZROBIENIA PÓŹNIEJ

Kroki dla migracji webowej wersji gry z `hypersomnia.io` na `play.hypersomnia.io`.

**Założenie:** Masz już dostęp SSH:
- `ssh ubuntu@play.hypersomnia.io` (154.12.226.211)

---

## 🔧 Krok 1: Podstawowa Konfiguracja Serwera

```bash
ssh ubuntu@play.hypersomnia.io

# Update systemu
sudo apt update
sudo apt upgrade -y

# Instalacja Pythona (wymagane dla Ansible)
sudo apt install -y python3 python3-pip

# Weryfikacja
python3 --version
```

---

## 🔐 Krok 2: Instalacja Certbot i Nginx

```bash
ssh ubuntu@play.hypersomnia.io

# Instalacja nginx i certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Weryfikacja
sudo systemctl status nginx
```

---

## 🌍 Krok 3: Weryfikacja DNS

```bash
# Na lokalnej maszynie
dig play.hypersomnia.io +short
# Powinno zwrócić: 154.12.226.211
```

**Jeśli DNS nie wskazuje poprawnie:**
1. Ustaw rekord A: `play.hypersomnia.io` → `154.12.226.211`
2. Poczekaj na propagację (5-30 minut)

---

## 🔒 Krok 4: Generowanie Certyfikatu SSL

```bash
ssh ubuntu@play.hypersomnia.io

# Certyfikat dla play.hypersomnia.io
sudo certbot certonly --nginx -d play.hypersomnia.io

# Test renewal
sudo certbot renew --dry-run
```

---

## ✅ Checklist

- [ ] Python3 zainstalowany
- [ ] Nginx zainstalowany i działa
- [ ] Certbot zainstalowany
- [ ] Certyfikat dla `play.hypersomnia.io` wygenerowany
- [ ] Test renewal przeszedł

---

## 🚀 Co Dalej?

Po wykonaniu powyższych kroków:

1. Zaktualizuj nginx config na `play.hypersomnia.io`:
   - Zmień `server_name` z `hypersomnia.io` na `play.hypersomnia.io`
   - Zaktualizuj ścieżki do certyfikatów

2. Opcjonalnie: Użyj Ansible do zarządzania konfiguracją

3. Przetestuj webową wersję gry: https://play.hypersomnia.io
