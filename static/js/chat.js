/*=========================================
Verdexa AI
chat.js - Trò chuyện với AI về nông nghiệp
=========================================*/

const chatHistory = document.getElementById("chatHistory");
const chatInput = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSendBtn");
const chatSavedList = document.getElementById("chatSavedList");
const chatNewBtn = document.getElementById("chatNewBtn");

// Lưu lịch sử hội thoại để gửi kèm cho AI (giúp AI hiểu ngữ cảnh)
let conversation = [];

// id của cuộc trò chuyện đã được tự động lưu (null = chưa lưu lần nào)
let savedChatId = null;

/*============================*/
/* Tự chèn CSS cho hiệu ứng "đang trả lời" (không phụ thuộc style.css,
   tránh trường hợp trình duyệt/host còn cache bản CSS cũ) */

(function injectTypingCursorStyle() {
    if (document.getElementById("typing-cursor-style")) return;
    const style = document.createElement("style");
    style.id = "typing-cursor-style";
    style.textContent = `
        .typewriter-text{white-space:pre-wrap;}
        .typing-cursor{display:inline-block;color:#2e7d32;font-weight:600;animation:typingCursorBlink .85s steps(1) infinite;}
        @keyframes typingCursorBlink{0%,50%{opacity:1;}51%,100%{opacity:0;}}

        .watering-loader{display:inline-flex;align-items:center;padding:2px 0;}

        .wl-can{transform-origin:60px 20px;animation:wlTilt 1.4s ease-in-out infinite;}
        @keyframes wlTilt{0%,100%{transform:rotate(-20deg);}50%{transform:rotate(-28deg);}}

        .wl-drop{opacity:0;animation:wlDropFall 1.4s ease-in infinite;}
        .wl-drop-1{animation-delay:.1s;}
        .wl-drop-2{animation-delay:.4s;}
        .wl-drop-3{animation-delay:.7s;}
        @keyframes wlDropFall{
            0%{opacity:0;transform:translateY(0);}
            12%{opacity:1;}
            65%{opacity:1;transform:translateY(15px);}
            85%{opacity:0;transform:translateY(17px);}
            100%{opacity:0;transform:translateY(17px);}
        }

        .wl-leaf{transform-origin:24px 42px;animation:wlLeafSway 1.4s ease-in-out infinite;}
        .wl-leaf-r{animation-delay:.7s;}
        @keyframes wlLeafSway{0%,100%{transform:rotate(0deg) scale(1);}50%{transform:rotate(4deg) scale(1.05);}}
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
/* Hiệu ứng "gõ chữ dần" (typewriter): hiện text AI trả lời từng ký tự
   một thay vì hiện ngay toàn bộ. Gõ xong mới đổi sang bản đã định dạng
   đầy đủ (đậm, danh sách...) để đảm bảo hiển thị đúng. */

function typewriterReveal(bubble, rawText) {
    return new Promise((resolve) => {
        // Bỏ ký hiệu markdown (**) khi gõ dần, chỉ áp dụng định dạng đậm
        // sau khi gõ xong, tránh hiện dấu ** lộ liễu trong lúc gõ.
        const plainText = rawText.replace(/\*\*(.+?)\*\*/g, "$1");
        const total = plainText.length;

        // Chữ càng dài gõ càng nhanh (8-30ms mỗi ký tự) để không chờ quá lâu
        const perCharDelay = Math.max(8, Math.min(30, Math.round(1400 / Math.max(total, 1))));

        bubble.innerHTML = '<span class="typewriter-text"></span><span class="typing-cursor">▌</span>';
        const textEl = bubble.querySelector(".typewriter-text");

        let i = 0;
        function step() {
            if (i < total) {
                textEl.textContent += plainText[i];
                i++;
                chatHistory.scrollTop = chatHistory.scrollHeight;
                setTimeout(step, perCharDelay);
            } else {
                bubble.innerHTML = formatAiReply(rawText);
                chatHistory.scrollTop = chatHistory.scrollHeight;
                resolve();
            }
        }
        step();
    });
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
/* Hiện ngay 1 mục tạm trong sidebar khi bắt đầu cuộc trò chuyện mới,
   tránh để sidebar hiển thị "Chưa có cuộc trò chuyện nào" trong lúc
   server còn đang tự đặt tên + lưu (có thể mất vài giây). */

function addPendingSidebarItem(tempTitle) {
    const empty = chatSavedList.querySelector(".chat-saved-empty");
    if (empty) empty.remove();

    chatSavedList.querySelectorAll(".chat-saved-item.active").forEach((el) => el.classList.remove("active"));

    const old = document.getElementById("chatSavedPending");
    if (old) old.remove();

    const item = document.createElement("div");
    item.id = "chatSavedPending";
    item.className = "chat-saved-item active chat-saved-item-pending";

    const titleSpan = document.createElement("span");
    titleSpan.className = "chat-saved-title";
    titleSpan.textContent = tempTitle;
    item.appendChild(titleSpan);

    chatSavedList.insertBefore(item, chatSavedList.firstChild);
}

/*============================*/
/* Tự động lưu / cập nhật cuộc trò chuyện vào lịch sử */

async function autoSaveOrUpdateChat() {
    try {
        if (savedChatId === null) {
            // Tin nhắn đầu tiên xong -> tạo bản ghi mới, AI tự đặt tên theo chủ đề
            const res = await fetch("/api/chat/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: conversation }),
            });
            const data = await res.json();
            if (res.ok && data.id) {
                savedChatId = data.id;
                loadSavedChatsList();
            }
        } else {
            // Các tin nhắn sau -> cập nhật vào đúng cuộc trò chuyện đã lưu
            await fetch(`/api/chat/save/${savedChatId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: conversation }),
            });
        }
    } catch (err) {
        // Lưu lịch sử là tính năng phụ trợ, lỗi ở đây không nên làm gián đoạn việc chat
        console.warn("Không thể lưu lịch sử trò chuyện:", err);
    }
}

/*============================*/
/* Hiển thị danh sách các cuộc trò chuyện đã lưu, bấm vào để xem lại */

async function loadSavedChatsList() {
    try {
        const res = await fetch("/api/chat/history");
        const sessions = await res.json();
        if (!res.ok) return;

        if (!Array.isArray(sessions) || sessions.length === 0) {
            chatSavedList.innerHTML = '<p class="chat-saved-empty">Chưa có cuộc trò chuyện nào.</p>';
            return;
        }

        chatSavedList.innerHTML = "";
        sessions.forEach((s) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "chat-saved-item" + (s.id === savedChatId ? " active" : "");
            item.title = s.title;

            const titleSpan = document.createElement("span");
            titleSpan.className = "chat-saved-title";
            titleSpan.textContent = s.title;
            item.appendChild(titleSpan);

            const delBtn = document.createElement("span");
            delBtn.className = "chat-delete-btn";
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.title = "Xoá cuộc trò chuyện";
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteSavedChat(s.id);
            });
            item.appendChild(delBtn);

            item.addEventListener("click", () => loadSavedChat(s.id));
            chatSavedList.appendChild(item);
        });
    } catch (err) {
        console.warn("Không thể tải danh sách lịch sử trò chuyện:", err);
    }
}

async function loadSavedChat(chatId) {
    try {
        const res = await fetch(`/api/chat/history/${chatId}`);
        const data = await res.json();
        if (!res.ok) return;

        chatHistory.innerHTML = "";
        conversation = [];
        data.messages.forEach((m) => {
            if (m.role === "user") {
                appendMessage("user", m.content, false);
            } else {
                appendMessage("bot", formatAiReply(m.content), true);
            }
            conversation.push({ role: m.role, content: m.content });
        });
        savedChatId = data.id;
        loadSavedChatsList();
    } catch (err) {
        console.warn("Không thể mở lại cuộc trò chuyện:", err);
    }
}

/*============================*/
/* Xoá 1 cuộc trò chuyện đã lưu */

async function deleteSavedChat(chatId) {
    try {
        const res = await fetch(`/api/chat/history/${chatId}`, { method: "DELETE" });
        if (!res.ok) return;

        // Nếu đang xem đúng cuộc trò chuyện vừa xoá -> bắt đầu cuộc trò chuyện mới
        if (savedChatId === chatId) {
            startNewChat();
        }
        loadSavedChatsList();
    } catch (err) {
        console.warn("Không thể xoá cuộc trò chuyện:", err);
    }
}

/*============================*/
/* Bắt đầu cuộc trò chuyện mới (giống nút "New chat" của Gemini/ChatGPT) */

function startNewChat() {
    conversation = [];
    savedChatId = null;
    chatHistory.innerHTML = `
        <div class="bot">
            Xin chào 👋 Hôm nay tôi có thể giúp gì cho cây trồng của bạn?
        </div>
        <div class="chat-suggestions" id="chatSuggestions">
            <span class="chat-suggestions-label">Gợi ý câu hỏi</span>
            <div class="chat-suggestions-grid">
                <button type="button" class="chat-suggestion-chip">
                    <i class="fa-solid fa-leaf"></i> Vì sao lá cây bị vàng?
                </button>
                <button type="button" class="chat-suggestion-chip">
                    <i class="fa-solid fa-droplet"></i> Bao lâu tưới nước 1 lần?
                </button>
                <button type="button" class="chat-suggestion-chip">
                    <i class="fa-solid fa-bug"></i> Cách trị rệp sáp trên cây cảnh
                </button>
                <button type="button" class="chat-suggestion-chip">
                    <i class="fa-solid fa-seedling"></i> Loại phân bón nào tốt cho hoa hồng?
                </button>
            </div>
        </div>
    `;
    chatInput.value = "";
    chatInput.focus();
    loadSavedChatsList();
    bindSuggestionChips();
}

if (chatNewBtn) {
    chatNewBtn.addEventListener("click", startNewChat);
}

// Hiện sẵn danh sách lịch sử (nếu có) khi vào lại tab Chat
loadSavedChatsList();

/*============================*/
/* Gửi tin nhắn tới AI */

async function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Khoá ô nhập + nút gửi để tránh gửi chồng nhiều tin khi AI chưa trả lời xong
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    // Đã bắt đầu chat thật -> bỏ khối gợi ý câu hỏi đi cho gọn
    const suggestions = document.getElementById("chatSuggestions");
    if (suggestions) suggestions.remove();

    appendMessage("user", message, false);
    chatInput.value = "";

    // Nếu đây là tin nhắn đầu tiên của cuộc trò chuyện mới -> hiện ngay mục tạm trong sidebar
    if (savedChatId === null && conversation.length === 0) {
        const tempTitle = message.length > 28 ? message.slice(0, 28) + "…" : message;
        addPendingSidebarItem(tempTitle);
    }

    const typingBubble = appendMessage(
        "bot",
        `<span class="watering-loader">
            <svg viewBox="0 0 90 64" width="58" height="42" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="wlCanGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="#66bb6a"/>
                        <stop offset="1" stop-color="#2e7d32"/>
                    </linearGradient>
                    <radialGradient id="wlLeafGrad" cx="35%" cy="30%" r="75%">
                        <stop offset="0" stop-color="#c8f7c5"/>
                        <stop offset="60%" stop-color="#66bb6a"/>
                        <stop offset="100%" stop-color="#1b5e20"/>
                    </radialGradient>
                </defs>

                <ellipse cx="24" cy="58" rx="14" ry="3" fill="#2e7d32" opacity=".15"/>

                <path d="M24 58 C24 48 24 40 24 34" stroke="#2e7d32" stroke-width="3" stroke-linecap="round" fill="none"/>
                <path class="wl-leaf wl-leaf-l" d="M24 42 C14 41 8 34 6 24 C18 25 24 32 24 42 Z" fill="url(#wlLeafGrad)"/>
                <path class="wl-leaf wl-leaf-r" d="M24 42 C34 41 40 34 42 24 C30 25 24 32 24 42 Z" fill="url(#wlLeafGrad)"/>

                <circle class="wl-drop wl-drop-1" cx="25" cy="30" r="1.8" fill="#4fc3f7"/>
                <circle class="wl-drop wl-drop-2" cx="23" cy="30" r="1.8" fill="#4fc3f7"/>
                <circle class="wl-drop wl-drop-3" cx="27" cy="30" r="1.8" fill="#4fc3f7"/>

                <g class="wl-can">
                    <rect x="46" y="10" width="26" height="17" rx="6" fill="url(#wlCanGrad)"/>
                    <path d="M46 15 L30 24 C28 25 28 27 30 27 L46 22 Z" fill="url(#wlCanGrad)"/>
                    <path d="M52 4 C56 -1 64 -1 68 4" stroke="#2e7d32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                    <circle cx="30" cy="25.5" r="1.6" fill="#1b5e20"/>
                </g>
            </svg>
        </span>`,
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

        await typewriterReveal(typingBubble, data.reply);

        // Cập nhật lịch sử hội thoại
        conversation.push({ role: "user", content: message });
        conversation.push({ role: "assistant", content: data.reply });

        // Giới hạn lịch sử gửi đi để tránh quá dài
        if (conversation.length > 20) {
            conversation = conversation.slice(-20);
        }

        // Tự động lưu (lần đầu) hoặc cập nhật (các lần sau) vào lịch sử trò chuyện
        autoSaveOrUpdateChat();
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
/* Chip gợi ý câu hỏi: bấm vào là điền câu hỏi và gửi luôn */

function bindSuggestionChips() {
    document.querySelectorAll(".chat-suggestion-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            chatInput.value = chip.textContent.trim();
            sendChatMessage();
        });
    });
}

bindSuggestionChips();

/*============================*/
/* Sự kiện gửi tin nhắn */

chatSendBtn.addEventListener("click", sendChatMessage);

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        sendChatMessage();
    }
});
