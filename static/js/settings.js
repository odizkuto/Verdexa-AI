/* =========================================================
   VERDEXA AI - settings.js
   Xử lý: hồ sơ người dùng (avatar/tên), sáng-tối, màu chủ đề,
   ngôn ngữ, xoá tài khoản, gộp lịch sử mua hàng vào Cài đặt,
   và tự ẩn/hiện thanh điều hướng dưới khi thao tác.
========================================================= */

(function () {
    "use strict";

    const STORAGE_KEYS = {
        avatar: "verdexa_avatar",
        displayName: "verdexa_display_name",
        darkMode: "verdexa_dark_mode",
        theme: "verdexa_theme",
        lang: "verdexa_lang",
    };

    const SAVED = window.SAVED_PROFILE || {};

    function saveProfileToServer(fields) {
        fetch("/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        }).catch(() => {
            /* mất mạng tạm thời -> vẫn giữ nguyên trên giao diện, thử lại lần sau */
        });
    }

    const DEFAULT_AVATAR =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
            '<rect width="100" height="100" rx="50" fill="#2e7d32"/>' +
            '<text x="50" y="62" font-size="42" text-anchor="middle" fill="#fff" font-family="Poppins,Arial,sans-serif">' +
            (window.CURRENT_USERNAME ? window.CURRENT_USERNAME.charAt(0).toUpperCase() : "V") +
            "</text></svg>"
        );

    /* ---------- 1. HỒ SƠ: AVATAR + TÊN HIỂN THỊ (đồng bộ theo tài khoản) ---------- */

    function initProfile() {
        const avatarImg = document.getElementById("settingsAvatarImg");
        const avatarWrap = document.getElementById("settingsAvatarWrap");
        const avatarInput = document.getElementById("settingsAvatarInput");
        const nameInput = document.getElementById("settingsNameInput");
        const saveHint = document.getElementById("settingsSaveHint");
        if (!avatarImg) return;

        const savedAvatar = SAVED.avatar_data || localStorage.getItem(STORAGE_KEYS.avatar);
        avatarImg.src = savedAvatar || DEFAULT_AVATAR;

        const savedName = SAVED.display_name || localStorage.getItem(STORAGE_KEYS.displayName);
        nameInput.value = savedName || window.CURRENT_USERNAME || "";

        avatarWrap.addEventListener("click", () => avatarInput.click());

        avatarInput.addEventListener("change", () => {
            const file = avatarInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarImg.src = e.target.result;
                localStorage.setItem(STORAGE_KEYS.avatar, e.target.result);
                saveProfileToServer({ avatar_data: e.target.result });
                flashSaveHint(saveHint);
            };
            reader.readAsDataURL(file);
        });

        let nameSaveTimer = null;
        nameInput.addEventListener("input", () => {
            clearTimeout(nameSaveTimer);
            nameSaveTimer = setTimeout(() => {
                const value = nameInput.value.trim();
                localStorage.setItem(STORAGE_KEYS.displayName, value);
                saveProfileToServer({ display_name: value });
                flashSaveHint(saveHint);
            }, 500);
        });
    }

    function flashSaveHint(el) {
        if (!el) return;
        el.classList.add("show");
        setTimeout(() => el.classList.remove("show"), 1600);
    }

    /* ---------- 2. SÁNG / TỐI (đồng bộ theo tài khoản) ---------- */

    function initDarkMode() {
        const toggle = document.getElementById("darkModeToggle");
        // body đã được server render sẵn class dark-mode đúng theo tài khoản,
        // ở đây chỉ cần đồng bộ lại trạng thái công tắc cho khớp.
        const isDark = document.body.classList.contains("dark-mode");
        if (toggle) toggle.checked = isDark;

        if (toggle) {
            toggle.addEventListener("change", () => {
                document.body.classList.toggle("dark-mode", toggle.checked);
                localStorage.setItem(STORAGE_KEYS.darkMode, toggle.checked ? "1" : "0");
                saveProfileToServer({ dark_mode: toggle.checked });
            });
        }
    }

    /* ---------- 3. MÀU CHỦ ĐỀ (PASTEL, đồng bộ theo tài khoản) ---------- */

    function initThemeSwatches() {
        const swatches = document.querySelectorAll(".settings-swatch");
        if (!swatches.length) return;

        // body đã được server render sẵn data-theme đúng theo tài khoản
        const currentTheme = document.body.getAttribute("data-theme") || "green";
        markActiveSwatch(currentTheme, swatches);

        swatches.forEach((btn) => {
            btn.addEventListener("click", () => {
                const theme = btn.dataset.theme;
                localStorage.setItem(STORAGE_KEYS.theme, theme);
                document.body.setAttribute("data-theme", theme);
                markActiveSwatch(theme, swatches);
                saveProfileToServer({ theme });
            });
        });
    }

    function markActiveSwatch(theme, swatches) {
        swatches.forEach((s) => s.classList.toggle("active", s.dataset.theme === theme));
    }

    /* ---------- 4. NGÔN NGỮ (VI / EN) ---------- */

    const I18N = {
        // tooltip thanh điều hướng dưới
        '.bottom-nav-item[data-tab="chat"] .bottom-nav-tooltip': ["Trò chuyện AI", "AI Chat"],
        '.bottom-nav-item[data-tab="store"] .bottom-nav-tooltip': ["Cửa hàng", "Store"],
        '.bottom-nav-item[data-tab="identify"] .bottom-nav-tooltip': ["Nhận diện cây", "Identify plant"],
        '.bottom-nav-item[data-tab="disease"] .bottom-nav-tooltip': ["Bệnh cây", "Plant disease"],
        '.bottom-nav-item[data-tab="library"] .bottom-nav-tooltip': ["Thư viện", "Library"],
        '.bottom-nav-item[data-tab="settings"] .bottom-nav-tooltip': ["Cài đặt", "Settings"],

        // tiêu đề các tab
        "#tab-identify .panel-header h1": ['<i class="fa-solid fa-camera"></i> Nhận diện cây trồng', '<i class="fa-solid fa-camera"></i> Identify plants'],
        "#tab-identify .panel-header p": ["Tải lên hoặc kéo thả ảnh để nhận diện cây trồng bằng AI.", "Upload or drag & drop an image to identify plants with AI."],
        "#tab-disease .panel-header h1": ['<i class="fa-solid fa-virus"></i> Chẩn đoán bệnh', '<i class="fa-solid fa-virus"></i> Disease diagnosis'],
        "#tab-disease .panel-header p": ["Mô tả triệu chứng hoặc tải ảnh lá cây để AI chẩn đoán.", "Describe symptoms or upload a leaf photo for AI diagnosis."],
        "#tab-library .panel-header h1": ['<i class="fa-solid fa-book-open"></i> Thư viện cây trồng', '<i class="fa-solid fa-book-open"></i> Plant library'],
        "#tab-library .panel-header p": ["Nhập tên bất kỳ loại cây nào, AI sẽ tra cứu và tổng hợp thông tin cho bạn.", "Enter any plant name and AI will look it up for you."],
        "#tab-chat .panel-header h1": ['<i class="fa-solid fa-comments"></i> Hỏi AI', '<i class="fa-solid fa-comments"></i> Ask AI'],
        "#tab-chat .panel-header p": ["Hỏi bất cứ điều gì về cây trồng và sâu bệnh.", "Ask anything about plants and pests."],
        "#tab-store .panel-header h1 i + a": null,
        "#tab-store .panel-header p": ["Sản phẩm thuốc bảo vệ thực vật đang được bán.", "Plant-protection products currently for sale."],
        "#tab-settings .panel-header h1": ['<i class="fa-solid fa-gear"></i> Cài đặt', '<i class="fa-solid fa-gear"></i> Settings'],
        "#tab-settings .panel-header p": ["Quản lý tài khoản, giao diện và ngôn ngữ của bạn.", "Manage your account, appearance and language."],

        // khu vực cài đặt
        "#settingsNameInput": null,
        '.settings-section-title:has(i.fa-circle-half-stroke)': ['<i class="fa-solid fa-circle-half-stroke"></i> Giao diện', '<i class="fa-solid fa-circle-half-stroke"></i> Appearance'],
        '.settings-row-label:has(i.fa-moon)': ['<i class="fa-solid fa-moon"></i> Chế độ tối (Dark mode)', '<i class="fa-solid fa-moon"></i> Dark mode'],
        '.settings-section-title:has(i.fa-palette)': ['<i class="fa-solid fa-palette"></i> Màu chủ đề giao diện', '<i class="fa-solid fa-palette"></i> Theme color'],
        '.settings-section-title:has(i.fa-language)': ['<i class="fa-solid fa-language"></i> Ngôn ngữ', '<i class="fa-solid fa-language"></i> Language'],
        "#settingsHistoryToggle span": ['<i class="fa-solid fa-clock-rotate-left" style="color:var(--accent);margin-right:8px;"></i> Lịch sử mua hàng', '<i class="fa-solid fa-clock-rotate-left" style="color:var(--accent);margin-right:8px;"></i> Order history'],
        '.settings-section-title:has(i.fa-triangle-exclamation)': ['<i class="fa-solid fa-triangle-exclamation"></i> Vùng nguy hiểm', '<i class="fa-solid fa-triangle-exclamation"></i> Danger zone'],
        "#settingsDeleteAccountBtn": ['<i class="fa-solid fa-trash"></i> Xoá tài khoản', '<i class="fa-solid fa-trash"></i> Delete account'],
        "#settingsDeleteConfirmBox p": ["Hành động này sẽ xoá vĩnh viễn tài khoản của bạn và không thể hoàn tác. Nhập lại mật khẩu để xác nhận.", "This will permanently delete your account and cannot be undone. Re-enter your password to confirm."],
        "#settingsDeletePasswordInput": null,
        "#settingsDeleteCancelBtn": ["Huỷ", "Cancel"],
        "#settingsDeleteConfirmBtn": ["Xoá vĩnh viễn", "Delete permanently"],
    };

    function applyLang(lang) {
        document.documentElement.lang = lang === "en" ? "en" : "vi";
        Object.keys(I18N).forEach((selector) => {
            const pair = I18N[selector];
            if (!pair) return;
            const el = document.querySelector(selector);
            if (!el) return;
            el.innerHTML = lang === "en" ? pair[1] : pair[0];
        });

        document.querySelectorAll(".settings-lang-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.lang === lang);
        });
    }

    function initLanguage() {
        const buttons = document.querySelectorAll(".settings-lang-btn");
        if (!buttons.length) return;

        const savedLang = SAVED.lang || localStorage.getItem(STORAGE_KEYS.lang) || "vi";
        applyLang(savedLang);

        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const lang = btn.dataset.lang;
                localStorage.setItem(STORAGE_KEYS.lang, lang);
                applyLang(lang);
                saveProfileToServer({ lang });
            });
        });
    }

    /* ---------- 5. LỊCH SỬ MUA HÀNG (thu gọn trong Cài đặt) ---------- */

    function initHistoryCollapse() {
        const toggle = document.getElementById("settingsHistoryToggle");
        const body = document.getElementById("settingsHistoryBody");
        if (!toggle || !body) return;

        toggle.addEventListener("click", () => {
            const isOpen = body.classList.toggle("open");
            toggle.classList.toggle("open", isOpen);
            if (isOpen && typeof storeLoadMyOrders === "function") {
                storeLoadMyOrders();
            }
        });
    }

    /* ---------- 6. XOÁ TÀI KHOẢN ---------- */

    function initDeleteAccount() {
        const deleteBtn = document.getElementById("settingsDeleteAccountBtn");
        const confirmBox = document.getElementById("settingsDeleteConfirmBox");
        const cancelBtn = document.getElementById("settingsDeleteCancelBtn");
        const confirmBtn = document.getElementById("settingsDeleteConfirmBtn");
        const passwordInput = document.getElementById("settingsDeletePasswordInput");
        const errorEl = document.getElementById("settingsDeleteError");
        if (!deleteBtn) return;

        function resetConfirmUI() {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Xoá vĩnh viễn";
            errorEl.style.display = "none";
        }

        deleteBtn.addEventListener("click", () => {
            confirmBox.classList.add("show");
            passwordInput.value = "";
            resetConfirmUI();
        });
        cancelBtn.addEventListener("click", () => confirmBox.classList.remove("show"));

        confirmBtn.addEventListener("click", () => {
            const password = passwordInput.value;
            if (!password) {
                errorEl.textContent = "Vui lòng nhập mật khẩu để xác nhận.";
                errorEl.style.display = "block";
                return;
            }

            confirmBtn.disabled = true;
            confirmBtn.textContent = "Đang xử lý...";
            errorEl.style.display = "none";

            fetch("/api/account/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            })
                .then((res) => res.json().catch(() => ({})))
                .then((data) => {
                    if (data && data.error) {
                        errorEl.textContent = data.error;
                        errorEl.style.display = "block";
                        resetConfirmUI();
                        return;
                    }
                    localStorage.removeItem(STORAGE_KEYS.avatar);
                    localStorage.removeItem(STORAGE_KEYS.displayName);
                    if (window.ptCoverAndGo) {
                        window.ptCoverAndGo("/", 650, "delete-account");
                    } else {
                        window.location.href = "/";
                    }
                })
                .catch(() => {
                    errorEl.textContent = "Không thể xoá tài khoản lúc này. Vui lòng thử lại sau.";
                    errorEl.style.display = "block";
                    resetConfirmUI();
                });
        });
    }

    /* ---------- 7. TỰ ẨN/HIỆN THANH ĐIỀU HƯỚNG DƯỚI ---------- */

    function initAutoHideNav() {
        const wrap = document.getElementById("bottomNavWrap");
        const nav = document.getElementById("bottomNav");
        if (!wrap || !nav) return;

        let hideTimer = null;
        let isHidden = false;

        function hideNav() {
            isHidden = true;
            wrap.classList.add("nav-hidden");
        }

        function showNav() {
            isHidden = false;
            wrap.classList.remove("nav-hidden");
        }

        function scheduleAutoReveal(delay) {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(showNav, delay);
        }

        // Kéo / cuộn / vuốt: ẩn trong lúc đang cuộn, mở lại NGAY khi vừa dừng
        function onScrollLike() {
            hideNav();
            scheduleAutoReveal(150);
        }

        window.addEventListener("scroll", onScrollLike, { passive: true });
        window.addEventListener("wheel", onScrollLike, { passive: true });
        window.addEventListener("touchmove", onScrollLike, { passive: true });

        // Chạm/nhấn (tap) ở bất kỳ đâu ngoài thanh nav: bật/tắt ngay lập tức,
        // để luôn có cách gọi thanh nav ra lại chứ không bị "kẹt" khi ẩn.
        document.addEventListener(
            "pointerdown",
            (e) => {
                const insideNav = e.target && e.target.closest && e.target.closest("#bottomNavWrap");

                if (insideNav) {
                    // Đang thao tác trong chính thanh nav -> luôn giữ hiện, không tự ẩn khi đang bấm
                    showNav();
                    scheduleAutoReveal(3000);
                    return;
                }

                if (isHidden) {
                    showNav();
                    scheduleAutoReveal(2500);
                } else {
                    hideNav();
                    scheduleAutoReveal(1400);
                }
            },
            true
        );

        // Vuốt gần sát mép dưới màn hình -> luôn gọi thanh nav hiện lại ngay
        window.addEventListener(
            "touchmove",
            (e) => {
                const touch = e.touches && e.touches[0];
                if (touch && window.innerHeight - touch.clientY < 70) {
                    showNav();
                    scheduleAutoReveal(2500);
                }
            },
            { passive: true }
        );
    }

    /* ---------- KHỞI CHẠY ---------- */

    document.addEventListener("DOMContentLoaded", () => {
        initProfile();
        initDarkMode();
        initThemeSwatches();
        initLanguage();
        initHistoryCollapse();
        initDeleteAccount();
        initAutoHideNav();
    });
})();
