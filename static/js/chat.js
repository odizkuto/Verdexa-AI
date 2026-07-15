/*=========================================
Verdexa AI
chat.js - Trò chuyện với AI về nông nghiệp
=========================================*/

const chatHistory = document.getElementById("chatHistory");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");

// Lưu lịch sử hội thoại để gửi kèm cho AI (giúp AI hiểu ngữ cảnh)
let conversation = [];

/*============================*/
/* Tự chèn CSS cho hiệu ứng "đang trả lời" (không phụ thuộc style.css,
   tránh trường hợp trình duyệt/host còn cache bản CSS cũ) */

(function injectTypingDotsStyle() {
    if (document.getElementById("typing-dots-style")) return;
    const style = document.createElement("style");
    style.id = "typing-dots-style";
    style.textContent = `
        .typing-dots{display:flex;align-items:center;gap:5px;padding:4px 2px;}
        .typing-dots span{width:8px;height:8px;border-radius:50%;background:#2e7d32;opacity:.4;display:inline-block;animation:typingBounce 1.2s infinite ease-in-out;}
        .typing-dots span:nth-child(2){animation-delay:.2s;}
        .typing-dots span:nth-child(3){animation-delay:.4s;}
        @keyframes typingBounce{0%,60%,100%{transform:translateY(0);opacity:.4;}30%{transform:translateY(-6px);opacity:1;}}
    `;
    document.head.appendChild(style);
})();

/*============================*/
/* Escape HTML để tránh AI (hoặc user) chèn code lạ vào trang */

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/*============================*/
/* Chuyển text markdown đơn giản từ AI (bold, danh sách số) sang HTML gọn gàng */

function formatAiReply(rawText) {
    let text = escapeHtml(rawText);

    // Nếu AI viết danh sách đánh số liền trong 1 dòng (không xuống dòng),
    // tự tách "1. **Tiêu đề:**" thành từng dòng riêng trước khi xử lý tiếp.
    text = text.replace(/(?:^|\s)(\d+)\.\s+(?=\*\*)/g, "\n$1. ");

    // In đậm: **chữ** -> <strong>chữ</strong>
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

    // Nếu đa số các dòng bắt đầu bằng "số." -> render thành danh sách <ol>
    const numbered = lines.filter((l) => /^\d+\.\s/.test(l));
    if (numbered.length >= 2 && numbered.length === lines.length) {
        const items = lines.map((l) => l.replace(/^\d+\.\s*/, "")).map((l) => `<li>${l}</li>`).join("");
        return `<ol>${items}</ol>`;
    }

    // Ngược lại render thành các đoạn văn, giữ dòng đánh số nếu có xen kẽ
    return lines.map((l) => `<p>${l}</p>`).join("");
}

/*============================*/
/* Thêm 1 dòng chat vào khung hiển thị */

function appendMessage(role, content, isHtml) {
    const bubble = document.createElement("div");
    bubble.className = role === "user" ? "user" : "bot";
    if (isHtml) {
        bubble.innerHTML = content;
    } else {
        bubble.textContent = content;
    }
    chatHistory.appendChild(bubble);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return bubble;
}

/*============================*/
/* Gửi tin nhắn tới AI */

async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Khoá ô nhập + nút gửi để tránh gửi chồng nhiều tin khi AI chưa trả lời xong
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    appendMessage("user", message, false);
    chatInput.value = "";

    const typingBubble = appendMessage(
        "bot",
        '<div class="typing-dots"><span></span><span></span><span></span></div>',
        true
    );

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message, history: conversation }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Có lỗi xảy ra khi trò chuyện với AI.");
        }

        typingBubble.innerHTML = formatAiReply(data.reply);

        // Cập nhật lịch sử hội thoại
        conversation.push({ role: "user", content: message });
        conversation.push({ role: "assistant", content: data.reply });

        // Giới hạn lịch sử gửi đi để tránh quá dài
        if (conversation.length > 20) {
            conversation = conversation.slice(-20);
        }
    } catch (err) {
        typingBubble.textContent = err.message || "Không thể kết nối tới máy chủ AI.";
    } finally {
        // Mở khoá lại ô nhập sau khi AI trả lời xong (dù thành công hay lỗi)
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatInput.focus();
    }
}

/*============================*/
/* Sự kiện gửi tin nhắn */

chatSendBtn.addEventListener("click", sendChatMessage);

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendChatMessage();
    }
});
