(async function() {
    let tasks = {};
    let currentTaskId = null;
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let selectedOptions = [];

    const app = document.getElementById('app');

    // --- 1. СТАТИСТИКА ---
    function getStats() {
        const stats = localStorage.getItem('ege_stats');
        return stats ? JSON.parse(stats) : {};
    }

    function saveStats(taskId, isCorrect) {
        const stats = getStats();
        if (!stats[taskId]) stats[taskId] = { correct: 0, incorrect: 0 };
        isCorrect ? stats[taskId].correct++ : stats[taskId].incorrect++;
        localStorage.setItem('ege_stats', JSON.stringify(stats));
    }

    // --- 2. МОДАЛЬНОЕ ОКНО ПРОФИЛЯ ---
    // Эта функция должна быть объявлена ДО renderMenu или просто внутри этой области видимости
    function showProfile() {
        const stats = getStats();
        let statsHtml = '';
        
        for (const [id, task] of Object.entries(tasks)) {
            if (id === 'blitz') continue;
            const s = stats[id] || { correct: 0, incorrect: 0 };
            statsHtml += `
                <div class="stat-row" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee;">
                    <span style="font-weight:600;">Задание ${id}</span>
                    <div>
                        <span style="color:#22c55e; margin-right:10px;">✅ ${s.correct}</span>
                        <span style="color:#ef4444;">❌ ${s.incorrect}</span>
                    </div>
                </div>
            `;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:1000;';
        modal.innerHTML = `
            <div class="modal-content" style="background:white; padding:25px; border-radius:24px; width:320px; position:relative;">
                <span class="close-modal" style="position:absolute; top:10px; right:15px; cursor:pointer; font-size:1.5rem;">&times;</span>
                <h3 style="margin-bottom:15px; text-align:center;">Моя статистика</h3>
                <div style="max-height: 300px; overflow-y: auto;">${statsHtml || 'Пока нет данных'}</div>
                <button id="clearStats" style="width:100%; margin-top:20px; background:#fee2e2; color:#ef4444; border:none; padding:10px; border-radius:10px; cursor:pointer;">Сбросить прогресс</button>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
        modal.querySelector('#clearStats').onclick = () => {
            if(confirm('Удалить всю статистику?')) {
                localStorage.removeItem('ege_stats');
                modal.remove();
                renderMenu();
            }
        };
    }

    // --- 3. ЗАГРУЗКА ---
    async function init() {
        try {
            const response = await fetch('tasks.json?t=' + Date.now());
            if (!response.ok) throw new Error('Файл не найден');
            const data = await response.json();
            tasks = data.tasks;
            renderMenu();
        } catch (error) {
            console.error(error);
            app.innerHTML = `<div class="feedback incorrect-feedback">Ошибка загрузки заданий</div>`;
        }
    }

    // --- 4. РЕНДЕР МЕНЮ ---
    function renderMenu() {
        if (tasks.blitz) {
            delete tasks.blitz;
        }
        app.innerHTML = `
            <div class="header" style="display:flex; justify-content:space-between; align-items:center;">
                <h1>📚 ЕГЭ 2026</h1>
                <div class="profile-btn" id="openProfile" style="cursor:pointer; font-size:1.5rem; background:#f0fdf4; border:2px solid #22c55e; width:45px; height:45px; border-radius:50%; display:flex; align-items:center; justify-content:center;">👤</div>
            </div>
            <div class="question-box" style="text-align: center;">
                <p style="margin-bottom: 20px; color: #666;">Выберите раздел:</p>
                <div class="options" style="max-width: 400px; margin: 0 auto;">
                    ${Object.entries(tasks).map(([id, task]) => `
                        <div class="option menu-option" data-task-id="${id}">
                            <span class="option-letter">${id}</span>
                            <span>${task.name}</span>
                        </div>
                    `).join('')}
                    <div class="option menu-option" data-task-id="blitz" style="background: #fef08a; border-color: #facc15; margin-top: 15px;">
                        <span class="option-letter" style="background: #ca8a04; color: white; border: none;">⚡</span>
                        <span style="font-weight: bold; color: #854d0e;">Блиц-разминка</span>
                    </div>
                </div>
            </div>
        `;

        // Слушатели
        document.getElementById('openProfile').onclick = showProfile;
        document.querySelectorAll('.menu-option').forEach(opt => {
            opt.onclick = () => startTask(opt.dataset.taskId);
        });
    }

    // --- 5. ЛОГИКА ТЕСТА ---
    function startTask(taskId) {
        currentTaskId = taskId;
        currentQuestionIndex = 0;
        
        if (taskId === 'blitz') {
            let allQuestions = [];
            for (const [id, task] of Object.entries(tasks)) {
                if (id !== 'blitz') {
                    task.questions.forEach(q => {
                        allQuestions.push({ ...q, originalTaskId: id });
                    });
                }
            }
            tasks['blitz'] = { name: "Блиц", questions: allQuestions.sort(() => Math.random() - 0.5).slice(0, 5) };
        } else {
            tasks[taskId].questions.sort(() => Math.random() - 0.5);
        }

        userAnswers = new Array(tasks[taskId].questions.length).fill(null);
        selectedOptions = [];
        renderQuestion();
    }

    function getCorrectAnswersArray(answerData) {
        return Array.isArray(answerData) ? answerData : [answerData];
    }

    function arraysEqual(a, b) {
        if (!a || !b || a.length !== b.length) return false;
        return [...a].sort().every((val, index) => val === [...b].sort()[index]);
    }

    function renderQuestion() {
        const task = tasks[currentTaskId];
        const q = task.questions[currentQuestionIndex];
        const isAnswered = userAnswers[currentQuestionIndex] !== null;
        const correctAnswers = getCorrectAnswersArray(q.answer);
        const currentSelections = isAnswered ? userAnswers[currentQuestionIndex] : selectedOptions;

        const optionsHtml = q.options.map((opt, i) => {
            let cls = 'option';
            if (isAnswered) {
                const isSelected = currentSelections.includes(i);
                const isCorrect = correctAnswers.includes(i);
                if (isSelected && isCorrect) cls += ' correct';
                else if (isSelected && !isCorrect) cls += ' incorrect';
                else if (!isSelected && isCorrect) cls += ' missed';
            } else if (currentSelections.includes(i)) {
                cls += ' selected';
            }
            return `<div class="${cls}" data-idx="${i}"><span class="option-letter">${String.fromCharCode(1040 + i)}</span><span>${opt}</span></div>`;
        }).join('');

        app.innerHTML = `
            <div class="header">
                <h1>${currentTaskId === 'blitz' ? '⚡ Блиц' : 'Задание ' + currentTaskId}</h1>
                <span class="question-counter">${currentQuestionIndex + 1} / ${task.questions.length}</span>
            </div>
            <div class="question-box">
                <div class="question-text">${q.question}</div>
                <div class="options">${optionsHtml}</div>
                ${isAnswered ? `<div class="feedback ${arraysEqual(currentSelections, correctAnswers) ? 'correct-feedback' : 'incorrect-feedback'}">${q.explanation}</div>` : ''}
            </div>
            <div class="actions">
                <button class="reset-btn" id="toMenu">◀</button>
                <button id="checkBtn" ${isAnswered || selectedOptions.length === 0 ? 'disabled' : ''}>Проверить</button>
                <button id="nextBtn" ${!isAnswered ? 'disabled' : ''}>${currentQuestionIndex === task.questions.length - 1 ? 'Финиш' : 'Далее'}</button>
            </div>
        `;

        document.querySelectorAll('.option').forEach(opt => {
            opt.onclick = () => {
                if (!isAnswered) {
                    const idx = parseInt(opt.dataset.idx);
                    selectedOptions.includes(idx) ? 
                        selectedOptions = selectedOptions.filter(i => i !== idx) : 
                        selectedOptions.push(idx);
                    renderQuestion();
                }
            };
        });

        document.getElementById('checkBtn').onclick = () => {
            const isCorrect = arraysEqual(selectedOptions, correctAnswers);
            userAnswers[currentQuestionIndex] = [...selectedOptions];
            const targetId = currentTaskId === 'blitz' ? q.originalTaskId : currentTaskId;
            saveStats(targetId, isCorrect);
            renderQuestion();
        };

        document.getElementById('nextBtn').onclick = () => {
            if (currentQuestionIndex < task.questions.length - 1) {
                currentQuestionIndex++;
                selectedOptions = [];
                renderQuestion();
            } else renderResults();
        };

        document.getElementById('toMenu').onclick = renderMenu;
    }

    function renderResults() {
        const correctCount = userAnswers.filter((ans, idx) => {
            const corr = getCorrectAnswersArray(tasks[currentTaskId].questions[idx].answer);
            return arraysEqual(ans, corr);
        }).length;

        app.innerHTML = `
            <div class="result-screen">
                <h2>Завершено!</h2>
                <div class="result-score">${correctCount} / ${userAnswers.length}</div>
                <button class="restart-btn" id="finishMenu">В меню</button>
            </div>
        `;
        document.getElementById('finishMenu').onclick = renderMenu;
    }

    init();
})();