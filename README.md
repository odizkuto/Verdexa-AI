# 🌿 Verdexa AI

Hệ thống nhận diện cây trồng và chẩn đoán bệnh bằng trí tuệ nhân tạo.

## Mục tiêu

- Nhận diện cây trồng từ ảnh.
- Chẩn đoán bệnh cây (từ ảnh hoặc mô tả triệu chứng).
- Đưa ra biện pháp xử lý.
- Tra cứu thông tin cây trồng (thư viện cây).
- Trò chuyện với AI về nông nghiệp.
- Lưu lại lịch sử tra cứu.

## Đối tượng sử dụng

Nông dân, sinh viên, giáo viên, người yêu thích cây trồng.

## Công nghệ

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Flask (Python)
- **Database:** SQLite
- **AI:** Google Gemini (giai đoạn đầu) — dự kiến chuyển sang TensorFlow/YOLO/PlantVillage Model sau này

## Cấu trúc dự án

```
VerdexaAI/
├── app.py                # File chính chạy Flask, khai báo route
├── config.py              # Cấu hình chung (API key, đường dẫn, secret key...)
├── database.py             # Kết nối + thao tác với SQLite
├── ai.py                   # Xử lý gọi AI (nhận diện cây / chẩn đoán bệnh / chat)
├── requirements.txt        # Danh sách thư viện cần cài
├── models/                 # Model AI tự train (dùng ở giai đoạn sau)
├── static/
│   ├── css/style.css
│   ├── js/                 # script.js, disease.js, chat.js, history.js
│   └── images/
├── templates/               # Các trang HTML (Jinja2)
├── uploads/                 # Ảnh người dùng upload
└── database/verdexa.db      # File database SQLite
```

## Cài đặt & chạy thử

1. Cài Python 3.10+ (nếu chưa có).

2. Cài các thư viện cần thiết:
   ```
   pip install -r requirements.txt
   ```

3. (Tùy chọn) Cấu hình API key Google Gemini để dùng AI thật — nếu bỏ qua bước này,
   hệ thống sẽ tự chạy ở **chế độ demo** (dữ liệu giả lập) để bạn vẫn xem được giao diện hoạt động:
   ```
   set GEMINI_API_KEY=xxxx        (Windows)
   export GEMINI_API_KEY=xxxx     (macOS/Linux)
   ```

4. Chạy ứng dụng:
   ```
   python app.py
   ```

5. Mở trình duyệt tại: `http://127.0.0.1:5000`

## Lộ trình phát triển

**V1:** Giao diện, upload ảnh, Flask API, AI nhận diện, chẩn đoán bệnh, thư viện cây, chat AI, lưu lịch sử.

**V2:** Đăng nhập, quản lý người dùng, yêu thích cây, thống kê lịch sử, trang quản trị viên cập nhật dữ liệu cây và bệnh.