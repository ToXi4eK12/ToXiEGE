import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyCxqqRg841CXKNdfIHwdpNLvIcdFb9OcN0",
    authDomain: "toxiege.firebaseapp.com",
    projectId: "toxiege",
    storageBucket: "toxiege.firebasestorage.app",
    messagingSenderId: "91767048939",
    appId: "1:91767048939:web:2d96e33715a6a7b7c1ccae",
    measurementId: "G-Y7VBMQP933"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  // Глобальная переменная для хранения ID текущего пользователя
let currentUserId = null;

// --- ЛОГИКА АВТОРИЗАЦИИ ---
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');

// Слушатель изменения состояния (вошел/вышел)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Пользователь вошел
        currentUserId = user.uid;
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = user.displayName;
    } else {
        // Пользователь вышел
        currentUserId = null;
        loginBtn.style.display = 'block';
        userInfo.style.display = 'none';
    }
});

// Действия по кнопкам
loginBtn.onclick = () => signInWithPopup(auth, provider).catch(error => console.error("Ошибка входа:", error));
logoutBtn.onclick = () => signOut(auth);

(async function() {
    let tasks = {};
    let currentTaskId = null;
    let currentQuestionIndex = 0;
    let userAnswers = [];
    let selectedOptions = [];

    const app = document.getElementById('app');

    // --- 1. СТАТИСТИКА (FIREBASE READY) ---

// Вспомогательная функция для получения текущей даты в формате ДД.ММ.ГГГГ
function getTodayDate() {
    return new Date().toLocaleDateString('ru-RU');
}

// --- УЛУЧШЕННАЯ СТАТИСТИКА (FIRESTORE) ---

// --- ОБНОВЛЕННАЯ СТАТИСТИКА ДЛЯ FIRESTORE ---

async function fetchStats() {
    const defaultStats = {
        lastActiveDate: null,
        currentStreak: 0,
        maxStreak: 0,
        totalAnswered: 0,
        totalCorrect: 0,
        daily: {}
    };

    if (!currentUserId) return defaultStats;

    try {
        const docRef = doc(db, "users", currentUserId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) {
        console.error("Ошибка загрузки данных:", e);
    }
    return defaultStats;
}

async function saveStats(taskId, isCorrect) {
    if (!currentUserId) {
        console.warn("Данные не сохранены: пользователь не в сети");
        return;
    }

    // Получаем текущие данные
    const stats = await fetchStats();
    const today = new Date().toLocaleDateString('ru-RU');

    // Логика Стрика (серии дней)
    if (stats.lastActiveDate !== today) {
        if (stats.lastActiveDate) {
            const [d, m, y] = stats.lastActiveDate.split('.').map(Number);
            const lastDate = new Date(y, m - 1, d);
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            
            const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) stats.currentStreak++;
            else stats.currentStreak = 1;
        } else {
            stats.currentStreak = 1;
        }
        stats.lastActiveDate = today;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    }

    // Общие счетчики
    stats.totalAnswered++;
    if (isCorrect) stats.totalCorrect++;

    // Подневная детальная статистика
    if (!stats.daily[today]) stats.daily[today] = {};
    if (!stats.daily[today][taskId]) stats.daily[today][taskId] = { c: 0, i: 0 };
    
    isCorrect ? stats.daily[today][taskId].c++ : stats.daily[today][taskId].i++;

    // Сохранение в Firebase
    try {
        await setDoc(doc(db, "users", currentUserId), stats);
        console.log("Статистика успешно сохранена в облако!");
    } catch (e) {
        console.error("Ошибка записи в Firestore:", e);
    }
}

    // --- 2. ВЬЮХА ПРОФИЛЯ И СТАТИСТИКИ (ВМЕСТО МОДАЛКИ) ---
async function renderProfile() {
    const stats = await fetchStats();
    
    // Считаем общий процент
    const overallAccuracy = stats.totalAnswered > 0 
        ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) 
        : 0;

    // Считаем статистику по каждому заданию за всё время
    const taskStats = {};
    Object.values(stats.daily).forEach(dayData => {
        Object.entries(dayData).forEach(([taskId, data]) => {
            if (!taskStats[taskId]) taskStats[taskId] = { c: 0, i: 0 };
            taskStats[taskId].c += data.c;
            taskStats[taskId].i += data.i;
        });
    });

    // Генерируем HTML для прогресс-баров по заданиям
    let tasksHtml = '';
    Object.entries(taskStats).forEach(([taskId, data]) => {
        const total = data.c + data.i;
        const accuracy = Math.round((data.c / total) * 100);
        tasksHtml += `
            <div class="stat-task-card">
                <div class="stat-task-header">
                    <span style="font-weight: 600;">Задание ${taskId}</span>
                    <span style="color: #64748b;">${accuracy}% (${data.c}/${total})</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${accuracy}%; background: ${accuracy > 70 ? '#22c55e' : accuracy > 40 ? '#eab308' : '#ef4444'};"></div>
                </div>
            </div>
        `;
    });

    if (!tasksHtml) tasksHtml = '<p style="color: #94a3b8; text-align: center;">Пока нет решенных заданий</p>';

    app.innerHTML = `
        <div class="header">
            <button class="reset-btn" id="backToMenu" style="flex: 0 0 auto; padding: 10px 15px;">◀ Назад</button>
            <h1 style="margin-left: 10px;">Статистика</h1>
        </div>
        
        <div class="question-box" style="padding: 0; border: none; background: transparent;">
            
            <div class="streak-container">
                <div class="streak-box">
                    <div class="streak-icon">🔥</div>
                    <div class="streak-info">
                        <span class="streak-title">Дней подряд</span>
                        <span class="streak-value">${stats.currentStreak}</span>
                    </div>
                </div>
                <div class="streak-box" style="background: #f8fafc; border-color: #e2e8f0;">
                    <div class="streak-icon" style="background: #e2e8f0;">🏆</div>
                    <div class="streak-info">
                        <span class="streak-title">Рекорд</span>
                        <span class="streak-value" style="color: #475569;">${stats.maxStreak}</span>
                    </div>
                </div>
            </div>

            <div class="overall-stats-card">
                <div style="font-size: 2.5rem; font-weight: 700; color: #3b82f6;">${overallAccuracy}%</div>
                <div style="color: #64748b; font-size: 0.95rem;">Общая правильность</div>
                <div style="margin-top: 10px; font-size: 0.9rem;">
                    Решено верно: <b>${stats.totalCorrect}</b> из <b>${stats.totalAnswered}</b>
                </div>
            </div>

            <h3 style="margin: 20px 0 10px; color: #1e293b;">По заданиям</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${tasksHtml}
            </div>
            
            <button id="clearStats" style="width:100%; margin-top:30px; background:#fee2e2; color:#ef4444; box-shadow:none;">Очистить историю</button>
        </div>
    `;

    document.getElementById('backToMenu').onclick = renderMenu;
    document.getElementById('clearStats').onclick = () => {
        if(confirm('Точно удалить всю статистику? Это действие нельзя отменить.')) {
            localStorage.removeItem('ege_stats_v2');
            renderProfile(); // Перерисовываем пустую
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
        document.getElementById('openProfile').onclick = renderProfile;
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

        document.getElementById('checkBtn').onclick = async() => {
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Меняем '/sw.js' на './sw.js'
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker зарегистрирован!', reg))
        .catch(err => console.log('Ошибка SW:', err));
    });
}