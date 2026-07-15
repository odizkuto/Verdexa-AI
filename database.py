"""
Verdexa AI - database.py
Kết nối và thao tác với SQLite: khởi tạo bảng, lưu lịch sử, quản lý dữ liệu cây trồng.
"""

import sqlite3
from config import Config


def get_connection():
    """Mở kết nối tới database SQLite."""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Tạo các bảng cần thiết nếu chưa tồn tại. Gọi 1 lần khi khởi động app."""
    conn = get_connection()
    cur = conn.cursor()

    # Bảng cây trồng (dùng cho Plant Library)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS plants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            image TEXT,
            family TEXT,
            temperature TEXT,
            harvest_time TEXT,
            water_need TEXT,
            fertilizer TEXT,
            common_diseases TEXT,
            description TEXT
        )
    """)

    # Bảng lịch sử tra cứu (nhận diện cây / chẩn đoán bệnh)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT,
            plant_name TEXT,
            disease_name TEXT,
            confidence REAL,
            result_summary TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Bảng người dùng (chuẩn bị cho V2: đăng nhập/đăng ký)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


def seed_plants_if_empty():
    """Thêm dữ liệu cây trồng mẫu nếu bảng plants đang trống."""
    conn = get_connection()
    cur = conn.cursor()
    count = cur.execute("SELECT COUNT(*) FROM plants").fetchone()[0]

    if count == 0:
        sample_plants = [
            ("Cà chua", "Fruit Vegetable", "tomato.jpg", "Solanaceae",
             "20 - 28°C", "70 - 90 ngày", "Trung bình", "NPK 16-16-8",
             "Đốm lá sớm, héo xanh", "Cây trồng phổ biến, ưa nắng, đất tơi xốp."),
            ("Lúa", "Cereal Crop", "rice.jpg", "Poaceae",
             "22 - 30°C", "90 - 120 ngày", "Cao", "Urê, Kali",
             "Đạo ôn, khô vằn", "Cây lương thực chính, cần nhiều nước."),
            ("Ngô", "Grain Crop", "corn.jpg", "Poaceae",
             "18 - 27°C", "80 - 110 ngày", "Trung bình", "NPK 20-20-15",
             "Sâu đục thân, gỉ sắt", "Cây trồng lấy hạt, chịu hạn khá tốt."),
            ("Xoài", "Fruit Tree", "mango.jpg", "Anacardiaceae",
             "24 - 30°C", "3 - 5 năm (cây mới)", "Thấp - Trung bình", "Phân hữu cơ + NPK",
             "Thán thư, rầy bông xoài", "Cây ăn quả lâu năm, ưa khí hậu nhiệt đới."),
        ]
        cur.executemany("""
            INSERT INTO plants
            (name, category, image, family, temperature, harvest_time, water_need, fertilizer, common_diseases, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_plants)
        conn.commit()

    conn.close()


def get_all_plants():
    conn = get_connection()
    plants = conn.execute("SELECT * FROM plants").fetchall()
    conn.close()
    return [dict(p) for p in plants]


def get_plant_by_id(plant_id):
    conn = get_connection()
    plant = conn.execute("SELECT * FROM plants WHERE id = ?", (plant_id,)).fetchone()
    conn.close()
    return dict(plant) if plant else None


def add_history(image_path, plant_name, disease_name, confidence, result_summary):
    conn = get_connection()
    conn.execute("""
        INSERT INTO history (image_path, plant_name, disease_name, confidence, result_summary)
        VALUES (?, ?, ?, ?, ?)
    """, (image_path, plant_name, disease_name, confidence, result_summary))
    conn.commit()
    conn.close()


def get_history(limit=50):
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM history ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ======================== NGƯỜI DÙNG (ĐĂNG KÝ / ĐĂNG NHẬP) ========================

def create_user(username, email, password_hash):
    """Tạo user mới. Trả về id của user vừa tạo."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
        (username, email, password_hash),
    )
    conn.commit()
    user_id = cur.lastrowid
    conn.close()
    return user_id


def get_user_by_email(email):
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(user) if user else None


def get_user_by_username(username):
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(user) if user else None