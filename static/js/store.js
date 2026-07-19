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

    const orderCount = Number(product.order_count || 0);
    const badgeHtml = orderCount > 0
        ? `<span class="store-product-badge"><i class="fa-solid fa-fire"></i> Đã bán ${orderCount}</span>`
        : "";

    const imageHtml = product.image
        ? `<div class="store-product-img" style="background-image:url('/uploads/${product.image}')">${badgeHtml}</div>`
        : `<div class="store-product-img store-product-img-placeholder"><i class="fa-solid ${icon}"></i>${badgeHtml}</div>`;

    card.innerHTML = `
        ${imageHtml}
        <h3>${storeEscapeHtml(product.name)}</h3>
        ${product.category ? `<span class="store-product-category"><i class="fa-solid ${icon}"></i> ${storeEscapeHtml(product.category)}</span>` : ""}
        ${product.description ? `<p class="store-product-desc">${storeEscapeHtml(product.description)}</p>` : ""}
        <div class="store-product-footer">
            <span class="store-product-price">${storeFormatPrice(product.price)}${product.unit ? ` <small>/ ${storeEscapeHtml(product.unit)}</small>` : ""}</span>
            ${typeof IS_ADMIN !== "undefined" && IS_ADMIN ? `<button type="button" class="store-product-delete" title="Xoá sản phẩm"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>
        <div class="store-product-buy-wrap">
            <button type="button" class="store-buy-btn" data-product-id="${product.id}" aria-label="Mua ${storeEscapeHtml(product.name)}"></button>
        </div>
    `;

    const buyBtn = card.querySelector(".store-buy-btn");
    if (buyBtn) {
        buyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            storeOpenOrderModal(product);
        });
    }

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

let storeAllProducts = [];

function storeLoadProducts() {
    const grid = document.getElementById("storeGrid");
    if (!grid) return;

    fetch("/api/products")
        .then((res) => res.json())
        .then((products) => {
            storeAllProducts = Array.isArray(products) ? products : [];
            storeRenderFilteredProducts();
        })
        .catch(() => {
            const emptyState = document.getElementById("storeEmptyState");
            if (emptyState) {
                emptyState.style.display = "block";
                emptyState.textContent = "Không thể tải danh sách sản phẩm.";
            }
        });
}

function storeNormalizeText(str) {
    return (str || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function storeRenderFilteredProducts() {
    const grid = document.getElementById("storeGrid");
    const emptyState = document.getElementById("storeEmptyState");
    if (!grid) return;

    const searchInput = document.getElementById("storeSearchInput");
    const categorySelect = document.getElementById("storeCategoryFilter");
    const searchTerm = storeNormalizeText(searchInput ? searchInput.value.trim() : "");
    const category = categorySelect ? categorySelect.value : "";

    const filtered = storeAllProducts.filter((p) => {
        const matchesSearch = !searchTerm || storeNormalizeText(p.name).includes(searchTerm);
        const matchesCategory = !category || p.category === category;
        return matchesSearch && matchesCategory;
    });

    grid.innerHTML = "";

    if (typeof IS_ADMIN !== "undefined" && IS_ADMIN) {
        grid.appendChild(storeBuildAddCard());
    }

    if (filtered.length > 0) {
        if (emptyState) emptyState.style.display = "none";
        filtered.forEach((p) => grid.appendChild(storeBuildProductCard(p)));
    } else if (emptyState) {
        emptyState.style.display = (typeof IS_ADMIN !== "undefined" && IS_ADMIN) ? "none" : "block";
        emptyState.innerHTML = storeAllProducts.length === 0
            ? '<i class="fa-solid fa-box-open"></i><br>Cửa hàng chưa có sản phẩm nào.'
            : '<i class="fa-solid fa-magnifying-glass"></i><br>Không tìm thấy sản phẩm phù hợp.';
    }
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
            storeAllProducts = storeAllProducts.filter((p) => p.id !== id);
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
    storeResetImagePreview();
}

function storeResetImagePreview() {
    const preview = document.getElementById("storeImagePreview");
    const placeholder = document.getElementById("storeImageUploadPlaceholder");
    const removeBtn = document.getElementById("storeImageRemoveBtn");
    if (preview) { preview.style.display = "none"; preview.src = ""; }
    if (placeholder) placeholder.style.display = "flex";
    if (removeBtn) removeBtn.style.display = "none";
}

// ===== MODAL MUA HÀNG (hiện cho tất cả mọi người) =====

let storeSelectedProduct = null;

function storeOpenOrderModal(product) {
    storeSelectedProduct = product;
    const overlay = document.getElementById("storeOrderModalOverlay");
    const nameEl = document.getElementById("storeOrderProductName");
    if (nameEl) nameEl.textContent = `Sản phẩm: ${product.name}`;
    if (overlay) overlay.classList.add("active");

    // Khoá SĐT theo số đã đăng ký tài khoản để tránh spam đơn rác bằng SĐT giả
    const phoneInput = document.getElementById("orderCustomerPhone");
    const phoneHint = document.getElementById("orderPhoneHint");
    if (phoneInput && typeof USER_PHONE !== "undefined" && USER_PHONE) {
        phoneInput.value = USER_PHONE;
        phoneInput.readOnly = true;
        if (phoneHint) phoneHint.style.display = "flex";
    } else if (phoneInput) {
        phoneInput.readOnly = false;
        if (phoneHint) phoneHint.style.display = "none";
    }
}

function storeCloseOrderModal() {
    const overlay = document.getElementById("storeOrderModalOverlay");
    const form = document.getElementById("storeOrderForm");
    const errorEl = document.getElementById("storeOrderFormError");
    const successEl = document.getElementById("storeOrderFormSuccess");
    const phoneInput = document.getElementById("orderCustomerPhone");
    const phoneHint = document.getElementById("orderPhoneHint");
    if (overlay) overlay.classList.remove("active");
    if (form) { form.reset(); form.style.display = "block"; }
    if (errorEl) errorEl.style.display = "none";
    if (successEl) successEl.style.display = "none";
    if (phoneInput) phoneInput.readOnly = false;
    if (phoneHint) phoneHint.style.display = "none";
    storeSelectedProduct = null;
}

function storeFormatOrderTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function storeBuildOrderCard(order) {
    const card = document.createElement("div");
    card.className = "store-order-card";
    card.dataset.orderId = order.id;
    card.innerHTML = `
        <div class="store-order-card-top">
            <span class="store-order-product">${storeEscapeHtml(order.product_name || "Sản phẩm không xác định")}</span>
            <span class="store-order-time">${storeFormatOrderTime(order.created_at)}</span>
        </div>
        <div class="store-order-info">
            <div><b>Khách hàng:</b> ${storeEscapeHtml(order.customer_name)}</div>
            <div><b>SĐT:</b> <a href="tel:${storeEscapeHtml(order.customer_phone)}">${storeEscapeHtml(order.customer_phone)}</a></div>
            <div><b>Số lượng:</b> ${storeEscapeHtml(String(order.quantity || 1))}</div>
        </div>
        <div class="store-order-card-actions">
            <button type="button" class="store-order-delete-btn">
                <i class="fa-solid fa-check"></i> Đã xử lý / Xoá
            </button>
        </div>
    `;

    card.querySelector(".store-order-delete-btn").addEventListener("click", function () {
        fetch(`/api/orders/${order.id}`, { method: "DELETE" })
            .then((res) => res.json())
            .then(() => {
                card.remove();
                const list = document.getElementById("storeOrdersList");
                const empty = document.getElementById("storeOrdersEmpty");
                if (list && empty && list.children.length === 0) {
                    empty.style.display = "block";
                }
            });
    });

    return card;
}

function storeRenderOrders(orders) {
    const list = document.getElementById("storeOrdersList");
    const empty = document.getElementById("storeOrdersEmpty");
    if (!list) return;

    list.innerHTML = "";
    if (!orders || orders.length === 0) {
        if (empty) empty.style.display = "block";
        return;
    }
    if (empty) empty.style.display = "none";
    orders.forEach((order) => list.appendChild(storeBuildOrderCard(order)));
}

function storeUpdateOrdersBadge(orders) {
    const badge = document.getElementById("storeOrdersBadge");
    if (!badge) return;

    const lastSeenId = Number(localStorage.getItem("verdexaOrdersLastSeenId") || 0);
    const newCount = orders.filter((o) => o.id > lastSeenId).length;

    if (newCount > 0) {
        badge.textContent = newCount > 99 ? "99+" : String(newCount);
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

function storeFetchOrders(callback) {
    fetch("/api/orders")
        .then((res) => (res.ok ? res.json() : []))
        .then((orders) => {
            if (typeof callback === "function") callback(orders);
        })
        .catch(() => {});
}

function storeOpenOrdersModal() {
    const overlay = document.getElementById("storeOrdersModalOverlay");
    if (!overlay) return;
    overlay.classList.add("active");

    storeFetchOrders(function (orders) {
        storeRenderOrders(orders);
        const maxId = orders.reduce((max, o) => Math.max(max, o.id || 0), 0);
        if (maxId > 0) localStorage.setItem("verdexaOrdersLastSeenId", String(maxId));
        const badge = document.getElementById("storeOrdersBadge");
        if (badge) badge.style.display = "none";
    });
}

function storeCloseOrdersModal() {
    const overlay = document.getElementById("storeOrdersModalOverlay");
    if (overlay) overlay.classList.remove("active");
}

function storePollOrdersBadge() {
    if (typeof IS_ADMIN === "undefined" || !IS_ADMIN) return;
    storeFetchOrders(storeUpdateOrdersBadge);
}

function storeBuildMyOrderCard(order) {
    const card = document.createElement("div");
    card.className = "store-order-card";
    card.innerHTML = `
        <div class="store-order-card-top">
            <span class="store-order-product">${storeEscapeHtml(order.product_name || "Sản phẩm không xác định")}</span>
            <span class="store-order-time">${storeFormatOrderTime(order.created_at)}</span>
        </div>
        <div class="store-order-info">
            <div><b>SĐT liên hệ:</b> ${storeEscapeHtml(order.customer_phone)}</div>
            <div><b>Số lượng:</b> ${storeEscapeHtml(String(order.quantity || 1))}</div>
        </div>
    `;
    return card;
}

function storeLoadMyOrders() {
    const list = document.getElementById("myOrdersList");
    const empty = document.getElementById("myOrdersEmpty");
    if (!list) return;

    fetch("/api/orders/mine")
        .then((res) => (res.ok ? res.json() : []))
        .then((orders) => {
            list.innerHTML = "";
            if (!orders || orders.length === 0) {
                if (empty) empty.style.display = "block";
                return;
            }
            if (empty) empty.style.display = "none";
            orders.forEach((order) => list.appendChild(storeBuildMyOrderCard(order)));
        })
        .catch(() => {
            if (empty) {
                empty.style.display = "block";
                empty.textContent = "Không thể tải lịch sử mua hàng.";
            }
        });
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

    // ---- Khung upload ảnh có xem trước (chỉ tồn tại nếu là admin) ----
    const imageUploadBox = document.getElementById("storeImageUpload");
    const imageInput = document.getElementById("productImage");
    const imagePreview = document.getElementById("storeImagePreview");
    const imagePlaceholder = document.getElementById("storeImageUploadPlaceholder");
    const imageRemoveBtn = document.getElementById("storeImageRemoveBtn");

    if (imageUploadBox && imageInput) {
        imageUploadBox.addEventListener("click", (e) => {
            if (e.target.closest("#storeImageRemoveBtn")) return;
            imageInput.click();
        });

        imageInput.addEventListener("change", () => {
            const file = imageInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = "block";
                imagePlaceholder.style.display = "none";
                imageRemoveBtn.style.display = "flex";
            };
            reader.readAsDataURL(file);
        });

        // Kéo & thả ảnh vào khung
        imageUploadBox.addEventListener("dragover", (e) => {
            e.preventDefault();
            imageUploadBox.classList.add("dragover");
        });
        imageUploadBox.addEventListener("dragleave", () => {
            imageUploadBox.classList.remove("dragover");
        });
        imageUploadBox.addEventListener("drop", (e) => {
            e.preventDefault();
            imageUploadBox.classList.remove("dragover");
            if (e.dataTransfer.files[0]) {
                imageInput.files = e.dataTransfer.files;
                imageInput.dispatchEvent(new Event("change"));
            }
        });
    }

    if (imageRemoveBtn) {
        imageRemoveBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            imageInput.value = "";
            storeResetImagePreview();
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

            if (imageInput && imageInput.files[0]) {
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

    // ---- Modal Mua hàng ----
    const orderOverlay = document.getElementById("storeOrderModalOverlay");
    const orderCloseBtn = document.getElementById("storeOrderModalCloseBtn");
    const orderForm = document.getElementById("storeOrderForm");

    if (orderCloseBtn) orderCloseBtn.addEventListener("click", storeCloseOrderModal);

    if (orderOverlay) {
        orderOverlay.addEventListener("click", function (e) {
            if (e.target === orderOverlay) storeCloseOrderModal();
        });
    }

    if (orderForm) {
        orderForm.addEventListener("submit", function (e) {
            e.preventDefault();

            const customerName = document.getElementById("orderCustomerName").value.trim();
            const customerPhone = document.getElementById("orderCustomerPhone").value.trim();
            const quantity = document.getElementById("orderQuantity").value || 1;
            const errorEl = document.getElementById("storeOrderFormError");
            const successEl = document.getElementById("storeOrderFormSuccess");
            const submitBtn = document.getElementById("storeOrderSubmitBtn");

            errorEl.style.display = "none";

            if (!customerName || !customerPhone) {
                errorEl.textContent = "Vui lòng nhập đầy đủ họ tên và số điện thoại.";
                errorEl.style.display = "block";
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';

            fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_id: storeSelectedProduct ? storeSelectedProduct.id : null,
                    product_name: storeSelectedProduct ? storeSelectedProduct.name : "",
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    quantity: quantity,
                }),
            })
                .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    if (!ok) {
                        errorEl.textContent = data.error || "Có lỗi xảy ra, vui lòng thử lại.";
                        errorEl.style.display = "block";
                        return;
                    }
                    orderForm.style.display = "none";
                    successEl.style.display = "block";

                    if (storeSelectedProduct) {
                        const boughtBtn = document.querySelector(
                            `.store-buy-btn[data-product-id="${storeSelectedProduct.id}"]`
                        );
                        if (boughtBtn) {
                            boughtBtn.classList.add("bought");
                            setTimeout(() => boughtBtn.classList.remove("bought"), 5000);
                        }
                    }

                    setTimeout(storeCloseOrderModal, 2200);
                })
                .catch(() => {
                    errorEl.textContent = "Có lỗi xảy ra, vui lòng thử lại.";
                    errorEl.style.display = "block";
                })
                .finally(() => {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi yêu cầu mua';
                });
        });
    }

    // ---- Modal Đơn đặt hàng (admin) ----
    const ordersBtn = document.getElementById("storeOrdersBtn");
    const ordersOverlay = document.getElementById("storeOrdersModalOverlay");
    const ordersCloseBtn = document.getElementById("storeOrdersModalCloseBtn");

    if (ordersBtn) ordersBtn.addEventListener("click", storeOpenOrdersModal);
    if (ordersCloseBtn) ordersCloseBtn.addEventListener("click", storeCloseOrdersModal);
    if (ordersOverlay) {
        ordersOverlay.addEventListener("click", function (e) {
            if (e.target === ordersOverlay) storeCloseOrdersModal();
        });
    }

    if (typeof IS_ADMIN !== "undefined" && IS_ADMIN) {
        storePollOrdersBadge();
        setInterval(storePollOrdersBadge, 30000);
    }

    // ---- Tìm kiếm + lọc theo loại thuốc ----
    const searchInput = document.getElementById("storeSearchInput");
    const categoryFilter = document.getElementById("storeCategoryFilter");
    let storeSearchDebounce = null;

    if (searchInput) {
        searchInput.addEventListener("input", function () {
            clearTimeout(storeSearchDebounce);
            storeSearchDebounce = setTimeout(storeRenderFilteredProducts, 200);
        });
    }
    if (categoryFilter) {
        categoryFilter.addEventListener("change", storeRenderFilteredProducts);
    }
});
