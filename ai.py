"""
Verdexa AI - ai.py
Xử lý gọi AI: nhận diện cây trồng từ ảnh, chẩn đoán bệnh từ ảnh hoặc triệu chứng.

Dùng Google Gemini (nếu có GEMINI_API_KEY).
Nếu chưa cấu hình API key -> chạy "chế độ demo" trả kết quả mẫu, để giao diện
vẫn hoạt động được trong lúc phát triển / thuyết trình.
"""

import json
import mimetypes
import random
from config import Config

DEMO_PLANTS = [
    {"plant": "Cà chua", "confidence": 97},
    {"plant": "Lúa", "confidence": 95},
    {"plant": "Xoài", "confidence": 93},
]

DEMO_DISEASES = [
    {
        "disease": "Đốm lá sớm (Early Blight)",
        "confidence": 94,
        "cause": "Thường do nấm phát triển trong điều kiện ẩm ướt.",
        "solution": [
            "Loại bỏ lá bị nhiễm bệnh.",
            "Cải thiện độ thông thoáng cho cây.",
            "Sử dụng thuốc trừ nấm phù hợp.",
        ],
    },
    {
        "disease": "Vàng lá do thiếu đạm",
        "confidence": 88,
        "cause": "Đất thiếu dinh dưỡng, đặc biệt là nitơ.",
        "solution": [
            "Bón bổ sung phân đạm.",
            "Kiểm tra độ pH của đất.",
            "Tưới nước đều đặn, tránh úng.",
        ],
    },
]

# Model Gemini dùng cho văn bản + ảnh (đa phương thức)
# Dùng alias "gemini-flash-lite-latest": luôn tự trỏ tới bản Lite mới nhất mà
# Google đang cấp phép cho tài khoản của bạn (tránh lỗi 404 khi 1 phiên bản cụ
# thể bị ngừng hỗ trợ / bị khoá với tài khoản mới). Dòng Lite thường tắt hoặc
# giảm tối đa "thinking" so với các dòng Flash/Pro thường.
GEMINI_MODEL = "gemini-flash-lite-latest"

# Chỉ dẫn chung: luôn nhắc model trả lời trực tiếp, không lộ quá trình suy nghĩ,
# phòng trường hợp Google đổi model mặc định sau này.
NO_THINKING_INSTRUCTION = (
    "QUAN TRỌNG: Chỉ đưa ra câu trả lời CUỐI CÙNG. "
    "Không viết ra quá trình suy nghĩ, không liệt kê các bước nháp, "
    "không dùng markdown tiêu đề kiểu '**Bước 1**', không xưng hô kiểu đang lập kế hoạch trả lời. "
    "Luôn trả lời bằng tiếng Việt."
)


def _gemini_client():
    """Khởi tạo Gemini client. Chỉ import khi thật sự cần để tránh lỗi nếu chưa cài thư viện."""
    import google.generativeai as genai
    genai.configure(api_key=Config.GEMINI_API_KEY)
    return genai


def _load_image_part(image_path):
    """Đọc file ảnh và trả về dict theo format 'inline_data' mà Gemini yêu cầu."""
    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type:
        mime_type = "image/jpeg"
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    return {"mime_type": mime_type, "data": image_bytes}


def _extract_json(text):
    """Gemini đôi khi bọc JSON trong ```json ... ```; loại bỏ trước khi parse."""
    text = text.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return text


def _generate(model, contents, max_tokens):
    """
    Gọi model.generate_content(), cố gắng tắt "thinking" (thinking_budget=0).
    Một số phiên bản thư viện/model không nhận tham số này (báo TypeError hoặc
    ValueError "Unknown field") -> tự động thử lại không có tham số đó để
    tránh app bị crash.
    """
    try:
        return model.generate_content(
            contents,
            generation_config={
                "max_output_tokens": max_tokens,
                "thinking_config": {"thinking_budget": 0},
            },
        )
    except (TypeError, ValueError):
        return model.generate_content(
            contents,
            generation_config={"max_output_tokens": max_tokens},
        )


def _send_chat_message(chat, message, max_tokens):
    """Tương tự _generate() nhưng dùng cho chat nhiều lượt (chat.send_message)."""
    try:
        return chat.send_message(
            message,
            generation_config={
                "max_output_tokens": max_tokens,
                "thinking_config": {"thinking_budget": 0},
            },
        )
    except (TypeError, ValueError):
        return chat.send_message(
            message,
            generation_config={"max_output_tokens": max_tokens},
        )


def recognize_plant(image_path):
    """
    Nhận diện cây trồng từ ảnh.
    Trả về dict: {"plant": str, "confidence": int, "description": str}
    """
    if Config.DEMO_MODE:
        result = random.choice(DEMO_PLANTS)
        return {**result, "description": "Kết quả demo (chưa kết nối AI thật)."}

    genai = _gemini_client()
    model = genai.GenerativeModel(GEMINI_MODEL)
    image_part = _load_image_part(image_path)

    prompt = (
        f"{NO_THINKING_INSTRUCTION}\n\n"
        "Bạn là chuyên gia thực vật học. Hãy nhận diện loại cây trong ảnh này. "
        "Trả lời CHỈ bằng JSON theo đúng format, không thêm bất kỳ chữ nào khác: "
        '{"plant": "tên cây", "confidence": số nguyên 0-100, "description": "mô tả ngắn"}'
    )

    response = _generate(model, [prompt, image_part], max_tokens=300)
    text = _extract_json(response.text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"plant": "Không xác định", "confidence": 0, "description": text}


def diagnose_disease_from_image(image_path):
    """
    Chẩn đoán bệnh từ ảnh lá cây.
    Trả về dict: {"disease", "confidence", "cause", "solution": [..]}
    """
    if Config.DEMO_MODE:
        return random.choice(DEMO_DISEASES)

    genai = _gemini_client()
    model = genai.GenerativeModel(GEMINI_MODEL)
    image_part = _load_image_part(image_path)

    prompt = (
        f"{NO_THINKING_INSTRUCTION}\n\n"
        "Bạn là chuyên gia bệnh học thực vật. Hãy phân tích ảnh lá cây này và chẩn đoán bệnh. "
        "Trả lời CHỈ bằng JSON theo format, không thêm bất kỳ chữ nào khác: "
        '{"disease": "tên bệnh", "confidence": số nguyên 0-100, "cause": "nguyên nhân", '
        '"solution": ["biện pháp 1", "biện pháp 2", "biện pháp 3"]}'
    )

    response = _generate(model, [prompt, image_part], max_tokens=400)
    text = _extract_json(response.text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"disease": "Không xác định", "confidence": 0, "cause": text, "solution": []}


def diagnose_disease_from_text(plant_name, symptoms):
    """
    Chẩn đoán bệnh dựa trên tên cây + mô tả triệu chứng (không cần ảnh).
    """
    if Config.DEMO_MODE:
        return random.choice(DEMO_DISEASES)

    genai = _gemini_client()
    model = genai.GenerativeModel(GEMINI_MODEL)

    prompt = (
        f"{NO_THINKING_INSTRUCTION}\n\n"
        f"Cây trồng: {plant_name}\nTriệu chứng: {symptoms}\n\n"
        "Bạn là chuyên gia bệnh học thực vật. Hãy chẩn đoán bệnh có khả năng nhất. "
        "Trả lời CHỈ bằng JSON theo format, không thêm bất kỳ chữ nào khác: "
        '{"disease": "tên bệnh", "confidence": số nguyên 0-100, "cause": "nguyên nhân", '
        '"solution": ["biện pháp 1", "biện pháp 2", "biện pháp 3"]}'
    )

    response = _generate(model, prompt, max_tokens=400)
    text = _extract_json(response.text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"disease": "Không xác định", "confidence": 0, "cause": text, "solution": []}


# Câu hỏi về người sáng lập -> trả lời cố định, không để AI tự "bịa" theo ý riêng
FOUNDER_KEYWORDS = [
    "sáng lập", "tạo ra web", "tạo ra trang web", "tạo ra ứng dụng",
    "phát triển web", "phát triển ra", "ai làm ra", "ai tạo ra",
    "chủ web", "chủ trang web", "founder", "web này của ai",
    "trang web này của ai", "ai đứng sau", "ai code ra", "ai lập trình ra",
    "người tạo ra verdexa", "verdexa của ai",
]

FOUNDER_INTRO = (
    "Ở tuổi mười sáu tài hoa,\n"
    "Phạm Hữu Tài đã vượt qua bao người.\n"
    "Đam mê nông nghiệp trong đời,\n"
    "Ước mơ công nghệ sáng ngời tương lai.\n"
    "Verdexa AI ra đời từ đây,\n"
    "Của một kỹ sư trẻ đầy nhiệt huyết,\n"
    "Vừa giỏi công nghệ, vừa yêu đất đai,\n"
    "Xin chào — đó chính là founder tài ba này! 🌱"
)


def _is_founder_question(message):
    text = message.lower()
    return any(keyword in text for keyword in FOUNDER_KEYWORDS)


def chat_with_ai(message, history=None):
    """
    Chat AI tự do về nông nghiệp / cây trồng.
    history: list các cặp {"role": "user"/"assistant", "content": str} trước đó (tùy chọn).
    """
    if _is_founder_question(message):
        return FOUNDER_INTRO

    if Config.DEMO_MODE:
        return "Đây là câu trả lời demo (chưa kết nối AI thật). Vui lòng cấu hình GEMINI_API_KEY để dùng AI Chat thật."

    genai = _gemini_client()
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        system_instruction=(
            "Bạn là trợ lý AI nông nghiệp của Verdexa AI, trả lời ngắn gọn, hữu ích, bằng tiếng Việt. "
            + NO_THINKING_INSTRUCTION
        ),
    )

    # Gemini dùng role "model" thay vì "assistant", và key "parts" thay vì "content"
    gemini_history = []
    if history:
        for turn in history:
            role = "model" if turn.get("role") == "assistant" else "user"
            gemini_history.append({"role": role, "parts": [turn.get("content", "")]})

    chat = model.start_chat(history=gemini_history)
    response = _send_chat_message(chat, message, max_tokens=800)

    return response.text.strip()


def generate_chat_title(messages):
    """
    Tự đặt tên ngắn gọn (tối đa ~6 từ) cho 1 cuộc trò chuyện dựa trên nội dung.
    messages: list [{"role": "user"/"assistant", "content": str}, ...]
    """
    # Fallback đơn giản: lấy câu hỏi đầu tiên của người dùng, cắt ngắn lại.
    first_user_msg = next(
        (m.get("content", "").strip() for m in messages if m.get("role") == "user" and m.get("content", "").strip()),
        "",
    )
    fallback_title = (first_user_msg[:40] + "…") if len(first_user_msg) > 40 else first_user_msg
    fallback_title = fallback_title or "Cuộc trò chuyện với AI"

    if Config.DEMO_MODE:
        return fallback_title

    try:
        genai = _gemini_client()
        model = genai.GenerativeModel(GEMINI_MODEL)

        transcript = "\n".join(
            f"{'Người dùng' if m.get('role') == 'user' else 'AI'}: {m.get('content', '')}"
            for m in messages
        )[:3000]  # giới hạn độ dài để tiết kiệm token

        prompt = (
            f"{NO_THINKING_INSTRUCTION}\n\n"
            "Dưới đây là 1 đoạn hội thoại giữa người dùng và AI về cây trồng/nông nghiệp:\n\n"
            f"{transcript}\n\n"
            "Hãy đặt 1 tiêu đề NGẮN GỌN (tối đa 6 từ) tóm tắt đúng nội dung chính của đoạn hội thoại này. "
            "Chỉ trả về đúng tiêu đề, không thêm dấu ngoặc kép, không giải thích, không chấm câu cuối."
        )

        response = _generate(model, prompt, max_tokens=30)
        title = response.text.strip().strip('"').strip("'").strip()
        return title or fallback_title
    except Exception:
        return fallback_title
