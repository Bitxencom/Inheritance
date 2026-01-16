#!/bin/bash

# ===========================================
# Git Push Automation Script
# Otomatis: git add, git commit, git push
# ===========================================

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fungsi untuk menampilkan pesan
echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cek apakah ini adalah git repository
if [ ! -d ".git" ]; then
    echo_error "Folder ini bukan git repository!"
    exit 1
fi

# Cek apakah ada perubahan
if [ -z "$(git status --porcelain)" ]; then
    echo_warning "Tidak ada perubahan untuk di-commit."
    exit 0
fi

# Tampilkan status perubahan
echo_info "Perubahan yang terdeteksi:"
git status --short
echo ""

# Ambil commit message dari argumen atau gunakan default
if [ -z "$1" ]; then
    # Default: gunakan timestamp sebagai commit message
    COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M:%S')"
    echo_warning "Tidak ada commit message. Menggunakan default: \"$COMMIT_MSG\""
else
    COMMIT_MSG="$*"
fi

echo ""
echo_info "Commit message: \"$COMMIT_MSG\""
echo ""

# Git Add
echo_info "Menjalankan: git add ."
git add .
if [ $? -ne 0 ]; then
    echo_error "git add gagal!"
    exit 1
fi
echo_success "git add berhasil!"

# Git Commit
echo_info "Menjalankan: git commit -m \"$COMMIT_MSG\""
git commit -m "$COMMIT_MSG"
if [ $? -ne 0 ]; then
    echo_error "git commit gagal!"
    exit 1
fi
echo_success "git commit berhasil!"

# Git Push
echo_info "Menjalankan: git push"
git push
if [ $? -ne 0 ]; then
    echo_error "git push gagal! Coba jalankan 'git push --set-upstream origin <branch>' jika ini branch baru."
    exit 1
fi
echo_success "git push berhasil!"

echo ""
echo_success "✅ Semua proses selesai! Kode sudah di-push ke repository."