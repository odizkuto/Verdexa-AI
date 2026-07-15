/*=========================================
Verdexa AI
disease.js - Chẩn đoán bệnh cây
(Cách 1: nhập tên cây + triệu chứng | Cách 2: upload ảnh lá)
=========================================*/

const diseasePlantName = document.getElementById("diseasePlantName");
const diseaseSymptoms = document.getElementById("diseaseSymptoms");
const analyzeSymptomsBtn = document.getElementById("analyzeSymptomsBtn");

const diseaseImageInput = document.getElementById("diseaseImageInput");
const analyzeDiseaseImageBtn = document.getElementById("analyzeDiseaseImageBtn");
const diseaseCameraBtn = document.getElementById("diseaseCameraBtn");
const diseaseCameraInput = document.getElementById("diseaseCameraInput");
const diseasePreviewImage = document.getElementById("diseasePreviewImage");
const diseaseImageWrap = document.getElementById("diseaseImageWrap");
const diseaseScanOverlay = document.getElementById("diseaseScanOverlay");

let selectedDiseaseFile = null;

/*============================*/
/* Lưu + xem trước ảnh lá cây (chọn từ máy hoặc chụp bằng camera) */

function setSelectedDiseaseFile(file) {
    if (!file || !file.type.startsWith("image/")) {
        alert("Vui lòng chọn một tệp ảnh hợp lệ.");
        return;
    }

    selectedDiseaseFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        diseasePreviewImage.src = e.target.result;
        diseaseImageWrap.style.display = "inline-block";
    };
    reader.readAsDataURL(file);
}

diseaseImageInput.addEventListener("change", () => {
    if (diseaseImageInput.files.length > 0) {
        setSelectedDiseaseFile(diseaseImageInput.files[0]);
    }
});

/*============================*/
/* Bấm "Chụp ảnh lá" -> mở camera trực tiếp, ảnh chụp được tự động nạp vào */

diseaseCameraBtn.addEventListener("click", () => {
    diseaseCameraInput.click();
});

diseaseCameraInput.addEventListener("change", () => {
    if (diseaseCameraInput.files.length > 0) {
        setSelectedDiseaseFile(diseaseCameraInput.files[0]);
    }
});

const diseaseName = document.getElementById("diseaseName");
const diseaseConfidence = document.getElementById("diseaseConfidence");
const diseaseCause = document.getElementById("diseaseCause");
const diseaseSolution = document.getElementById("diseaseSolution");

/*============================*/
/* Hiển thị kết quả chẩn đoán ra giao diện */

function renderDiseaseResult(data) {
    diseaseName.innerHTML = data.disease || "Không xác định";
    diseaseConfidence.innerHTML = (data.confidence ?? "--") + "%";
    diseaseCause.innerHTML = data.cause || "Không có thông tin nguyên nhân.";

    diseaseSolution.innerHTML = "";
    const solutions = Array.isArray(data.solution) ? data.solution : [];

    if (solutions.length === 0) {
        const li = document.createElement("li");
        li.innerHTML = "Chưa có biện pháp xử lý cụ thể.";
        diseaseSolution.appendChild(li);
    } else {
        solutions.forEach((item) => {
            const li = document.createElement("li");
            li.innerHTML = item;
            diseaseSolution.appendChild(li);
        });
    }
}

function showDiseaseLoading() {
    diseaseName.innerHTML = "Đang phân tích...";
    diseaseConfidence.innerHTML = "...";
    diseaseCause.innerHTML = "AI đang xử lý, vui lòng chờ trong giây lát.";
    diseaseSolution.innerHTML = "";
}

function showDiseaseError(message) {
    diseaseName.innerHTML = "Lỗi";
    diseaseConfidence.innerHTML = "--";
    diseaseCause.innerHTML = message || "Không thể kết nối tới máy chủ AI.";
    diseaseSolution.innerHTML = "";
}

/*============================*/
/* Cách 1: Chẩn đoán bằng tên cây + triệu chứng */

analyzeSymptomsBtn.addEventListener("click", async () => {
    const plantName = diseasePlantName.value.trim();
    const symptoms = diseaseSymptoms.value.trim();

    if (!plantName || !symptoms) {
        alert("Vui lòng nhập đầy đủ tên cây và triệu chứng.");
        return;
    }

    showDiseaseLoading();

    try {
        const response = await fetch("/api/diagnose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plant_name: plantName, symptoms: symptoms }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Có lỗi xảy ra khi chẩn đoán.");
        }

        renderDiseaseResult(data);
    } catch (err) {
        showDiseaseError(err.message);
    }
});

/*============================*/
/* Cách 2: Chẩn đoán bằng ảnh lá cây */

analyzeDiseaseImageBtn.addEventListener("click", async () => {
    if (!selectedDiseaseFile) {
        alert("Vui lòng chọn hoặc chụp ảnh lá cây trước khi phân tích.");
        return;
    }

    showDiseaseLoading();
    diseaseScanOverlay.classList.add("active");

    const formData = new FormData();
    formData.append("image", selectedDiseaseFile);

    try {
        const response = await fetch("/api/diagnose", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Có lỗi xảy ra khi chẩn đoán.");
        }

        renderDiseaseResult(data);
    } catch (err) {
        showDiseaseError(err.message);
    } finally {
        diseaseScanOverlay.classList.remove("active");
    }
});
