// ============================================================
// Verdexa AI - store.js
// Hiển thị danh sách sản phẩm trong "Cửa hàng" + cho phép admin
// bấm dấu (+) để đăng sản phẩm mới (kèm ảnh) lên cửa hàng.
// ============================================================

const STORE_CATEGORY_ICONS = {
    "Thuốc trừ sâu": "fa-bug",
    "Thuốc trừ bệnh": "fa-virus",
    "Thuốc trừ cỏ": "fa-seedling",
    "Thuốc trừ chuột": "fa-paw",
    "Thuốc điều hòa sinh trưởng": "fa-chart-line",
    "Chất dẫn dụ côn trùng": "fa-magnet",
    "Thuốc trừ ốc": "fa-worm",
    "Chất hỗ trợ (chất trải)": "fa-flask",
};

function storeFormatPrice(price) {
    if (price === null || price === undefined || price === "") return "Liên hệ";
    const num = Number(price);
    if (isNaN(num)) return "Liên hệ";
    return num.toLocaleString("vi-VN") + "đ";
}

function storeEscapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

function storeBuildAddCard() {
    const card = document.createElement("div");
    card.className = "store-card store-add-card";
    card.id = "storeAddCardBtn";
    card.innerHTML = `
        <i class="fa-solid fa-plus"></i>
        <span>Thêm sản phẩm</span>
    `;
    card.addEventListener("click", storeOpenModal);
    return card;
}

function storeBuildProductCard(product) {
    const icon = STORE_CATEGORY_ICONS[product.category] || "fa-flask-vial";
    const card = document.createElement("div");
    card.className = "store-card store-product-card";

    const imageHtml = product.image
        ? `<div class="store-product-img" style="background-image:url('/uploads/${product.image}')"></div>`
        : `<div class="store-product-img store-product-img-placeholder"><i class="fa-solid ${icon}"></i></div>`;

    card.innerHTML = `
        ${imageHtml}
        <h3>${storeEscapeHtml(product.name)}</h3>
        ${product.category ? `<span class="store-product-category"><i class="fa-solid ${icon}"></i> ${storeEscapeHtml(product.category)}</span>` : ""}
        ${product.description ? `<p class="store-product-desc">${storeEscapeHtml(product.description)}</p>` : ""}
        <div class="store-product-footer">
            <span class="store-product-price">${storeFormatPrice(product.price)}${product.unit ? ` <small>/ ${storeEscapeHtml(product.unit)}</small>` : ""}</span>
            ${typeof IS_ADMIN !== "undefined" && IS_ADMIN ? `<button type="button" class="store-product-delete" title="Xoá sản phẩm"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>
    `;

    if (typeof IS_ADMIN !== "undefined" && IS_ADMIN) {
        const delBtn = card.querySelector(".store-product-delete");
        if (delBtn) {
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                storeDeleteProduct(product.id, card);
            });
        }
    }

    return card;
}

function storeLoadProducts() {
    const grid = document.getElementById("storeGrid");
    const emptyState = document.getElementById("storeEmptyState");
    if (!grid) return;

    fetch("/api/products")
        .then((res) => res.json())
        .then((products) => {
            grid.innerHTML = "";

            if (typeof IS_ADMIN !== "undefined" && IS_ADMIN) {
                grid.appendChild(storeBuildAddCard());
            }

            if (Array.isArray(products) && products.length > 0) {
                if (emptyState) emptyState.style.display = "none";
                products.forEach((p) => grid.appendChild(storeBuildProductCard(p)));
            } else if (emptyState) {
                emptyState.style.display = (typeof IS_ADMIN !== "undefined" && IS_ADMIN) ? "none" : "block";
            }
        })
        .catch(() => {
            if (emptyState) {
                emptyState.style.display = "block";
                emptyState.textContent = "Không thể tải danh sách sản phẩm.";
            }
        });
}

function storeDeleteProduct(id, cardEl) {
    if (!confirm("Xoá sản phẩm này khỏi cửa hàng?")) return;

    fetch(`/api/products/${id}`, { method: "DELETE" })
        .then((res) => res.json())
        .then((data) => {
            if (data.error) {
                alert(data.error);
                return;
            }
            if (cardEl) cardEl.remove();
        })
        .catch(() => alert("Có lỗi khi xoá sản phẩm."));
}

// ===== MODAL THÊM SẢN PHẨM (chỉ tồn tại trong DOM nếu là admin) =====

function storeOpenModal() {
    const overlay = document.getElementById("storeModalOverlay");
    if (overlay) overlay.classList.add("active");
}

function storeCloseModal() {
    const overlay = document.getElementById("storeModalOverlay");
    const form = document.getElementById("storeProductForm");
    const errorEl = document.getElementById("storeFormError");
    if (overlay) overlay.classList.remove("active");
    if (form) form.reset();
    if (errorEl) errorEl.style.display = "none";
}

document.addEventListener("DOMContentLoaded", function () {
    storeLoadProducts();

    const overlay = document.getElementById("storeModalOverlay");
    const closeBtn = document.getElementById("storeModalCloseBtn");
    const form = document.getElementById("storeProductForm");

    if (closeBtn) closeBtn.addEventListener("click", storeCloseModal);

    if (overlay) {
        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) storeCloseModal();
        });
    }

    if (form) {
        form.addEventListener("submit", function (e) {
            e.preventDefault();

            const name = document.getElementById("productName").value.trim();
            const errorEl = document.getElementById("storeFormError");
            const submitBtn = document.getElementById("storeFormSubmitBtn");

            if (!name) {
                errorEl.textContent = "Vui lòng nhập tên sản phẩm.";
                errorEl.style.display = "block";
                return;
            }

            const formData = new FormData();
            formData.append("name", name);
            formData.append("category", document.getElementById("productCategory").value);
            formData.append("price", document.getElementById("productPrice").value);
            formData.append("unit", document.getElementById("productUnit").value);
            formData.append("description", document.getElementById("productDescription").value);

            const imageInput = document.getElementById("productImage");
            if (imageInput.files[0]) {
                formData.append("image", imageInput.files[0]);
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...';

            fetch("/api/products", { method: "POST", body: formData })
                .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    if (!ok) {
                        errorEl.textContent = data.error || "Có lỗi xảy ra, vui lòng thử lại.";
                        errorEl.style.display = "block";
                        return;
                    }
                    storeCloseModal();
                    storeLoadProducts();
                })
                .catch(() => {
                    errorEl.textContent = "Có lỗi xảy ra, vui lòng thử lại.";
                    errorEl.style.display = "block";
                })
                .finally(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Đăng sản phẩm';
                });
        });
    }
});
