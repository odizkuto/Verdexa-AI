"""
Verdexa AI - app.py
File chính chạy Flask: khai báo route cho giao diện web và API.
Chạy: python app.py
"""

import os
import json
import uuid
import secrets
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory, session
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

from config import Config
import database as db
import ai
import mailer

app = Flask(__name__)
app.config.from_object(Config)

# Session (đăng nhập) giữ trong 30 ngày dù người dùng đóng trình duyệt/app,
# thay vì mặc định Flask sẽ xóa session ngay khi đóng trình duyệt.
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

# Khởi tạo bảng + seed dữ liệu mẫu ngay khi module được nạp — chạy được dù
# start bằng "python app.py" (local) hay bằng gunicorn (Render, production).
db.init_db()
db.seed_plants_if_empty()


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def save_uploaded_image(file_storage):
    """Lưu ảnh upload với tên file duy nhất, trả về đường dẫn đã lưu."""
    filename = secure_filename(file_storage.filename)
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    save_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
    file_storage.save(save_path)
    return save_path, unique_name


# ======================== XÁC MINH GOOGLE SEARCH CONSOLE ========================

@app.route("/google0156cc4bdf0bb97f.html")
def google_verify():
    return send_from_directory(".", "google0156cc4bdf0bb97f.html")


# ======================== HEALTH CHECK / KEEP-ALIVE ========================
# Dùng route này để UptimeRobot / cron-job.org ping giữ cho Render không ngủ.
# Route rất nhẹ: không query DB, không render template.

@app.route("/ping")
def ping():
    return "OK", 200


# ======================== TRANG GIAO DIỆN ========================

@app.route("/")
def home():
    plants = db.get_all_plants()
    return render_template("index.html", plants=plants, username=session.get("username"))


@app.route("/login")
def login_page():
    return render_template("login.html")


@app.route("/register")
def register_page():
    return render_template("register.html")


@app.route("/forgot-password")
def forgot_password_page():
    return render_template("forgot-password.html")


@app.route("/reset-password")
def reset_password_page():
    token = request.args.get("token", "")
    return render_template("reset-password.html", token=token)


@app.route("/plant/<int:plant_id>")
def plant_details_page(plant_id):
    plant = db.get_plant_by_id(plant_id)
    if not plant:
        return "Không tìm thấy cây trồng.", 404
    return render_template("plant-details.html", plant=plant, username=session.get("username"))


@app.route("/history")
def history_page():
    records = db.get_history()
    return render_template("history.html", history=records, username=session.get("username"))


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(Config.UPLOAD_FOLDER, filename)


# ======================== API: NHẬN DIỆN CÂY ========================

@app.route("/api/predict", methods=["POST"])
def api_predict():
    if "image" not in request.files:
        return jsonify({"error": "Vui lòng chọn ảnh."}), 400

    file = request.files["image"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Định dạng ảnh không hợp lệ."}), 400

    save_path, unique_name = save_uploaded_image(file)

    try:
        result = ai.recognize_plant(save_path)
    except Exception as e:
        return jsonify({"error": f"Lỗi khi nhận diện: {str(e)}"}), 500

    db.add_history(
        image_path=unique_name,
        plant_name=result.get("plant"),
        disease_name=None,
        confidence=result.get("confidence"),
        result_summary=result.get("description", ""),
    )

    return jsonify(result)


# ======================== API: CHẨN ĐOÁN BỆNH ========================

@app.route("/api/diagnose", methods=["POST"])
def api_diagnose():
    # Cách 1: chẩn đoán bằng ảnh
    if "image" in request.files and request.files["image"].filename != "":
        file = request.files["image"]
        if not allowed_file(file.filename):
            return jsonify({"error": "Định dạng ảnh không hợp lệ."}), 400

        save_path, unique_name = save_uploaded_image(file)
        try:
            result = ai.diagnose_disease_from_image(save_path)
        except Exception as e:
            return jsonify({"error": f"Lỗi khi chẩn đoán: {str(e)}"}), 500

        db.add_history(
            image_path=unique_name,
            plant_name=None,
            disease_name=result.get("disease"),
            confidence=result.get("confidence"),
            result_summary=result.get("cause", ""),
        )
        return jsonify(result)

    # Cách 2: chẩn đoán bằng tên cây + triệu chứng
    data = request.get_json(silent=True) or request.form
    plant_name = data.get("plant_name", "").strip()
    symptoms = data.get("symptoms", "").strip()

    if not plant_name or not symptoms:
        return jsonify({"error": "Vui lòng nhập tên cây và triệu chứng."}), 400

    try:
        result = ai.diagnose_disease_from_text(plant_name, symptoms)
    except Exception as e:
        return jsonify({"error": f"Lỗi khi chẩn đoán: {str(e)}"}), 500

    db.add_history(
        image_path=None,
        plant_name=plant_name,
        disease_name=result.get("disease"),
        confidence=result.get("confidence"),
        result_summary=result.get("cause", ""),
    )

    return jsonify(result)


# ======================== API: ĐĂNG KÝ / ĐĂNG NHẬP ========================

@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not username or not email or not password:
        return jsonify({"error": "Vui lòng điền đầy đủ tất cả các trường."}), 400

    if len(password) < 6:
        return jsonify({"error": "Mật khẩu phải có ít nhất 6 ký tự."}), 400

    if db.get_user_by_email(email):
        return jsonify({"error": "Email này đã được đăng ký."}), 409

    if db.get_user_by_username(username):
        return jsonify({"error": "Tên người dùng đã tồn tại."}), 409

    password_hash = generate_password_hash(password)

    try:
        db.create_user(username, email, password_hash)
    except Exception as e:
        return jsonify({"error": f"Lỗi khi tạo tài khoản: {str(e)}"}), 500

    return jsonify({"message": "Đăng ký thành công."}), 201


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Vui lòng nhập đầy đủ email và mật khẩu."}), 400

    user = db.get_user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Email hoặc mật khẩu không đúng."}), 401

    session.permanent = True
    session["user_id"] = user["id"]
    session["username"] = user["username"]

    return jsonify({"message": "Đăng nhập thành công.", "username": user["username"]})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"message": "Đã đăng xuất."})


@app.route("/api/forgot-password", methods=["POST"])
def api_forgot_password():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Vui lòng nhập email."}), 400

    # Thông điệp trả về LUÔN giống nhau dù email có tồn tại hay không,
    # để tránh lộ thông tin email nào đã đăng ký (chống dò quét tài khoản).
    generic_message = (
        "Nếu email này đã đăng ký, một liên kết đặt lại mật khẩu đã được gửi tới hộp thư của bạn."
    )

    user = db.get_user_by_email(email)
    if not user:
        return jsonify({"message": generic_message})

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    db.create_password_reset(user["id"], token, expires_at)

    reset_link = f"{Config.APP_BASE_URL}/reset-password?token={token}"

    try:
        mailer.send_password_reset_email(user["email"], user["username"], reset_link)
    except Exception as e:
        print(f"[FORGOT PASSWORD] Lỗi khi gửi email: {e}")

    return jsonify({"message": generic_message})


@app.route("/api/reset-password", methods=["POST"])
def api_reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token", "").strip()
    password = data.get("password", "")

    if not token or not password:
        return jsonify({"error": "Thiếu thông tin cần thiết."}), 400

    if len(password) < 6:
        return jsonify({"error": "Mật khẩu phải có ít nhất 6 ký tự."}), 400

    reset_row = db.get_password_reset(token)
    if not reset_row:
        return jsonify({"error": "Liên kết đặt lại mật khẩu không hợp lệ."}), 400

    if reset_row["used"]:
        return jsonify({"error": "Liên kết này đã được sử dụng. Vui lòng yêu cầu liên kết mới."}), 400

    if reset_row["expires_at"] < datetime.utcnow():
        return jsonify({"error": "Liên kết đã hết hạn. Vui lòng yêu cầu liên kết mới."}), 400

    password_hash = generate_password_hash(password)
    db.update_user_password(reset_row["user_id"], password_hash)
    db.mark_password_reset_used(token)

    return jsonify({"message": "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ."})


# ======================== API: THƯ VIỆN CÂY ========================

@app.route("/api/plants")
def api_plants():
    return jsonify(db.get_all_plants())


@app.route("/api/plant-search")
def api_plant_search():
    query = request.args.get("name", "").strip()
    if not query:
        return jsonify({"error": "Vui lòng nhập tên cây cần tìm kiếm."}), 400

    try:
        info = ai.search_plant_info(query)
    except Exception as e:
        return jsonify({"error": f"Lỗi khi tìm kiếm: {str(e)}"}), 500

    image_url = ai.fetch_plant_image(info.get("image_query") or query)
    info["image"] = image_url or (
        "https://images.unsplash.com/photo-1501004318641-b39e6451bec6"
        "?auto=format&fit=crop&w=800&q=80"
    )

    return jsonify(info)


# ======================== API: CHAT AI ========================

@app.route("/api/chat", methods=["POST"])
def api_chat():
    image_url = None
    image_path = None

    # Nếu người dùng đính kèm ảnh (upload hoặc chụp camera) -> request sẽ là multipart/form-data
    if request.files and "image" in request.files and request.files["image"].filename != "":
        message = request.form.get("message", "").strip()
        try:
            history = json.loads(request.form.get("history", "[]"))
        except (TypeError, ValueError):
            history = []

        file = request.files["image"]
        if not allowed_file(file.filename):
            return jsonify({"error": "Định dạng ảnh không hợp lệ."}), 400

        image_path, unique_name = save_uploaded_image(file)
        image_url = f"/uploads/{unique_name}"
    else:
        data = request.get_json(silent=True) or {}
        message = data.get("message", "").strip()
        history = data.get("history", [])

    if not message and not image_path:
        return jsonify({"error": "Vui lòng nhập nội dung hoặc đính kèm ảnh."}), 400

    try:
        reply = ai.chat_with_ai(message, history, image_path=image_path)
    except Exception as e:
        return jsonify({"error": f"Lỗi khi trò chuyện với AI: {str(e)}"}), 500

    return jsonify({"reply": reply, "image_url": image_url})


# ======================== API: LỊCH SỬ TRÒ CHUYỆN AI ========================

@app.route("/api/chat/save", methods=["POST"])
def api_chat_save():
    data = request.get_json(silent=True) or {}
    messages = data.get("messages", [])

    if not messages or not isinstance(messages, list):
        return jsonify({"error": "Không có nội dung để lưu."}), 400

    try:
        title = ai.generate_chat_title(messages)
    except Exception:
        title = "Cuộc trò chuyện với AI"

    import json as _json
    chat_id = db.add_chat_history(title, _json.dumps(messages, ensure_ascii=False))

    return jsonify({"id": chat_id, "title": title})


@app.route("/api/chat/history")
def api_chat_history_list():
    return jsonify(db.get_chat_sessions())


@app.route("/api/chat/history/<int:chat_id>")
def api_chat_history_detail(chat_id):
    import json as _json
    session_row = db.get_chat_session(chat_id)
    if not session_row:
        return jsonify({"error": "Không tìm thấy cuộc trò chuyện."}), 404

    session_row["messages"] = _json.loads(session_row["messages"])
    return jsonify(session_row)


@app.route("/api/chat/save/<int:chat_id>", methods=["PUT"])
def api_chat_update(chat_id):
    data = request.get_json(silent=True) or {}
    messages = data.get("messages", [])

    if not messages or not isinstance(messages, list):
        return jsonify({"error": "Không có nội dung để cập nhật."}), 400

    if not db.get_chat_session(chat_id):
        return jsonify({"error": "Không tìm thấy cuộc trò chuyện."}), 404

    import json as _json
    db.update_chat_history(chat_id, _json.dumps(messages, ensure_ascii=False))

    return jsonify({"id": chat_id, "message": "Đã cập nhật."})


@app.route("/api/chat/history/<int:chat_id>", methods=["DELETE"])
def api_chat_delete(chat_id):
    if not db.get_chat_session(chat_id):
        return jsonify({"error": "Không tìm thấy cuộc trò chuyện."}), 404

    db.delete_chat_history(chat_id)
    return jsonify({"message": "Đã xoá cuộc trò chuyện."})


# ======================== API: LỊCH SỬ ========================

@app.route("/api/history")
def api_history():
    return jsonify(db.get_history())


# ======================== KHỞI ĐỘNG APP (chỉ khi chạy local: python app.py) ========================

if __name__ == "__main__":
    app.run(debug=True, port=5000)
