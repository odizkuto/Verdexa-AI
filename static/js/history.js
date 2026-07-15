/*=========================================
Verdexa AI
history.js - Lọc và xử lý trang lịch sử
=========================================*/

const filterBtns = document.querySelectorAll('.filter-btn');
const historyGrid = document.getElementById('historyGrid');

/*============================*/
/* Lọc card theo loại */

function filterCards(type) {
    if (!historyGrid) return;

    const cards = historyGrid.querySelectorAll('.history-card');

    cards.forEach(card => {
        if (type === 'all' || card.dataset.type === type) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });

    // Kiểm tra nếu không có card nào hiển thị sau khi lọc
    const visible = [...cards].filter(c => c.style.display !== 'none');
    showEmptyFilterMsg(visible.length === 0, type);
}

/*============================*/
/* Hiện thông báo khi lọc không có kết quả */

let emptyFilterMsg = null;

function showEmptyFilterMsg(show, type) {
    if (emptyFilterMsg) emptyFilterMsg.remove();

    if (!show) return;

    const label = type === 'plant' ? 'nhận diện cây' : 'chẩn đoán bệnh';
    emptyFilterMsg = document.createElement('p');
    emptyFilterMsg.style.cssText = 'text-align:center;color:#bbb;padding:60px 0;font-size:15px;grid-column:1/-1;';
    emptyFilterMsg.textContent = `Chưa có lịch sử ${label} nào.`;
    historyGrid.appendChild(emptyFilterMsg);
}

/*============================*/
/* Gắn sự kiện cho các nút lọc */

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterCards(btn.dataset.filter);
    });
});

/*============================*/
/* Định dạng lại ngày giờ cho dễ đọc */

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        const d = new Date(dateStr.replace(' ', 'T'));
        return d.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

document.querySelectorAll('.h-date').forEach(el => {
    const raw = el.textContent.trim();
    if (raw && raw !== '—') el.textContent = formatDate(raw);
});