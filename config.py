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
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024  # Giới hạn upload 8MB

    # API key cho Google Gemini (dùng cho nhận diện cây, chẩn đoán bệnh và AI Chat)
    # Đặt biến môi trường GEMINI_API_KEY trước khi chạy, ví dụ:
    #   Windows (cmd):  set GEMINI_API_KEY=xxxx
    #   macOS/Linux:    export GEMINI_API_KEY=xxxx
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

    # Nếu chưa có API key, hệ thống sẽ tự chạy ở "chế độ demo" (dữ liệu giả lập)
    DEMO_MODE = GEMINI_API_KEY == ""
