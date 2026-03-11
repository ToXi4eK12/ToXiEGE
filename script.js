(async function() {
    let tasks = {};
    let currentTaskId = null;
    let currentQuestionIndex = 0;
    let userAnswers = []; // Массивы выбранных ответов
    let selectedOptions = []; // Массив текущих выборов

    const app = document.getElementById('app');

    // Загрузка данных
    async function init() {
        try {
            const response = await fetch('tasks.json');
            if (!response.ok) throw new Error('Сеть не в порядке');
            const data = await response.json();
            tasks = data.tasks;
            renderMenu();
        } catch (error) {
            app.innerHTML = `<div class="feedback incorrect-feedback">Ошибка загрузки заданий. Проверь консоль или наличие tasks.json</div>`;
            console.error(error);
        }
    }

    function renderMenu() {
        let menuHtml = `
            <div class="header">
                <h1>📚 Подготовка к ЕГЭ</h1>
            </div>
            <div class="question-box" style="text-align: center;">
                <p style="margin-bottom: 20px; color: #666;">Выберите раздел для тренировки:</p>
                <div class="options" style="max-width: 400px; margin: 0 auto;">
        `;

        // Отрисовка стандартных заданий
        for (const [id, task] of Object.entries(tasks)) {
            // Игнорируем временный объект блица, если он остался в памяти
            if (id === 'blitz') continue; 
            menuHtml += `
                <div class="option menu-option" data-task-id="${id}">
                    <span class="option-letter">${id}</span>
                    <span>${task.name}</span>
                </div>
            `;
        }

        // Отрисовка кнопки "Задание Блиц" (в стиле Duolingo)
        menuHtml += `
                <div class="option menu-option" data-task-id="blitz" style="background: #fef08a; border-color: #facc15; margin-top: 15px;">
                    <span class="option-letter" style="background: #ca8a04; color: white; border: none;">⚡</span>
                    <span style="font-weight: bold; color: #854d0e;">Задание Блиц (5 случайных)</span>
                </div>
            </div></div>
        `;
        app.innerHTML = menuHtml;

        document.querySelectorAll('.menu-option').forEach(opt => {
            opt.addEventListener('click', () => startTask(opt.dataset.taskId));
        });
    }

    function startTask(taskId) {
        currentTaskId = taskId;
        currentQuestionIndex = 0;
        
        // Логика режима БЛИЦ
        if (taskId === 'blitz') {
            let allQuestions = [];
            // Собираем вопросы из всех заданий
            for (const [id, task] of Object.entries(tasks)) {
                if (id !== 'blitz') {
                    task.questions.forEach(q => {
                        // Запоминаем, из какого задания взят вопрос, чтобы выводить подсказку
                        allQuestions.push({ ...q, originalTaskName: `Задание ${id}: ${task.name}` });
                    });
                }
            }
            // Перемешиваем всю базу и берем только 5 штук
            allQuestions = allQuestions.sort(() => Math.random() - 0.5).slice(0, 5);
            
            // Создаем виртуальное задание
            tasks['blitz'] = {
                name: "Блиц-микс",
                questions: allQuestions
            };
        } else {
            // Обычное задание: просто перемешиваем его вопросы
            tasks[taskId].questions = tasks[taskId].questions.sort(() => Math.random() - 0.5);
        }

        userAnswers = new Array(tasks[taskId].questions.length).fill(null);
        selectedOptions = [];
        renderQuestion();
    }

    // Вспомогательная функция (ответы в массив)
    function getCorrectAnswersArray(answerData) {
        return Array.isArray(answerData) ? answerData : [answerData];
    }

    // Сравнение массивов
    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
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
                const isSelectedByUser = currentSelections.includes(i);
                const isTrulyCorrect = correctAnswers.includes(i);

                if (isSelectedByUser && isTrulyCorrect) cls += ' correct';
                else if (isSelectedByUser && !isTrulyCorrect) cls += ' incorrect';
                else if (!isSelectedByUser && isTrulyCorrect) cls += ' missed';
            } else if (currentSelections.includes(i)) {
                cls += ' selected';
            }

            return `
                <div class="${cls}" data-idx="${i}">
                    <span class="option-letter">${String.fromCharCode(1040 + i)}</span>
                    <span>${opt}</span>
                </div>
            `;
        }).join('');

        const isCompletelyCorrect = isAnswered && arraysEqual(currentSelections, correctAnswers);

        const feedbackHtml = isAnswered ? `
            <div class="feedback ${isCompletelyCorrect ? 'correct-feedback' : 'incorrect-feedback'}">
                ${q.explanation}
            </div>
        ` : '';

        const correctCount = userAnswers.filter((ans, idx) => {
            if (ans === null) return false;
            const corr = getCorrectAnswersArray(task.questions[idx].answer);
            return arraysEqual(ans, corr);
        }).length;

        // Если это блиц, показываем из какого задания этот вопрос (например: "Задание 4: Ударения")
        const badgeText = currentTaskId === 'blitz' ? q.originalTaskName : task.name;
        // Особый стиль плашки для блица
        const badgeStyle = currentTaskId === 'blitz' ? 'style="background: #fef08a; color: #854d0e;"' : '';

        app.innerHTML = `
            <div class="header">
                <h1>${currentTaskId === 'blitz' ? '⚡ Блиц' : '📚 Задание ' + currentTaskId}</h1>
                <span class="task-badge" ${badgeStyle}>${badgeText}</span>
            </div>
            <div class="progress">
                <span>Вопрос ${currentQuestionIndex + 1} / ${task.questions.length}</span>
                <span>✅ ${correctCount}</span>
            </div>
            <div class="question-box">
                <div class="question-text">${q.question}</div>
                <div class="options">${optionsHtml}</div>
                ${feedbackHtml}
            </div>
            <div class="actions">
                <button class="reset-btn" id="toMenu">◀ Меню</button>
                <button id="checkBtn" ${isAnswered || selectedOptions.length === 0 ? 'disabled' : ''}>Проверить</button>
                <button id="nextBtn" ${!isAnswered ? 'disabled' : ''}>${currentQuestionIndex === task.questions.length - 1 ? 'Финиш' : 'Далее'}</button>
            </div>
        `;

        document.querySelectorAll('.option').forEach(opt => {
            opt.addEventListener('click', () => {
                if (!isAnswered) {
                    const idx = parseInt(opt.dataset.idx);
                    if (selectedOptions.includes(idx)) {
                        selectedOptions = selectedOptions.filter(item => item !== idx);
                    } else {
                        selectedOptions.push(idx);
                    }
                    renderQuestion();
                }
            });
        });

        document.getElementById('checkBtn').addEventListener('click', () => {
            userAnswers[currentQuestionIndex] = [...selectedOptions];
            renderQuestion();
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            if (currentQuestionIndex < task.questions.length - 1) {
                currentQuestionIndex++;
                selectedOptions = [];
                renderQuestion();
            } else {
                renderResults();
            }
        });

        document.getElementById('toMenu').addEventListener('click', renderMenu);
    }

    function renderResults() {
        const correctCount = userAnswers.filter((ans, idx) => {
            const corr = getCorrectAnswersArray(tasks[currentTaskId].questions[idx].answer);
            return arraysEqual(ans, corr);
        }).length;

        const resultTitle = currentTaskId === 'blitz' ? '⚡ Блиц завершён!' : 'Результат';

        app.innerHTML = `
            <div class="result-screen">
                <h2>${resultTitle}</h2>
                <div class="result-score">${correctCount} / ${userAnswers.length}</div>
                <button class="restart-btn" id="retry">Ещё раз</button>
                <button class="reset-btn" id="toMenu" style="width:100%; margin-top:10px;">В меню</button>
            </div>
        `;
        document.getElementById('retry').addEventListener('click', () => startTask(currentTaskId));
        document.getElementById('toMenu').addEventListener('click', renderMenu);
    }

    init();
})();