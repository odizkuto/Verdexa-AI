"""
Verdexa AI - mailer.py
Gửi email bằng Resend (https://resend.com) qua HTTP API — không cần SMTP.

Cấu hình đọc từ config.py (biến môi trường trong apikey.env):
    RESEND_API_KEY   - API key của Resend (vd: re_xxxxxxxx)
    MAIL_FROM_EMAIL   - địa chỉ gửi (vd: onboarding@resend.dev hoặc email theo domain đã verify)
    MAIL_SENDER_NAME  - tên hiển thị người gửi (vd: Verdexa AI)

Nếu chưa cấu hình RESEND_API_KEY, hàm send_password_reset_email() sẽ KHÔNG
gửi email thật mà chỉ in link đặt lại mật khẩu ra console — tiện để test local.
"""

import requests

from config import Config

RESEND_API_URL = "https://api.resend.com/emails"


def send_password_reset_email(to_email, username, reset_link):
    """
    Gửi email đặt lại mật khẩu tới to_email.
    Trả về True nếu gửi thành công (hoặc ở demo mode), raise Exception nếu lỗi thật sự.
    """

    # Chưa cấu hình Resend -> chỉ log ra console để test local, không raise lỗi
    if not Config.MAIL_CONFIGURED:
        print("=" * 60)
        print("[MAILER] RESEND_API_KEY chưa được cấu hình — demo mode.")
        print(f"[MAILER] Link đặt lại mật khẩu cho {to_email}: {reset_link}")
        print("=" * 60)
        return True

    subject = "Đặt lại mật khẩu - Verdexa AI"
    html_body = _build_reset_email_html(username, reset_link)

    payload = {
        "from": f"{Config.MAIL_SENDER_NAME} <{Config.MAIL_FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }

    headers = {
        "Authorization": f"Bearer {Config.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    response = requests.post(RESEND_API_URL, json=payload, headers=headers, timeout=15)

    if response.status_code >= 400:
        # In chi tiết lỗi trả về từ Resend để dễ debug (vd: domain chưa verify, API key sai...)
        raise RuntimeError(
            f"Resend trả về lỗi {response.status_code}: {response.text}"
        )

    return True


def _build_reset_email_html(username, reset_link):
    """Tạo nội dung HTML cho email đặt lại mật khẩu."""
    safe_username = username or "bạn"
    return f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;
                background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eee;">
        <div style="background:linear-gradient(135deg,#2e7d32,#43a047);padding:28px 24px;text-align:center;">
            <span style="color:#fff;font-size:22px;font-weight:700;">🌱 Verdexa AI</span>
        </div>
        <div style="padding:32px 28px;">
            <h2 style="color:#1b1b1b;margin:0 0 12px;">Đặt lại mật khẩu</h2>
            <p style="color:#555;line-height:1.6;margin:0 0 20px;">
                Xin chào <strong>{safe_username}</strong>,<br><br>
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại Verdexa AI.
                Nhấn vào nút bên dưới để đặt mật khẩu mới. Liên kết này có hiệu lực trong
                <strong>30 phút</strong>.
            </p>
            <div style="text-align:center;margin:28px 0;">
                <a href="{reset_link}"
                   style="background:#2e7d32;color:#fff;text-decoration:none;padding:14px 32px;
                          border-radius:12px;font-weight:600;display:inline-block;">
                    Đặt lại mật khẩu
                </a>
            </div>
            <p style="color:#888;font-size:13px;line-height:1.6;">
                Nếu bạn không yêu cầu điều này, bạn có thể bỏ qua email này —
                mật khẩu của bạn sẽ không bị thay đổi.<br><br>
                Nếu nút bên trên không hoạt động, hãy sao chép liên kết sau vào trình duyệt:<br>
                <a href="{reset_link}" style="color:#2e7d32;word-break:break-all;">{reset_link}</a>
            </p>
        </div>
        <div style="background:#f7f7f7;padding:16px;text-align:center;color:#999;font-size:12px;">
            © Verdexa AI — Trợ lý chăm sóc cây trồng thông minh
        </div>
    </div>
    """
