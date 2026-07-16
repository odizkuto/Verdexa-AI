/*=========================================
Verdexa AI
library-book-transition.js

Hieu ung cho nut "Xem thu vien cay trong":
1) Toan bo trang (sidebar + main-content) nga xuong, do ra sau, toi dan
2) Dung luc trang dang "nga", noi dung duoc doi sang tab Thu vien that
3) Trang dung lai, sang dan len -> muc Thu vien hien dan ra truoc mat

Yeu cau trong index.html:
- Bao sidebar + main-content trong <div id="lbtStageContent" class="lbt-stage-content">
- Co 1 div rong <div id="lbtFallFx" class="lbt-fall-fx"></div> trong <body>
- Nut "Xem thu vien cay trong" co id="goLibraryBtn" (bo onclick="switchTab('library')" cu di)
- File nay duoc nap SAU script co dinh nghia ham switchTab()
=========================================*/

(function () {
    var stageContent = document.getElementById('lbtStageContent');
    var fallFx = document.getElementById('lbtFallFx');
    var goLibraryBtn = document.getElementById('goLibraryBtn');

    if (!stageContent || !fallFx || !goLibraryBtn) return;

    function spawnLeaves() {
        fallFx.innerHTML = '';
        var n = 22;
        for (var i = 0; i < n; i++) {
            var s = document.createElement('span');
            s.style.left = (Math.random() * 100) + '%';
            s.style.animationDelay = (Math.random() * 0.5) + 's';
            s.style.animationDuration = (1.1 + Math.random() * 0.8) + 's';
            s.style.opacity = 0.5 + Math.random() * 0.5;
            s.style.width = (4 + Math.random() * 4) + 'px';
            fallFx.appendChild(s);
        }
    }

    function replayRevealAnim(panel) {
        panel.classList.remove('lbt-reveal');
        void panel.offsetWidth;
        panel.classList.add('lbt-reveal');
    }

    function playFallAndReveal() {
        stageContent.classList.remove('lbt-falling');
        fallFx.classList.remove('show');
        void stageContent.offsetWidth;

        requestAnimationFrame(function () {
            stageContent.classList.add('lbt-falling');
            fallFx.classList.add('show');
            spawnLeaves();
        });

        setTimeout(function () {
            if (typeof switchTab === 'function') {
                switchTab('library');
            }
            var libraryPanel = document.getElementById('tab-library');
            if (libraryPanel) replayRevealAnim(libraryPanel);
        }, 620);

        setTimeout(function () {
            stageContent.classList.remove('lbt-falling');
        }, 700);
    }

    goLibraryBtn.addEventListener('click', playFallAndReveal);
})();
