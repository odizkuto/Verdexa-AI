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

    # Hồ sơ cá nhân hoá (đồng bộ theo tài khoản thay vì chỉ lưu trên 1 trình duyệt)
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'green'")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'vi'")

    # Gắn lịch sử nhận diện/chẩn đoán với từng tài khoản (trước đây dùng chung cho mọi user)
    cur.execute("ALTER TABLE history ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL")

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
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Migrate êm cho database tạo từ trước (chưa có cột user_id / status):
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
    # status: 'pending' (chờ admin xử lý) hoặc 'confirmed' (admin đã xác nhận).
    # Trước đây admin "xử lý" = XOÁ đơn khỏi bảng -> làm mất luôn lịch sử của user.
    # Giờ đổi sang cập nhật status để đơn KHÔNG BAO GIỜ bị xoá, user vẫn thấy
    # trong "Lịch sử mua hàng" mãi mãi, còn admin thì chuyển từ danh sách "Chờ xử lý"
    # sang "Lịch sử đã xác nhận" của admin.
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'")

    # Bảng lưu lại các cuộc trò chuyện với AI, tự đặt tên theo nội dung
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            messages TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Gắn từng cuộc trò chuyện với đúng tài khoản đã tạo ra nó (trước đây dùng
    # chung 1 danh sách cho MỌI người dùng -> ai cũng xem/sửa/xoá được của nhau).
    cur.execute("ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE")

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


def add_history(image_path, plant_name, disease_name, confidence, result_summary, user_id=None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO history (image_path, plant_name, disease_name, confidence, result_summary, user_id)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (image_path, plant_name, disease_name, confidence, result_summary, user_id))
    conn.commit()
    cur.close()
    conn.close()


def get_history(user_id=None, limit=50):
    """Lấy lịch sử nhận diện/chẩn đoán. Truyền user_id để chỉ lấy của riêng tài
    khoản đó (dùng cho API cá nhân); để trống chỉ dùng cho mục đích nội bộ/legacy."""
    conn = get_connection()
    cur = conn.cursor()
    if user_id is not None:
        cur.execute(
            "SELECT * FROM history WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
            (user_id, limit),
        )
    else:
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


def get_user_by_id(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
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


def delete_user(user_id):
    """Xoá vĩnh viễn tài khoản người dùng (dùng cho tính năng 'Xoá tài khoản' trong Cài đặt)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()


ALLOWED_PROFILE_FIELDS = {"display_name", "avatar_data", "dark_mode", "theme", "lang"}


def update_user_profile(user_id, fields):
    """Cập nhật 1 hoặc nhiều trường hồ sơ cá nhân hoá (avatar, tên hiển thị,
    dark mode, màu chủ đề, ngôn ngữ) để đồng bộ theo tài khoản trên mọi thiết bị.
    `fields` là dict, CHỈ những khoá nằm trong ALLOWED_PROFILE_FIELDS mới được áp dụng."""
    updates = {k: v for k, v in fields.items() if k in ALLOWED_PROFILE_FIELDS}
    if not updates:
        return

    conn = get_connection()
    cur = conn.cursor()
    set_clause = ", ".join(f"{col} = %s" for col in updates)
    values = list(updates.values()) + [user_id]
    cur.execute(f"UPDATE users SET {set_clause} WHERE id = %s", values)
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

def add_chat_history(title, messages_json, user_id):
    """Lưu 1 cuộc trò chuyện. messages_json là chuỗi JSON của list [{role, content}]."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO chat_history (title, messages, user_id) VALUES (%s, %s, %s) RETURNING id",
        (title, messages_json, user_id),
    )
    chat_id = cur.fetchone()["id"]
    conn.commit()
    cur.close()
    conn.close()
    return chat_id


def get_chat_sessions(user_id, limit=50):
    """Danh sách các cuộc trò chuyện đã lưu CỦA RIÊNG user_id (không kèm nội dung đầy đủ), mới nhất trước."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, created_at FROM chat_history WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
        (user_id, limit),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def get_chat_session(chat_id, user_id):
    """Lấy đầy đủ 1 cuộc trò chuyện đã lưu theo id, CHỈ khi thuộc về user_id (chặn xem trộm của người khác)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM chat_history WHERE id = %s AND user_id = %s", (chat_id, user_id))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def update_chat_history(chat_id, messages_json, user_id):
    """Cập nhật nội dung tin nhắn của 1 cuộc trò chuyện đã lưu (giữ nguyên tiêu đề). Trả về True nếu có bản ghi thuộc user_id được cập nhật."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE chat_history SET messages = %s WHERE id = %s AND user_id = %s",
        (messages_json, chat_id, user_id),
    )
    updated = cur.rowcount > 0
    conn.commit()
    cur.close()
    conn.close()
    return updated


def delete_chat_history(chat_id, user_id):
    """Xoá 1 cuộc trò chuyện đã lưu theo id, CHỈ khi thuộc về user_id. Trả về True nếu đã xoá."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM chat_history WHERE id = %s AND user_id = %s", (chat_id, user_id))
    deleted = cur.rowcount > 0
    conn.commit()
    cur.close()
    conn.close()
    return deleted


# ======================== CỬA HÀNG (SẢN PHẨM THUỐC BVTV) ========================

def get_all_products():
    """Danh sách sản phẩm trong Cửa hàng. Sản phẩm được mua nhiều nhất / đã có người mua
    sẽ hiển thị lên đầu (dễ tìm hơn cho khách), sản phẩm mới đăng xếp sau đó."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT p.*, COALESCE(o.order_count, 0) AS order_count
        FROM products p
        LEFT JOIN (
            SELECT product_id, COUNT(*) AS order_count
            FROM orders
            WHERE product_id IS NOT NULL
            GROUP BY product_id
        ) o ON o.product_id = p.id
        ORDER BY COALESCE(o.order_count, 0) DESC, p.created_at DESC
    """)
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

def add_order(product_id, product_name, customer_name, customer_phone, quantity=1, user_id=None):
    """Lưu 1 yêu cầu mua hàng (tên + SĐT khách để lại). Trả về đơn vừa tạo."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO orders (product_id, product_name, customer_name, customer_phone, quantity, user_id)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    """, (product_id, product_name, customer_name, customer_phone, quantity, user_id))
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
    """Toàn bộ đơn mua hàng (mọi trạng thái), mới nhất trước."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def get_pending_orders():
    """Đơn đang CHỜ admin xử lý (dùng cho nút chuông 'Đơn đặt hàng')."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def confirm_order(order_id):
    """Admin xác nhận đã xử lý đơn: đổi status, KHÔNG xoá dòng dữ liệu
    (để user vẫn thấy đơn này trong 'Lịch sử mua hàng' của họ mãi mãi)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE orders SET status = 'confirmed' WHERE id = %s", (order_id,))
    conn.commit()
    cur.close()
    conn.close()
    return get_order_by_id(order_id)


def get_orders_by_user(user_id):
    """Lịch sử mua hàng của 1 tài khoản (mọi trạng thái, không bao giờ mất)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM orders WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def delete_order(order_id):
    """Xoá hẳn 1 đơn khỏi database (dùng khi admin muốn xoá đơn rác/spam,
    KHÔNG dùng cho thao tác 'xác nhận đã xử lý' nữa)."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
    conn.commit()
    cur.close()
    conn.close()
