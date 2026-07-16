/*=========================================
Verdexa AI
page-transition.js - Hiệu ứng chuyển cảnh mượt giữa các trang
(dùng khi đăng nhập / đăng ký thành công và khi trang đích tải xong)
=========================================*/

(function () {
    function getOverlay() {
        return document.getElementById("pageTransitionOverlay");
    }

    /* Khi trang đã tải xong: cuộn overlay lên để lộ nội dung ra */
    function ptReveal() {
        const el = getOverlay();
        if (!el) return;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.classList.add("pt-hidden");
            });
        });
    }

    /* Trước khi chuyển trang: phủ overlay xuống che toàn màn hình, rồi mới điều hướng */
    window.ptCoverAndGo = function (url, delay = 650) {
        const el = getOverlay();
        if (!el) {
            window.location.href = url;
            return;
        }

        el.classList.remove("pt-hidden");

        setTimeout(() => {
            window.location.href = url;
        }, delay);
    };

    if (document.readyState === "complete") {
        ptReveal();
    } else {
        window.addEventListener("load", ptReveal);
    }
})();
