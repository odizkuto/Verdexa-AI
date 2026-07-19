"""
Verdexa AI - config.py
Cấu hình chung cho toàn bộ ứng dụng Flask.
"""

import os
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Nạp các biến trong file apikey.env vào os.environ
# (vd: GEMINI_API_KEY=xxxx) để Config đọc được bên dưới.
load_dotenv(os.path.join(BASE_DIR, "apikey.env"))


class Config:
    # Khóa bí mật dùng cho session, cookie... (nên đặt qua biến môi trường khi deploy thật)
    SECRET_KEY = os.environ.get("SECRET_KEY", "verdexa-dev-secret-key")

    # Chuỗi kết nối database PostgreSQL (Neon, Supabase, Render Postgres...).
    # Đặt biến môi trường DATABASE_URL trước khi chạy, ví dụ:
    #   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
    DATABASE_URL = os.environ.get("DATABASE_URL", "")

    # Thư mục lưu ảnh người dùng upload
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "pdf"}
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # Giới hạn upload 8MB

    # API key cho Google Gemini (dùng cho nhận diện cây, chẩn đoán bệnh và AI Chat)
    # Đặt biến môi trường GEMINI_API_KEY trước khi chạy, ví dụ:
    #   Windows (cmd):  set GEMINI_API_KEY=xxxx
    #   macOS/Linux:    export GEMINI_API_KEY=xxxx
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

    # Nếu chưa có API key, hệ thống sẽ tự chạy ở "chế độ demo" (dữ liệu giả lập)
    DEMO_MODE = GEMINI_API_KEY == ""

    # ==================== GỬI EMAIL (dùng cho "Quên mật khẩu") ====================
    # Dùng Resend (https://resend.com) để gửi email đặt lại mật khẩu qua API,
    # không cần cấu hình SMTP. Đặt các biến này trong apikey.env (local) hoặc
    # Environment Variables trên Render:
    #   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
    #   MAIL_FROM_EMAIL=onboarding@resend.dev   (hoặc email theo domain đã xác minh trên Resend)
    #   MAIL_SENDER_NAME=Verdexa AI
    #   APP_BASE_URL=https://verdexa-ai.onrender.com
    RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
    MAIL_FROM_EMAIL = os.environ.get("MAIL_FROM_EMAIL", "onboarding@resend.dev")
    MAIL_SENDER_NAME = os.environ.get("MAIL_SENDER_NAME", "Verdexa AI")

    # Nếu chưa cấu hình RESEND_API_KEY, hệ thống sẽ chỉ in link đặt lại mật khẩu
    # ra console (log) thay vì gửi email thật — tiện để test local.
    MAIL_CONFIGURED = bool(RESEND_API_KEY)

    # Domain gốc của web, dùng để tạo link trong email (vd: link đặt lại mật khẩu)
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://127.0.0.1:5000")

    # ==================== TÀI KHOẢN ADMIN (quản lý Cửa hàng) ====================
    # Liệt kê các email được coi là admin, cách nhau bởi dấu phẩy. Đặt trong
    # apikey.env (local) hoặc Environment Variables trên Render, ví dụ:
    #   ADMIN_EMAILS=admin@verdexa.com,owner@gmail.com
    # Giữ lại để các tài khoản admin cũ (từng đăng ký bằng Gmail) vẫn hoạt động
    # bình thường — không cần đổi gì cả.
    ADMIN_EMAILS = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }

    # Từ khi hệ thống chuyển sang đăng ký/đăng nhập bằng SỐ ĐIỆN THOẠI, admin
    # mới có thể được cấp quyền theo số điện thoại, ví dụ:
    #   ADMIN_PHONES=0912345678,0987654321
    ADMIN_PHONES = {
        p.strip()
        for p in os.environ.get("ADMIN_PHONES", "").split(",")
        if p.strip()
    }
