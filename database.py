"""
Verdexa AI - database.py
Kết nối và thao tác với PostgreSQL (Neon, Supabase...): khởi tạo bảng,
lưu lịch sử, quản lý dữ liệu cây trồng.

Dùng PostgreSQL (thay vì SQLite) để dữ liệu KHÔNG bị mất khi host trên
các nền tảng có ổ đĩa tạm (ephemeral) như Render gói Free.
"""

import psycopg2
import psycopg2.extras
from config import Config


def get_connection():
    """Mở kết nối tới database PostgreSQL. Trả về dict-like row (giống sqlite3.Row cũ)."""
    if not Config.DATABASE_URL:
        raise RuntimeError(
            "Chưa cấu hình DATABASE_URL. Vào file apikey.env (hoặc biến môi trường trên "
            "Render) và thêm dòng: DATABASE_URL=postgresql://... "
            "(lấy chuỗi kết nối này từ Neon/Supabase)."
        )
    conn = psycopg2.connect(Config.DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


def init_db():
    """Tạo các bảng cần thiết nếu chưa tồn tại. Gọi 1 lần khi khởi động app."""
    conn = get_connection()
    cur = conn.cursor()

    # Bảng cây trồng (dùng cho Plant Library)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS plants (
            id SERIAL PRIMARY KEY,
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
            id SERIAL PRIMARY KEY,
            image_path TEXT,
            plant_name TEXT,
            disease_name TEXT,
            confidence REAL,
            result_summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Bảng người dùng (đăng nhập / đăng ký) — dùng SỐ ĐIỆN THOẠI làm định danh
    # chính (email vẫn giữ lại, không bắt buộc, để tương thích các tài khoản cũ
    # từng đăng ký bằng Gmail).
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            phone TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Migrate êm cho database tạo từ trước:
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE")
    cur.execute("ALTER TABLE users ALTER COLUMN email DROP NOT NULL")

    # Bảng sản phẩm (thuốc BVTV) trong Cửa hàng — do tài khoản admin đăng lên
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            price NUMERIC,
            unit TEXT,
            description TEXT,
            image TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Bảng đơn mua hàng (khách bấm nút "Mua" trong Cửa hàng và để lại tên + SĐT)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            product_name TEXT,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Bảng lưu lại các cuộc trò chuyện với AI, tự đặt tên theo nội dung
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            messages TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Bảng lưu token đặt lại mật khẩu (dùng cho tính năng "Quên mật khẩu")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS password_resets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    cur.close()
    conn.close()


def seed_plants_if_empty():
    """Thêm dữ liệu cây trồng mẫu nếu bảng plants đang trống."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS count FROM plants")
    count = cur.fetchone()["count"]

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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, sample_plants)
        conn.commit()

    cur.close()
    conn.close()


def get_all_plants():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM plants")
    plants = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(p) for p in plants]


def get_plant_by_id(plant_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM plants WHERE id = %s", (plant_id,))
    plant = cur.fetchone()
    cur.close()
    conn.close()
    return dict(plant) if plant else None


def add_history(image_path, plant_name, disease_name, confidence, result_summary):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO history (image_path, plant_name, disease_name, confidence, result_summary)
        VALUES (%s, %s, %s, %s, %s)
    """, (image_path, plant_name, disease_name, confidence, result_summary))
    conn.commit()
    cur.close()
    conn.close()


def get_history(limit=50):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM history ORDER BY created_at DESC LIMIT %s", (limit,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


# ======================== NGƯỜI DÙNG (ĐĂNG KÝ / ĐĂNG NHẬP) ========================

def create_user(username, phone, password_hash, email=None):
    """Tạo user mới bằng SỐ ĐIỆN THOẠI (email không bắt buộc). Trả về id vừa tạo."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (username, phone, email, password_hash) VALUES (%s, %s, %s, %s) RETURNING id",
        (username, phone, email, password_hash),
    )
    user_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return user_id


def get_user_by_email(email):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = %s", (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    return dict(user) if user else None


def get_user_by_phone(phone):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE phone = %s", (phone,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    return dict(user) if user else None


def get_user_by_username(username):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    return dict(user) if user else None


def set_user_admin(user_id, is_admin):
    """Bật/tắt quyền admin cho 1 user (dùng để tự động cấp quyền theo ADMIN_EMAILS / ADMIN_PHONES)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE users SET is_admin = %s WHERE id = %s", (is_admin, user_id))
    conn.commit()
    cur.close()
    conn.close()


def update_user_password(user_id, password_hash):
    """Cập nhật mật khẩu mới (đã hash) cho user."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (password_hash, user_id),
    )
    conn.commit()
    cur.close()
    conn.close()


# ======================== QUÊN MẬT KHẨU / ĐẶT LẠI MẬT KHẨU ========================

def create_password_reset(user_id, token, expires_at):
    """Tạo một bản ghi token đặt lại mật khẩu mới cho user."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO password_resets (user_id, token, expires_at) VALUES (%s, %s, %s)",
        (user_id, token, expires_at),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_password_reset(token):
    """Lấy bản ghi reset theo token. Trả về None nếu không tồn tại."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM password_resets WHERE token = %s", (token,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def mark_password_reset_used(token):
    """Đánh dấu token đã được sử dụng để không dùng lại được nữa."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE password_resets SET used = TRUE WHERE token = %s",
        (token,),
    )
    conn.commit()
    cur.close()
    conn.close()


# ======================== LỊCH SỬ TRÒ CHUYỆN AI ========================

def add_chat_history(title, messages_json):
    """Lưu 1 cuộc trò chuyện. messages_json là chuỗi JSON của list [{role, content}]."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_history (title, messages) VALUES (%s, %s) RETURNING id",
        (title, messages_json),
    )
    chat_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return chat_id


def get_chat_sessions(limit=50):
    """Danh sách các cuộc trò chuyện đã lưu (không kèm nội dung đầy đủ), mới nhất trước."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, created_at FROM chat_history ORDER BY created_at DESC LIMIT %s",
        (limit,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def get_chat_session(chat_id):
    """Lấy đầy đủ 1 cuộc trò chuyện đã lưu theo id."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM chat_history WHERE id = %s", (chat_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def update_chat_history(chat_id, messages_json):
    """Cập nhật nội dung tin nhắn của 1 cuộc trò chuyện đã lưu (giữ nguyên tiêu đề)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE chat_history SET messages = %s WHERE id = %s",
        (messages_json, chat_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def delete_chat_history(chat_id):
    """Xoá 1 cuộc trò chuyện đã lưu theo id."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM chat_history WHERE id = %s", (chat_id,))
    conn.commit()
    cur.close()
    conn.close()


# ======================== CỬA HÀNG (SẢN PHẨM THUỐC BVTV) ========================

def get_all_products():
    """Danh sách sản phẩm trong Cửa hàng, mới đăng lên hiển thị trước."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def get_product_by_id(product_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def add_product(name, category, price, unit, description, image):
    """Thêm 1 sản phẩm mới. Trả về sản phẩm vừa tạo (dict đầy đủ)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO products (name, category, price, unit, description, image)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    """, (name, category, price, unit, description, image))
    product_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return get_product_by_id(product_id)


def delete_product(product_id):
    """Xoá 1 sản phẩm theo id. Trả về đường dẫn ảnh (nếu có) để xoá file kèm theo."""
    product = get_product_by_id(product_id)
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM products WHERE id = %s", (product_id,))
    conn.commit()
    cur.close()
    conn.close()
    return product["image"] if product else None


# ======================== ĐƠN MUA HÀNG (NÚT "MUA" TRONG CỬA HÀNG) ========================

def add_order(product_id, product_name, customer_name, customer_phone, quantity=1):
    """Lưu 1 yêu cầu mua hàng (tên + SĐT khách để lại). Trả về đơn vừa tạo."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO orders (product_id, product_name, customer_name, customer_phone, quantity)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
    """, (product_id, product_name, customer_name, customer_phone, quantity))
    order_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return get_order_by_id(order_id)


def get_order_by_id(order_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def get_all_orders():
    """Danh sách đơn mua hàng, mới nhất trước (dùng cho admin xem/quản lý)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]
