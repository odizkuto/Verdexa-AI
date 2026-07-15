"""
Script kiểm tra nhanh: key Gemini của bạn được phép dùng những model nào.
Cách chạy: đặt file này vào thư mục VerdexaAI (ngang hàng app.py), rồi chạy:
    python list_gemini_models.py
"""

import os
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, "apikey.env"))

import google.generativeai as genai

api_key = os.environ.get("GEMINI_API_KEY", "")
if not api_key:
    print("Không tìm thấy GEMINI_API_KEY. Kiểm tra lại file apikey.env.")
    raise SystemExit(1)

genai.configure(api_key=api_key)

print("Các model mà key của bạn có thể dùng để tạo nội dung (generateContent):\n")
for m in genai.list_models():
    if "generateContent" in m.supported_generation_methods:
        print(f"- {m.name}")