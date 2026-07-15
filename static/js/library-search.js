/*=========================================
Verdexa AI
library-search.js - Tìm kiếm thông tin cây bất kỳ bằng AI (tab Thư viện)
=========================================*/

const librarySearchInput = document.getElementById("librarySearchInput");
const librarySearchBtn = document.getElementById("librarySearchBtn");
const librarySearchResult = document.getElementById("librarySearchResult");
const libraryEmptyState = document.getElementById("libraryEmptyState");

/*============================*/
/* Chống XSS: escape chữ do AI trả về trước khi chèn vào innerHTML */

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

/*============================*/
/* Hiển thị trạng thái đang tìm / lỗi / kết quả */

function renderLibraryLoading() {
    librarySearchResult.innerHTML = `
        <div class="search-loading">
            <i class="fa-solid fa-spinner fa-spin"></i>
            AI đang tra cứu thông tin, vui lòng chờ trong giây lát...
        </div>
    `;
}

function renderLibraryError(message) {
    librarySearchResult.innerHTML = `
        <div class="search-error">
            <i class="fa-solid fa-triangle-exclamation"></i>
            ${escapeHtml(message || "Không thể tìm kiếm lúc này.")}
        </div>
    `;
}

function renderLibraryResult(data) {
    const diseases = (data.common_diseases || "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean);

    const diseaseTagsHtml = diseases.length
        ? `<div class="disease-tags">${diseases
              .map((d) => `<span class="disease-tag">${escapeHtml(d)}</span>`)
              .join("")}</div>`
        : "";

    const familyHtml = data.family
        ? `
            <div class="info-item">
                <i class="fa-solid fa-sitemap"></i>
                <div>
                    <div class="label">Họ thực vật</div>
                    <div class="value">${escapeHtml(data.family)}</div>
                </div>
            </div>`
        : "";

    librarySearchResult.innerHTML = `
        <div class="neon-frame neon-active">
        <div class="search-result-card">
            <img src="${escapeHtml(data.image)}"
                 onerror="this.src='https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80'">
            <div class="search-result-body">
                <span class="badge">${escapeHtml(data.category || "Cây trồng")}</span>
                <h3>${escapeHtml(data.name)}</h3>
                <p class="desc">${escapeHtml(data.description || "Chưa có mô tả.")}</p>
                <div class="info-grid">
                    <div class="info-item">
                        <i class="fa-solid fa-temperature-half"></i>
                        <div>
                            <div class="label">Nhiệt độ</div>
                            <div class="value">${escapeHtml(data.temperature || "—")}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fa-solid fa-clock"></i>
                        <div>
                            <div class="label">Thời gian thu hoạch</div>
                            <div class="value">${escapeHtml(data.harvest_time || "—")}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fa-solid fa-droplet"></i>
                        <div>
                            <div class="label">Nhu cầu nước</div>
                            <div class="value">${escapeHtml(data.water_need || "—")}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fa-solid fa-flask"></i>
                        <div>
                            <div class="label">Phân bón</div>
                            <div class="value">${escapeHtml(data.fertilizer || "—")}</div>
                        </div>
                    </div>
                    ${familyHtml}
                </div>
                ${diseaseTagsHtml}
            </div>
        </div>
        </div>
    `;
}

/*============================*/
/* Gọi API /api/plant-search */

async function runLibrarySearch() {
    const name = librarySearchInput.value.trim();

    if (!name) {
        alert("Vui lòng nhập tên cây cần tìm kiếm.");
        return;
    }

    if (libraryEmptyState) {
        libraryEmptyState.style.display = "none";
    }

    renderLibraryLoading();

    try {
        const response = await fetch(`/api/plant-search?name=${encodeURIComponent(name)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Có lỗi xảy ra khi tìm kiếm.");
        }

        renderLibraryResult(data);
    } catch (err) {
        renderLibraryError(err.message);
    }
}

librarySearchBtn.addEventListener("click", runLibrarySearch);

librarySearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        runLibrarySearch();
    }
});

/*============================*/
/* Chip gợi ý: bấm vào là điền tên cây và tìm luôn */

document.querySelectorAll(".library-suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
        librarySearchInput.value = chip.textContent.trim();
        runLibrarySearch();
    });
});
