/*=========================================
Verdexa AI
script.js - Nhận diện cây trồng (chọn ảnh / kéo-thả / xem trước / gọi AI)
=========================================*/

const uploadBox = document.getElementById("uploadBox");
const uploadBtn = document.getElementById("uploadBtn");
const imageInput = document.getElementById("imageInput");
const cameraBtn = document.getElementById("cameraBtn");
const cameraInput = document.getElementById("cameraInput");
const removeImageBtn = document.getElementById("removeImageBtn");

const previewImage = document.getElementById("previewImage");
const scanOverlay = document.getElementById("scanOverlay");
const plantName = document.getElementById("plantName");
const confidenceEl = document.getElementById("confidence");
const plantDescription = document.getElementById("plantDescription");

let selectedFile = null;

/*============================*/
/* Hiển thị ảnh đã chọn ngay trong khung upload phía trên */

function setSelectedFile(file) {
    if (!file || !file.type.startsWith("image/")) {
        alert("Vui lòng chọn một tệp ảnh hợp lệ.");
        return;
    }

    selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        uploadBox.classList.add("has-image");
        // Có ảnh hợp lệ -> tự động quét luôn, không cần bấm nút
        analyzeSelectedImage();
    };
    reader.readAsDataURL(file);
}

/*============================*/
/* Bấm "Đổi ảnh khác" -> quay lại trạng thái chưa chọn ảnh */

function clearSelectedFile() {
    selectedFile = null;
    previewImage.src = "";
    imageInput.value = "";
    cameraInput.value = "";
    uploadBox.classList.remove("has-image");

    plantName.innerHTML = "Chưa có kết quả";
    confidenceEl.innerHTML = "--";
    plantDescription.innerHTML = "Tải ảnh lên để xem kết quả nhận diện AI tại đây.";
}

if (removeImageBtn) {
    removeImageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearSelectedFile();
    });
}

/*============================*/
/* Bấm "Chọn ảnh" -> mở hộp thoại chọn tệp */

uploadBtn.addEventListener("click", () => {
    imageInput.click();
});

imageInput.addEventListener("change", () => {
    if (imageInput.files.length > 0) {
        setSelectedFile(imageInput.files[0]);
    }
});

/*============================*/
/* Bấm "Chụp ảnh" -> mở camera trực tiếp (trên điện thoại), ảnh chụp được tự động nạp vào khung xem trước */

cameraBtn.addEventListener("click", () => {
    cameraInput.click();
});

cameraInput.addEventListener("change", () => {
    if (cameraInput.files.length > 0) {
        setSelectedFile(cameraInput.files[0]);
    }
});

/*============================*/
/* Kéo & thả ảnh vào khung upload */

uploadBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = "#2e7d32";
    uploadBox.style.background = "rgba(46,125,50,0.06)";
});

uploadBox.addEventListener("dragleave", () => {
    uploadBox.style.borderColor = "";
    uploadBox.style.background = "";
});

uploadBox.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadBox.style.borderColor = "";
    uploadBox.style.background = "";

    if (e.dataTransfer.files.length > 0) {
        setSelectedFile(e.dataTransfer.files[0]);
    }
});

/*============================*/
/* Hiển thị kết quả / trạng thái */

function showResultLoading() {
    plantName.innerHTML = "Đang phân tích...";
    confidenceEl.innerHTML = "...";
    plantDescription.innerHTML = "AI đang xử lý, vui lòng chờ trong giây lát.";
}

function showResultError(message) {
    plantName.innerHTML = "Lỗi";
    confidenceEl.innerHTML = "--";
    plantDescription.innerHTML = message || "Không thể kết nối tới máy chủ AI.";
}

function renderResult(data) {
    plantName.innerHTML = data.plant || "Không xác định";
    confidenceEl.innerHTML = (data.confidence ?? "--") + "%";
    plantDescription.innerHTML = data.description || "Không có mô tả.";
}

/*============================*/
/* Tự động quét ảnh (gọi API /api/predict) ngay khi có ảnh hợp lệ,
   không cần bấm nút "Phân tích ảnh" nữa */

async function analyzeSelectedImage() {
    if (!selectedFile) return;

    showResultLoading();
    scanOverlay.classList.add("active");

    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
        const response = await fetch("/api/predict", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Có lỗi xảy ra khi nhận diện.");
        }

        renderResult(data);
    } catch (err) {
        showResultError(err.message);
    } finally {
        scanOverlay.classList.remove("active");
    }
}
