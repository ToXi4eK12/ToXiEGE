(async function() {
    let tasks = {};
    let currentTaskId = null;
    let currentQuestionIndex = 0;
    let userAnswers = []; // Теперь тут будут храниться массивы выбранных ответов
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

        for (const [id, task] of Object.entries(tasks)) {
            menuHtml += `
                <div class="option menu-option" data-task-id="${id}">
                    <span class="option-letter">${id}</span>
                    <span>${task.name}</span>
                </div>
            `;
        }

        menuHtml += `</div></div>`;
        app.innerHTML = menuHtml;

        document.querySelectorAll('.menu-option').forEach(opt => {
            opt.addEventListener('click', () => startTask(opt.dataset.taskId));
        });
    }

    function startTask(taskId) {
        currentTaskId = taskId;
        currentQuestionIndex = 0;
        // Перемешиваем вопросы
        tasks[taskId].questions = tasks[taskId].questions.sort(() => Math.random() - 0.5);
        userAnswers = new Array(tasks[taskId].questions.length).fill(null);
        selectedOptions = [];
        renderQuestion();
    }

    // Вспомогательная функция, чтобы всегда работать с массивом правильных ответов
    function getCorrectAnswersArray(answerData) {
        return Array.isArray(answerData) ? answerData : [answerData];
    }

    // Проверка, совпадают ли два массива
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
        
        // Если уже ответили, берем ответы пользователя, иначе текущие выбранные
        const currentSelections = isAnswered ? userAnswers[currentQuestionIndex] : selectedOptions;

        const optionsHtml = q.options.map((opt, i) => {
            let cls = 'option';
            
            if (isAnswered) {
                const isSelectedByUser = currentSelections.includes(i);
                const isTrulyCorrect = correctAnswers.includes(i);

                if (isSelectedByUser && isTrulyCorrect) {
                    cls += ' correct'; // Выбрал и угадал
                } else if (isSelectedByUser && !isTrulyCorrect) {
                    cls += ' incorrect'; // Выбрал, но это ошибка
                } else if (!isSelectedByUser && isTrulyCorrect) {
                    cls += ' missed'; // Не выбрал, а надо было (покажем пунктиром)
                }
            } else if (currentSelections.includes(i)) {
                cls += ' selected'; // Просто выделение до проверки
            }

            return `
                <div class="${cls}" data-idx="${i}">
                    <span class="option-letter">${String.fromCharCode(1040 + i)}</span>
                    <span>${opt}</span>
                </div>
            `;
        }).join('');

        // Проверяем, полностью ли правильный ответ
        const isCompletelyCorrect = isAnswered && arraysEqual(currentSelections, correctAnswers);

        const feedbackHtml = isAnswered ? `
            <div class="feedback ${isCompletelyCorrect ? 'correct-feedback' : 'incorrect-feedback'}">
                ${q.explanation}
            </div>
        ` : '';

        // Подсчет текущего прогресса (сколько полностью правильных)
        const correctCount = userAnswers.filter((ans, idx) => {
            if (ans === null) return false;
            const corr = getCorrectAnswersArray(task.questions[idx].answer);
            return arraysEqual(ans, corr);
        }).length;

        app.innerHTML = `
            <div class="header">
                <h1>📚 Задание ${currentTaskId}</h1>
                <span class="task-badge">${task.name}</span>
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
                    // Тогл (включение/выключение) выбора
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
            userAnswers[currentQuestionIndex] = [...selectedOptions]; // Сохраняем массив
            renderQuestion();
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            if (currentQuestionIndex < task.questions.length - 1) {
                currentQuestionIndex++;
                selectedOptions = []; // Сбрасываем выбор для следующего вопроса
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

        app.innerHTML = `
            <div class="result-screen">
                <h2>Результат</h2>
                <div class="result-score">${correctCount} / ${userAnswers.length}</div>
                <button class="restart-btn" id="retry">Заново</button>
                <button class="reset-btn" id="toMenu" style="width:100%; margin-top:10px;">В меню</button>
            </div>
        `;
        document.getElementById('retry').addEventListener('click', () => startTask(currentTaskId));
        document.getElementById('toMenu').addEventListener('click', renderMenu);
    }

    init();
})();