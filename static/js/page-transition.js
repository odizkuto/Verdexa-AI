/*=========================================
Verdexa AI
page-transition.js - Hiệu ứng chuyển cảnh mượt giữa các trang
(dùng khi đăng nhập / đăng xuất / đăng ký / điều hướng trang)

Mỗi loại hành động trượt theo một HƯỚNG khác nhau để tạo cảm giác
phân biệt rõ ràng:
    "down"   (mặc định) - chuyển trang thường: phủ từ trên xuống, thoát lên trên
    "login"  - đăng nhập thành công: phủ từ trái sang, thoát về bên phải
    "logout" - đăng xuất: phủ từ phải sang, thoát về bên trái (ngược hướng login)

Vì trang đích được tải lại hoàn toàn (fresh JS context), hướng được lưu
tạm vào sessionStorage để trang mới biết cần "thoát" theo hướng nào.
=========================================*/

(function () {
    var STORAGE_KEY = "pt_direction";

    function getOverlay() {
        return document.getElementById("pageTransitionOverlay");
    }

    /* Khi trang đã tải xong: đọc hướng đã lưu (nếu có) rồi cuộn overlay
       ra theo đúng hướng đó để lộ nội dung ra */
    function ptReveal() {
        var el = getOverlay();
        if (!el) return;

        var direction = "down";
        try {
            direction = sessionStorage.getItem(STORAGE_KEY) || "down";
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) { /* sessionStorage có thể bị chặn - bỏ qua, dùng mặc định */ }

        el.setAttribute("data-direction", direction);

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                el.classList.add("pt-hidden");
            });
        });
    }

    /* Trước khi chuyển trang: phủ overlay che toàn màn hình theo hướng
       chỉ định, lưu hướng lại cho trang đích, rồi mới điều hướng */
    window.ptCoverAndGo = function (url, delay, direction) {
        delay = typeof delay === "number" ? delay : 650;
        direction = direction || "down";

        var el = getOverlay();

        try {
            sessionStorage.setItem(STORAGE_KEY, direction);
        } catch (e) { /* bỏ qua nếu không lưu được */ }

        if (!el) {
            window.location.href = url;
            return;
        }

        el.setAttribute("data-direction", direction);
        el.classList.remove("pt-hidden");

        setTimeout(function () {
            window.location.href = url;
        }, delay);
    };

    if (document.readyState === "complete") {
        ptReveal();
    } else {
        window.addEventListener("load", ptReveal);
    }
})();
