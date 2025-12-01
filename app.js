// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
    // VK App ID (замените на свой)
    VK_APP_ID: 54372366, // Пример, замените на ваш
    

    // Google Sheets API
    GOOGLE_API_KEY: 'AIzaSyAp_Q9qdocXqsIlRDGlMDQqf2B8sjmDpog', // Замените на ваш API ключ
    SPREADSHEET_ID: '1MU8B4bEnlhGIw-dFtQuEvepvJ-hJ0l2wvZvQk-D0a9E', // Замените на ID вашей таблицы
    
    // VK Chat ID для логов
    VK_CHAT_ID: 2000000688 , // Замените на ваш
    VK_API: "vk1.a.QYyPxIBaYHkozVtUXdiMrkfrJS3-Oiia35_CRUG1UnKzXt9luizIizRLIPup39-IhGgmv6vPK0qpzuI9Xt1IBgnxK9Pui_M5AgMz0W-n9sCrkMitrSpMxccWE882UCJ02DkXMf7nFnboOImMtYSjtcgLllBthEhM4XYnPu3XuRqtyzAwmS38K1wY8kOrDFkE86tnUo3u78DjbIYrJaNVkQ",
    VK_ACCESS_TOKEN: 'vk1.a.QYyPxIBaYHkozVtUXdiMrkfrJS3-Oiia35_CRUG1UnKzXt9luizIizRLIPup39-IhGgmv6vPK0qpzuI9Xt1IBgnxK9Pui_M5AgMz0W-n9sCrkMitrSpMxccWE882UCJ02DkXMf7nFnboOImMtYSjtcgLllBthEhM4XYnPu3XuRqtyzAwmS38K1wY8kOrDFkE86tnUo3u78DjbIYrJaNVkQ', // Токен группы для отправки в чат
    
    // Названия листов в Google Sheets
    SHEETS: {
        USERS: 'Users',
        CARS: 'Cars',
        CAR_HISTORY: 'CarHistory',
        MAINTENANCE: 'Maintenance',
        PENALTIES: 'Penalties',
        LOGS: 'Logs'
    }
};

// ============================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ============================================

const STATE = {
    currentUser: null,
    currentPage: 'dashboard',
    cars: [],
    users: [],
    carHistory: [],
    maintenance: [],
    penalties: [],
    logs: [],
    selectedCar: null
};

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚗 Инициализация приложения...');
    
    // Прячем экран загрузки через 2 секунды
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        checkAuth();
    }, 2000);
});

// ============================================
// АВТОРИЗАЦИЯ VK
// ============================================

async function checkAuth() {
    // Сначала проверяем, не пришли ли мы с VK OAuth
    const hasCallback = await handleVKCallback();
    
    if (hasCallback) {
        // Авторизация прошла через callback
        return;
    }
    
    // Проверяем локальное хранилище
    const vkUser = localStorage.getItem('vk_user');
    
    if (vkUser) {
        const user = JSON.parse(vkUser);
        await loadUserData(user);
        showApp();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('app-screen').style.display = 'none';
    
    document.getElementById('vk-login-btn').onclick = loginWithVK;
    
    // Кнопка демо-входа (для тестирования)
    document.getElementById('test-login-btn').onclick = async () => {
        const testUser = {
            id: Date.now(), // Уникальный ID
            first_name: 'Демо',
            last_name: 'Пользователь',
            photo_200: ''
        };
        localStorage.setItem('vk_user', JSON.stringify(testUser));
        await createOrUpdateUser(testUser);
        await loadUserData(testUser);
        showApp();
        showNotification('🧪 Демо-режим активирован', 'info');
    };
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    
    initializeApp();
}

// ============================================
// УНИВЕРСАЛЬНАЯ АВТОРИЗАЦИЯ VK
// Работает на обычных сайтах и в VK Mini Apps
// ============================================

async function loginWithVK() {
    try {
        console.log('🔐 Начинаем авторизацию через VK...');
        
        // Способ 1: Простое окно VK ID (работает везде)
        openVKIDPopup();
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        showNotification('Ошибка входа через VK', 'error');
        
        // Запасной вариант: тестовый режим
        console.log('⚠️ Используем тестовый режим для демонстрации');
        const testUser = {
            id: Date.now(), // Уникальный ID
            first_name: 'Тестовый',
            last_name: 'Пользователь',
            photo_200: ''
        };
        localStorage.setItem('vk_user', JSON.stringify(testUser));
        await createOrUpdateUser(testUser);
        await loadUserData(testUser);
        showApp();
        showNotification('🧪 Демо-режим: тестовый пользователь', 'info');
    }
}

// Открытие VK ID в popup окне (универсальный метод)
function openVKIDPopup() {
    const width = 650;
    const height = 600;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    // VK ID URL (новый способ авторизации)
    const redirectUri = window.location.origin + window.location.pathname;
    const clientId = CONFIG.VK_APP_ID;
    
    // Используем VK ID (новая система авторизации VK)
    const vkidUrl = `https://id.vk.com/auth?app_id=${clientId}&response_type=silent_token&redirect_uri=${encodeURIComponent(redirectUri)}&state=vkid_auth`;
    
    console.log('🔗 VK ID URL:', vkidUrl);
    console.log('📍 Redirect URI:', redirectUri);
    
    // Открываем popup
    const popup = window.open(
        vkidUrl,
        'VK ID',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );
    
    if (!popup) {
        // Если браузер блокирует popup - используем обычное перенаправление
        console.log('⚠️ Popup заблокирован, используем redirect');
        window.location.href = vkidUrl;
        return;
    }
    
    // Следим за закрытием popup
    const checkPopup = setInterval(() => {
        if (popup.closed) {
            clearInterval(checkPopup);
            console.log('🔍 Popup закрыт, проверяем авторизацию');
            checkVKIDAuth();
        }
    }, 500);
}

// Проверка VK ID авторизации
async function checkVKIDAuth() {
    try {
        // VK ID возвращает payload в URL или через postMessage
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        
        // Проверяем разные источники токена
        const payload = urlParams.get('payload') || hashParams.get('payload');
        const token = urlParams.get('token') || hashParams.get('token');
        const userId = urlParams.get('user_id') || hashParams.get('user_id');
        
        if (payload || token || userId) {
            console.log('✅ Получены данные от VK ID');
            
            // Если есть payload - парсим его
            if (payload) {
                const data = JSON.parse(atob(payload));
                await processVKUser(data.user);
                return;
            }
            
            // Если есть токен и userId - получаем данные через API
            if (token && userId) {
                const userInfo = await fetch(`https://api.vk.com/method/users.get?user_ids=${userId}&fields=photo_200&access_token=${token}&v=5.199`)
                    .then(res => res.json());
                
                if (userInfo.response?.[0]) {
                    await processVKUser(userInfo.response[0]);
                    return;
                }
            }
        }
        
        console.log('ℹ️ Нет данных авторизации');
    } catch (error) {
        console.error('❌ Ошибка проверки VK ID:', error);
    }
}

// Обработка данных пользователя VK
async function processVKUser(vkUserData) {
    try {
        const userData = {
            id: vkUserData.id || vkUserData.user_id,
            first_name: vkUserData.first_name,
            last_name: vkUserData.last_name,
            photo_200: vkUserData.photo_200 || ''
        };
        
        console.log('✅ Данные пользователя получены:', userData);
        
        // Сохраняем
        localStorage.setItem('vk_user', JSON.stringify(userData));
        
        // Создаём в базе
        await createOrUpdateUser(userData);
        
        // Логируем вход
        await logAction(userData.id, 'login', 'Вход в систему');
        
        // Очищаем URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Показываем приложение
        await loadUserData(userData);
        showApp();
        
        showNotification('Добро пожаловать, ' + userData.first_name + '!', 'success');
    } catch (error) {
        console.error('❌ Ошибка обработки пользователя:', error);
        showNotification('Ошибка при входе', 'error');
    }
}

// Обработка callback от VK (старый метод, оставляем для совместимости)
async function handleVKCallback() {
    // Проверяем VK ID
    await checkVKIDAuth();
    return false;
}

function logout() {
    localStorage.removeItem('vk_user');
    localStorage.removeItem('user_role');
    STATE.currentUser = null;
    showLogin();
    showNotification('Вы вышли из системы', 'info');
}

// ============================================
// РАБОТА С GOOGLE SHEETS
// ============================================

let gapiInited = false;
let gisInited = false;
let tokenClient;

// Загрузка Google API
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: CONFIG.GOOGLE_API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        gapiInited = true;
        console.log('✅ Google Sheets API инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации Google API:', error);
    }
}

// Чтение данных из листа
async function readSheet(sheetName, range = 'A:Z') {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${sheetName}!${range}`,
        });
        
        const rows = response.result.values || [];
        return rows;
    } catch (error) {
        console.error(`❌ Ошибка чтения листа ${sheetName}:`, error);
        // Возвращаем тестовые данные для демо
        return getDemoData(sheetName);
    }
}

// Запись данных в лист
async function appendSheet(sheetName, values) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });
        return response;
    } catch (error) {
        console.error(`❌ Ошибка записи в лист ${sheetName}:`, error);
        // Для демо просто логируем
        console.log('📝 Демо-режим: данные записаны локально');
    }
}

// Обновление строки в листе
async function updateSheet(sheetName, row, values) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `${sheetName}!A${row}:Z${row}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [values]
            }
        });
        return response;
    } catch (error) {
        console.error(`❌ Ошибка обновления листа ${sheetName}:`, error);
    }
}

// ============================================
// ДЕМО ДАННЫЕ (для тестирования без Google Sheets)
// ============================================

function getDemoData(sheetName) {
    const demoData = {
        Users: [
            ['vk_id', 'name', 'role', 'created_at'],
            ['123456789', 'Тест Тестов', 'admin', new Date().toISOString()],
            ['987654321', 'Иван Иванов', 'driver', new Date().toISOString()],
            ['555555555', 'Петр Петров', 'mechanic', new Date().toISOString()]
        ],
        Cars: [
            ['id', 'brand', 'model', 'status', 'current_user_vk_id', 'fuel_level', 'is_broken', 'cost'],
            ['1', 'Toyota', 'Camry', 'available', '', '45', 'false', '0'],
            ['2', 'Honda', 'Civic', 'available', '', '50', 'false', '0'],
            ['3', 'BMW', 'X5', 'in_use', '987654321', '30', 'false', '0'],
            ['4', 'Mercedes', 'C-Class', 'maintenance', '', '20', 'true', '15000'],
            ['5', 'Audi', 'A4', 'available', '', '60', 'false', '0']
        ],
        CarHistory: [
            ['id', 'car_id', 'user_vk_id', 'action', 'fuel_before', 'fuel_after', 'is_broken', 'cost', 'timestamp', 'returned_at'],
            ['1', '3', '987654321', 'take', '30', '30', 'false', '0', new Date().toISOString(), '']
        ],
        Maintenance: [
            ['id', 'car_id', 'mechanic_vk_id', 'fuel_before', 'fuel_after', 'was_broken', 'repaired', 'notes', 'timestamp'],
            ['1', '4', '555555555', '15', '20', 'true', 'false', 'Требуется замена масла', new Date().toISOString()]
        ],
        Penalties: [
            ['id', 'user_vk_id', 'car_id', 'reason', 'amount', 'issued_by', 'issued_at']
        ],
        Logs: [
            ['timestamp', 'user_vk_id', 'action', 'details', 'ip'],
            [new Date().toISOString(), '123456789', 'login', 'Вход в систему', '192.168.1.1']
        ]
    };
    
    return demoData[sheetName] || [];
}

// ============================================
// РАБОТА С ПОЛЬЗОВАТЕЛЯМИ
// ============================================

async function createOrUpdateUser(vkUser) {
    const users = await readSheet(CONFIG.SHEETS.USERS);
    const userIndex = users.findIndex(row => row[0] === String(vkUser.id));
    
    const userName = `${vkUser.first_name} ${vkUser.last_name}`;
    
    if (userIndex === -1) {
        // Создаём нового пользователя с ролью driver
        const newUser = [
            vkUser.id,
            userName,
            'driver',
            new Date().toISOString()
        ];
        await appendSheet(CONFIG.SHEETS.USERS, newUser);
        console.log('✅ Новый пользователь создан');
    }
}

async function loadUserData(vkUser) {
    const users = await readSheet(CONFIG.SHEETS.USERS);
    const userRow = users.find(row => row[0] === String(vkUser.id));
    
    if (userRow) {
        STATE.currentUser = {
            vk_id: userRow[0],
            name: userRow[1],
            role: userRow[2],
            created_at: userRow[3],
            vk_data: vkUser
        };
        
        localStorage.setItem('user_role', userRow[2]);
        
        console.log('✅ Данные пользователя загружены:', STATE.currentUser);
    } else {
        // Если пользователь не найден, создаём с ролью driver
        STATE.currentUser = {
            vk_id: vkUser.id,
            name: `${vkUser.first_name} ${vkUser.last_name}`,
            role: 'driver',
            created_at: new Date().toISOString(),
            vk_data: vkUser
        };
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================

function initializeApp() {
    // Отображаем информацию о пользователе
    document.getElementById('user-name').textContent = STATE.currentUser.name;
    const roleText = {
        'driver': 'Водитель',
        'mechanic': 'Механик',
        'admin': 'Администратор',
        'viewer': 'Наблюдатель'
    };
    document.getElementById('user-role').textContent = roleText[STATE.currentUser.role] || STATE.currentUser.role;
    
    // Показываем/скрываем пункты меню в зависимости от роли
    updateMenuByRole();
    
    // Обработчики кнопок
    document.getElementById('logout-btn').onclick = logout;
    
    // Обработчики меню
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = () => {
            const page = item.dataset.page;
            navigateToPage(page);
        };
    });
    
    // Обработчики модальных окон
    setupModalHandlers();
    
    // Обработчики табов
    setupTabHandlers();
    
    // Загружаем данные
    loadAllData();
    
    // Показываем главную страницу
    navigateToPage('dashboard');
}

function updateMenuByRole() {
    const role = STATE.currentUser.role;
    
    // Показываем пункты для механиков
    if (role === 'mechanic' || role === 'admin') {
        document.querySelectorAll('.mechanic-only').forEach(el => el.style.display = 'flex');
    }
    
    // Показываем пункты для админов
    if (role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }
    
    // Показываем статистику для админов и наблюдателей
    if (role === 'admin' || role === 'viewer') {
        document.querySelectorAll('.admin-viewer-only').forEach(el => el.style.display = 'flex');
    }
}

function navigateToPage(pageName) {
    // Убираем active у всех страниц и пунктов меню
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    
    // Активируем нужную страницу
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add('active');
    }
    
    // Активируем пункт меню
    const menuItem = document.querySelector(`[data-page="${pageName}"]`);
    if (menuItem) {
        menuItem.classList.add('active');
    }
    
    STATE.currentPage = pageName;
    
    // Загружаем данные для страницы
    loadPageData(pageName);
}

async function loadAllData() {
    try {
        // Загружаем все данные из Google Sheets
        STATE.cars = await readSheet(CONFIG.SHEETS.CARS);
        STATE.users = await readSheet(CONFIG.SHEETS.USERS);
        STATE.carHistory = await readSheet(CONFIG.SHEETS.CAR_HISTORY);
        STATE.maintenance = await readSheet(CONFIG.SHEETS.MAINTENANCE);
        STATE.penalties = await readSheet(CONFIG.SHEETS.PENALTIES);
        STATE.logs = await readSheet(CONFIG.SHEETS.LOGS);
        
        console.log('✅ Все данные загружены');
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
    }
}

async function loadPageData(pageName) {
    switch (pageName) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'my-cars':
            renderMyCars();
            break;
        case 'take-car':
            renderAvailableCars();
            break;
        case 'maintenance':
            renderMaintenanceCars();
            break;
        case 'admin':
            renderAdminPanel();
            break;
        case 'stats':
            renderStats();
            break;
    }
}

// ============================================
// РЕНДЕРИНГ СТРАНИЦ
// ============================================

function renderDashboard() {
    const cars = STATE.cars.slice(1); // Пропускаем заголовок
    
    // Подсчитываем статистику
    const totalCars = cars.length;
    const availableCars = cars.filter(car => car[3] === 'available').length;
    const inUseCars = cars.filter(car => car[3] === 'in_use').length;
    const maintenanceCars = cars.filter(car => car[3] === 'maintenance').length;
    
    // Обновляем карточки статистики
    document.getElementById('stat-total-cars').textContent = totalCars;
    document.getElementById('stat-available-cars').textContent = availableCars;
    document.getElementById('stat-in-use-cars').textContent = inUseCars;
    document.getElementById('stat-maintenance-cars').textContent = maintenanceCars;
    
    // Рендерим последние логи
    renderRecentLogs();
}

function renderRecentLogs() {
    const container = document.getElementById('recent-logs');
    const logs = STATE.logs.slice(1).reverse().slice(0, 10); // Последние 10 логов
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">Пока нет активности</div></div>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="activity-item">
            <div class="activity-time">${formatDateTime(log[0])}</div>
            <div class="activity-text">${log[3]}</div>
        </div>
    `).join('');
}

function renderMyCars() {
    const container = document.getElementById('my-cars-list');
    const cars = STATE.cars.slice(1);
    const myCars = cars.filter(car => car[4] === String(STATE.currentUser.vk_id));
    
    if (myCars.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚗</div><div class="empty-state-text">У вас нет взятых автомобилей</div></div>';
        return;
    }
    
    container.innerHTML = myCars.map(car => {
        const carId = car[0];
        const brand = car[1];
        const model = car[2];
        const fuelLevel = car[5];
        const isBroken = car[6] === 'true';
        
        return `
            <div class="car-card">
                <div class="car-header">
                    <div class="car-brand">${brand} ${model}</div>
                    <div class="car-status status-in-use">В использовании</div>
                </div>
                <div class="car-info">
                    <div class="car-info-row">
                        <span>⛽ Бензин:</span>
                        <span>${fuelLevel}л</span>
                    </div>
                    <div class="car-info-row">
                        <span>🔧 Состояние:</span>
                        <span>${isBroken ? '❌ Поломано' : '✅ Исправно'}</span>
                    </div>
                </div>
                <div class="car-actions">
                    <button class="btn btn-primary" onclick="returnCar('${carId}')">
                        🔄 Вернуть автомобиль
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderAvailableCars() {
    const container = document.getElementById('available-cars-list');
    const cars = STATE.cars.slice(1);
    const availableCars = cars.filter(car => car[3] === 'available');
    
    if (availableCars.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚗</div><div class="empty-state-text">Нет доступных автомобилей</div></div>';
        return;
    }
    
    container.innerHTML = availableCars.map(car => {
        const carId = car[0];
        const brand = car[1];
        const model = car[2];
        const fuelLevel = car[5];
        const isBroken = car[6] === 'true';
        
        return `
            <div class="car-card">
                <div class="car-header">
                    <div class="car-brand">${brand} ${model}</div>
                    <div class="car-status status-available">Доступен</div>
                </div>
                <div class="car-info">
                    <div class="car-info-row">
                        <span>⛽ Бензин:</span>
                        <span>${fuelLevel}л</span>
                    </div>
                    <div class="car-info-row">
                        <span>🔧 Состояние:</span>
                        <span>${isBroken ? '❌ Поломано' : '✅ Исправно'}</span>
                    </div>
                </div>
                <div class="car-actions">
                    <button class="btn btn-primary" onclick="openTakeCarModal('${carId}', '${brand}', '${model}')">
                        🔑 Взять автомобиль
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderMaintenanceCars() {
    const container = document.getElementById('maintenance-cars-list');
    const cars = STATE.cars.slice(1);
    
    container.innerHTML = cars.map(car => {
        const carId = car[0];
        const brand = car[1];
        const model = car[2];
        const status = car[3];
        const fuelLevel = car[5];
        const isBroken = car[6] === 'true';
        
        const statusClass = status === 'available' ? 'status-available' : status === 'in_use' ? 'status-in-use' : 'status-maintenance';
        const statusText = status === 'available' ? 'Доступен' : status === 'in_use' ? 'В использовании' : 'На обслуживании';
        
        return `
            <div class="car-card">
                <div class="car-header">
                    <div class="car-brand">${brand} ${model}</div>
                    <div class="car-status ${statusClass}">${statusText}</div>
                </div>
                <div class="car-info">
                    <div class="car-info-row">
                        <span>⛽ Бензин:</span>
                        <span>${fuelLevel}л</span>
                    </div>
                    <div class="car-info-row">
                        <span>🔧 Состояние:</span>
                        <span>${isBroken ? '❌ Поломано' : '✅ Исправно'}</span>
                    </div>
                </div>
                <div class="car-actions">
                    <button class="btn btn-primary" onclick="openMaintenanceModal('${carId}', '${brand}', '${model}')">
                        🔧 Обслужить
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// ОБРАБОТЧИКИ МОДАЛЬНЫХ ОКОН
// ============================================

function setupModalHandlers() {
    // Взятие автомобиля
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = closeAllModals;
    });
    
    document.getElementById('cancel-take-car').onclick = closeAllModals;
    document.getElementById('confirm-take-car').onclick = confirmTakeCar;
    
    // Переключение состояния автомобиля
    document.querySelectorAll('input[name="car-condition"]').forEach(radio => {
        radio.onchange = (e) => {
            const brokenFields = document.getElementById('broken-car-fields');
            brokenFields.style.display = e.target.value === 'broken' ? 'block' : 'none';
        };
    });
    
    // Обслуживание
    document.getElementById('cancel-maintenance').onclick = closeAllModals;
    document.getElementById('confirm-maintenance').onclick = confirmMaintenance;
    
    document.querySelectorAll('input[name="was-broken"]').forEach(radio => {
        radio.onchange = (e) => {
            const repairFields = document.getElementById('repair-fields');
            repairFields.style.display = e.target.value === 'yes' ? 'block' : 'none';
        };
    });
    
    // Админ панель
    document.getElementById('cancel-role-change').onclick = closeAllModals;
    document.getElementById('confirm-role-change').onclick = confirmRoleChange;
    
    document.getElementById('cancel-penalty').onclick = closeAllModals;
    document.getElementById('confirm-penalty').onclick = confirmPenalty;
    
    // Закрытие по клику вне модального окна
    document.querySelectorAll('.modal').forEach(modal => {
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        };
    });
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// ============================================
// ДЕЙСТВИЯ С АВТОМОБИЛЯМИ
// ============================================

function openTakeCarModal(carId, brand, model) {
    STATE.selectedCar = carId;
    
    document.getElementById('selected-car-info').innerHTML = `
        <div style="padding: 16px; background: var(--bg-card); border-radius: 8px; margin-bottom: 16px;">
            <h4>${brand} ${model}</h4>
            <p style="color: var(--text-secondary); margin-top: 8px;">ID: ${carId}</p>
        </div>
    `;
    
    document.getElementById('take-car-modal').style.display = 'flex';
}

async function confirmTakeCar() {
    const fuelLevel = document.getElementById('fuel-level').value;
    const condition = document.querySelector('input[name="car-condition"]:checked').value;
    const repairCost = document.getElementById('repair-cost').value || '0';
    const damageDescription = document.getElementById('damage-description').value || '';
    
    if (!fuelLevel) {
        showNotification('Укажите количество бензина', 'warning');
        return;
    }
    
    const isBroken = condition === 'broken';
    const carId = STATE.selectedCar;
    
    try {
        // Обновляем статус автомобиля в листе Cars
        const carIndex = STATE.cars.findIndex(car => car[0] === carId);
        if (carIndex > 0) {
            STATE.cars[carIndex][3] = 'in_use'; // status
            STATE.cars[carIndex][4] = STATE.currentUser.vk_id; // current_user_vk_id
            STATE.cars[carIndex][5] = fuelLevel; // fuel_level
            STATE.cars[carIndex][6] = String(isBroken); // is_broken
            STATE.cars[carIndex][7] = repairCost; // cost
            
            await updateSheet(CONFIG.SHEETS.CARS, carIndex + 1, STATE.cars[carIndex]);
        }
        
        // Добавляем запись в историю
        const historyEntry = [
            generateId(),
            carId,
            STATE.currentUser.vk_id,
            'take',
            fuelLevel,
            fuelLevel,
            String(isBroken),
            repairCost,
            new Date().toISOString(),
            '' // returned_at
        ];
        await appendSheet(CONFIG.SHEETS.CAR_HISTORY, historyEntry);
        STATE.carHistory.push(historyEntry);
        
        // Логируем действие
        const carInfo = STATE.cars[carIndex];
        await logAction(
            STATE.currentUser.vk_id,
            'car_take',
            `Взял автомобиль ${carInfo[1]} ${carInfo[2]} (ID: ${carId})${isBroken ? ', ПОЛОМАН' : ''}`
        );
        
        // Отправляем в VK чат
        await sendToVKChat(`🚗 ${STATE.currentUser.name} взял автомобиль ${carInfo[1]} ${carInfo[2]}\n⛽ Бензин: ${fuelLevel}л\n${isBroken ? '❌ Состояние: ПОЛОМАН\n💰 Оценка: ' + repairCost + '₽' : '✅ Состояние: исправно'}`);
        
        showNotification('Автомобиль успешно взят!', 'success');
        closeAllModals();
        
        // Обновляем страницу
        await loadAllData();
        renderAvailableCars();
        
        // Очищаем форму
        document.getElementById('fuel-level').value = '';
        document.getElementById('repair-cost').value = '';
        document.getElementById('damage-description').value = '';
    } catch (error) {
        console.error('❌ Ошибка при взятии автомобиля:', error);
        showNotification('Ошибка при взятии автомобиля', 'error');
    }
}

async function returnCar(carId) {
    if (!confirm('Подтвердите возврат автомобиля на стоянку')) {
        return;
    }
    
    try {
        // Находим автомобиль
        const carIndex = STATE.cars.findIndex(car => car[0] === carId);
        if (carIndex <= 0) {
            showNotification('Автомобиль не найден', 'error');
            return;
        }
        
        const car = STATE.cars[carIndex];
        
        // Обновляем статус автомобиля
        car[3] = 'available'; // status
        car[4] = ''; // current_user_vk_id
        
        await updateSheet(CONFIG.SHEETS.CARS, carIndex + 1, car);
        
        // Обновляем историю - ставим время возврата
        const historyIndex = STATE.carHistory.findIndex(
            h => h[1] === carId && h[2] === String(STATE.currentUser.vk_id) && h[9] === ''
        );
        
        if (historyIndex >= 0) {
            STATE.carHistory[historyIndex][9] = new Date().toISOString();
            await updateSheet(CONFIG.SHEETS.CAR_HISTORY, historyIndex + 1, STATE.carHistory[historyIndex]);
        }
        
        // Логируем действие
        await logAction(
            STATE.currentUser.vk_id,
            'car_return',
            `Вернул автомобиль ${car[1]} ${car[2]} (ID: ${carId})`
        );
        
        // Отправляем в VK чат
        await sendToVKChat(`🔄 ${STATE.currentUser.name} вернул автомобиль ${car[1]} ${car[2]} на стоянку`);
        
        showNotification('Автомобиль успешно возвращён!', 'success');
        
        // Обновляем данные
        await loadAllData();
        renderMyCars();
    } catch (error) {
        console.error('❌ Ошибка при возврате автомобиля:', error);
        showNotification('Ошибка при возврате автомобиля', 'error');
    }
}

// ============================================
// ОБСЛУЖИВАНИЕ (ДЛЯ МЕХАНИКОВ)
// ============================================

function openMaintenanceModal(carId, brand, model) {
    STATE.selectedCar = carId;
    
    document.getElementById('maintenance-car-info').innerHTML = `
        <div style="padding: 16px; background: var(--bg-card); border-radius: 8px; margin-bottom: 16px;">
            <h4>${brand} ${model}</h4>
            <p style="color: var(--text-secondary); margin-top: 8px;">ID: ${carId}</p>
        </div>
    `;
    
    document.getElementById('maintenance-modal').style.display = 'flex';
}

async function confirmMaintenance() {
    const fuelBefore = document.getElementById('fuel-before').value;
    const fuelAfter = document.getElementById('fuel-after').value;
    const wasBroken = document.querySelector('input[name="was-broken"]:checked').value === 'yes';
    const repaired = wasBroken ? document.querySelector('input[name="repaired"]:checked').value === 'yes' : false;
    const notes = document.getElementById('maintenance-notes').value;
    
    if (!fuelBefore || !fuelAfter) {
        showNotification('Укажите количество бензина до и после', 'warning');
        return;
    }
    
    const carId = STATE.selectedCar;
    
    try {
        // Обновляем автомобиль
        const carIndex = STATE.cars.findIndex(car => car[0] === carId);
        if (carIndex > 0) {
            STATE.cars[carIndex][5] = fuelAfter; // fuel_level
            STATE.cars[carIndex][6] = String(!repaired && wasBroken); // is_broken (false если починили)
            STATE.cars[carIndex][3] = repaired || !wasBroken ? 'available' : 'maintenance'; // status
            
            await updateSheet(CONFIG.SHEETS.CARS, carIndex + 1, STATE.cars[carIndex]);
        }
        
        // Добавляем запись об обслуживании
        const maintenanceEntry = [
            generateId(),
            carId,
            STATE.currentUser.vk_id,
            fuelBefore,
            fuelAfter,
            String(wasBroken),
            String(repaired),
            notes,
            new Date().toISOString()
        ];
        await appendSheet(CONFIG.SHEETS.MAINTENANCE, maintenanceEntry);
        STATE.maintenance.push(maintenanceEntry);
        
        // Логируем действие
        const carInfo = STATE.cars[carIndex];
        await logAction(
            STATE.currentUser.vk_id,
            'maintenance',
            `Обслужил ${carInfo[1]} ${carInfo[2]} (ID: ${carId})${wasBroken ? (repaired ? ', ПОЧИНИЛ' : ', НЕ ПОЧИНИЛ') : ''}`
        );
        
        // Отправляем в VK чат
        await sendToVKChat(`🔧 ${STATE.currentUser.name} обслужил ${carInfo[1]} ${carInfo[2]}\n⛽ Бензин: ${fuelBefore}л → ${fuelAfter}л${wasBroken ? (repaired ? '\n✅ Автомобиль починен' : '\n❌ Автомобиль НЕ починен') : ''}\n📝 ${notes || 'Без примечаний'}`);
        
        showNotification('Обслуживание завершено!', 'success');
        closeAllModals();
        
        // Обновляем данные
        await loadAllData();
        renderMaintenanceCars();
        
        // Очищаем форму
        document.getElementById('fuel-before').value = '';
        document.getElementById('fuel-after').value = '';
        document.getElementById('maintenance-notes').value = '';
    } catch (error) {
        console.error('❌ Ошибка при обслуживании:', error);
        showNotification('Ошибка при обслуживании', 'error');
    }
}

// ============================================
// АДМИН-ПАНЕЛЬ
// ============================================

function setupTabHandlers() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            const tabName = btn.dataset.tab;
            
            // Убираем active у всех табов
            btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Убираем active у всего контента
            const container = btn.parentElement.parentElement;
            container.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Активируем нужный контент
            const content = document.getElementById(`tab-${tabName}`);
            if (content) {
                content.classList.add('active');
                
                // Загружаем данные для таба
                loadTabData(tabName);
            }
        };
    });
}

async function loadTabData(tabName) {
    switch (tabName) {
        case 'users':
            renderUsersList();
            break;
        case 'cars-admin':
            renderAdminCarsList();
            break;
        case 'penalties':
            renderPenaltiesList();
            break;
        case 'logs':
            renderAllLogs();
            break;
        case 'car-stats':
            renderCarStats();
            break;
        case 'user-stats':
            renderUserStats();
            break;
    }
}

function renderAdminPanel() {
    renderUsersList();
}

function renderUsersList() {
    const container = document.getElementById('users-list');
    const users = STATE.users.slice(1);
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Нет пользователей</div></div>';
        return;
    }
    
    const roleText = {
        'driver': 'Водитель',
        'mechanic': 'Механик',
        'admin': 'Администратор',
        'viewer': 'Наблюдатель'
    };
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>VK ID</th>
                    <th>Имя</th>
                    <th>Роль</th>
                    <th>Дата регистрации</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user[0]}</td>
                        <td>${user[1]}</td>
                        <td><span class="badge">${roleText[user[2]] || user[2]}</span></td>
                        <td>${formatDateTime(user[3])}</td>
                        <td>
                            <button class="btn btn-small btn-ghost" onclick="openRoleModal('${user[0]}', '${user[1]}', '${user[2]}')">
                                Изменить роль
                            </button>
                            <button class="btn btn-small btn-ghost" onclick="viewUserHistory('${user[0]}')">
                                История
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminCarsList() {
    const container = document.getElementById('admin-cars-list');
    const cars = STATE.cars.slice(1);
    
    const statusText = {
        'available': 'Доступен',
        'in_use': 'В использовании',
        'maintenance': 'На обслуживании'
    };
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Марка</th>
                    <th>Модель</th>
                    <th>Статус</th>
                    <th>Бензин</th>
                    <th>Состояние</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
                ${cars.map(car => `
                    <tr>
                        <td>${car[0]}</td>
                        <td>${car[1]}</td>
                        <td>${car[2]}</td>
                        <td><span class="badge">${statusText[car[3]] || car[3]}</span></td>
                        <td>${car[5]}л</td>
                        <td>${car[6] === 'true' ? '❌ Поломано' : '✅ Исправно'}</td>
                        <td>
                            <button class="btn btn-small btn-ghost" onclick="viewCarHistory('${car[0]}')">
                                История
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderPenaltiesList() {
    const container = document.getElementById('penalties-list');
    const penalties = STATE.penalties.slice(1);
    
    if (penalties.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Нет взысканий</div></div>';
        return;
    }
    
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Пользователь</th>
                    <th>Автомобиль</th>
                    <th>Причина</th>
                    <th>Сумма</th>
                    <th>Кем выдано</th>
                    <th>Дата</th>
                </tr>
            </thead>
            <tbody>
                ${penalties.map(penalty => {
                    const user = STATE.users.find(u => u[0] === penalty[1]);
                    const issuer = STATE.users.find(u => u[0] === penalty[5]);
                    return `
                        <tr>
                            <td>${user ? user[1] : penalty[1]}</td>
                            <td>${penalty[2]}</td>
                            <td>${penalty[3]}</td>
                            <td>${penalty[4]}₽</td>
                            <td>${issuer ? issuer[1] : penalty[5]}</td>
                            <td>${formatDateTime(penalty[6])}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function openRoleModal(vkId, name, currentRole) {
    document.getElementById('role-change-user').textContent = `${name} (VK ID: ${vkId})`;
    document.getElementById('new-role').value = currentRole;
    
    document.getElementById('confirm-role-change').onclick = () => confirmRoleChange(vkId);
    
    document.getElementById('role-modal').style.display = 'flex';
}

async function confirmRoleChange(vkId) {
    const newRole = document.getElementById('new-role').value;
    
    try {
        // Находим пользователя
        const userIndex = STATE.users.findIndex(user => user[0] === vkId);
        if (userIndex > 0) {
            const oldRole = STATE.users[userIndex][2];
            STATE.users[userIndex][2] = newRole;
            
            await updateSheet(CONFIG.SHEETS.USERS, userIndex + 1, STATE.users[userIndex]);
            
            // Логируем
            await logAction(
                STATE.currentUser.vk_id,
                'role_change',
                `Изменил роль пользователя ${STATE.users[userIndex][1]} с ${oldRole} на ${newRole}`
            );
            
            showNotification('Роль успешно изменена!', 'success');
            closeAllModals();
            renderUsersList();
        }
    } catch (error) {
        console.error('❌ Ошибка изменения роли:', error);
        showNotification('Ошибка при изменении роли', 'error');
    }
}

// Обработчики кнопок админ-панели
document.getElementById('add-penalty-btn')?.addEventListener('click', () => {
    document.getElementById('penalty-modal').style.display = 'flex';
});

async function confirmPenalty() {
    const userId = document.getElementById('penalty-user-id').value;
    const carId = document.getElementById('penalty-car-id').value;
    const reason = document.getElementById('penalty-reason').value;
    const amount = document.getElementById('penalty-amount').value;
    
    if (!userId || !reason) {
        showNotification('Заполните обязательные поля', 'warning');
        return;
    }
    
    try {
        const penaltyEntry = [
            generateId(),
            userId,
            carId || '',
            reason,
            amount || '0',
            STATE.currentUser.vk_id,
            new Date().toISOString()
        ];
        
        await appendSheet(CONFIG.SHEETS.PENALTIES, penaltyEntry);
        STATE.penalties.push(penaltyEntry);
        
        // Логируем
        await logAction(
            STATE.currentUser.vk_id,
            'penalty_issued',
            `Выдал взыскание пользователю ${userId}: ${reason} (${amount}₽)`
        );
        
        // Отправляем в VK чат
        await sendToVKChat(`⚠️ ${STATE.currentUser.name} выдал взыскание\n👤 Пользователь: ${userId}\n📝 Причина: ${reason}\n💰 Сумма: ${amount}₽`);
        
        showNotification('Взыскание выдано!', 'success');
        closeAllModals();
        
        // Очищаем форму
        document.getElementById('penalty-user-id').value = '';
        document.getElementById('penalty-car-id').value = '';
        document.getElementById('penalty-reason').value = '';
        document.getElementById('penalty-amount').value = '';
        
        renderPenaltiesList();
    } catch (error) {
        console.error('❌ Ошибка при выдаче взыскания:', error);
        showNotification('Ошибка при выдаче взыскания', 'error');
    }
}

// Продолжение следует...

// ============================================
// СТАТИСТИКА
// ============================================

function renderStats() {
    renderAllLogs();
}

function renderAllLogs() {
    const container = document.getElementById('all-logs');
    const logs = STATE.logs.slice(1).reverse();
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Нет логов</div></div>';
        return;
    }
    
    container.innerHTML = logs.map(log => {
        const user = STATE.users.find(u => u[0] === log[1]);
        return `
            <div class="log-item">
                <div class="log-time">${formatDateTime(log[0])}</div>
                <div class="log-text">
                    <strong>${user ? user[1] : log[1]}</strong> - ${log[3]}
                </div>
            </div>
        `;
    }).join('');
}

function renderCarStats() {
    const container = document.getElementById('car-stats-content');
    const cars = STATE.cars.slice(1);
    
    container.innerHTML = cars.map(car => {
        const carId = car[0];
        const brand = car[1];
        const model = car[2];
        
        const history = STATE.carHistory.slice(1).filter(h => h[1] === carId);
        const maintenanceHistory = STATE.maintenance.slice(1).filter(m => m[1] === carId);
        
        return `
            <div class="car-stats-card" style="background: var(--bg-secondary); padding: 24px; border-radius: var(--radius); margin-bottom: 24px; border: 1px solid var(--border);">
                <h3>${brand} ${model} (ID: ${carId})</h3>
                
                <div style="margin-top: 16px;">
                    <h4>История использования (${history.length})</h4>
                    <div style="margin-top: 12px;">
                        ${history.length === 0 ? '<p style="color: var(--text-muted);">Нет записей</p>' : history.map(h => {
                            const user = STATE.users.find(u => u[0] === h[2]);
                            return `
                                <div style="padding: 12px; background: var(--bg-card); border-radius: 8px; margin-bottom: 8px;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <span><strong>${user ? user[1] : h[2]}</strong></span>
                                        <span style="color: var(--text-muted);">${formatDateTime(h[8])}</span>
                                    </div>
                                    <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">
                                        ${h[3] === 'take' ? '🔑 Взял' : '🔄 Вернул'} | 
                                        ⛽ ${h[4]}л → ${h[5]}л | 
                                        ${h[6] === 'true' ? '❌ Поломан' : '✅ Исправен'}
                                        ${h[9] ? ` | Вернул: ${formatDateTime(h[9])}` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <div style="margin-top: 20px;">
                    <h4>История обслуживания (${maintenanceHistory.length})</h4>
                    <div style="margin-top: 12px;">
                        ${maintenanceHistory.length === 0 ? '<p style="color: var(--text-muted);">Нет записей</p>' : maintenanceHistory.map(m => {
                            const mechanic = STATE.users.find(u => u[0] === m[2]);
                            return `
                                <div style="padding: 12px; background: var(--bg-card); border-radius: 8px; margin-bottom: 8px;">
                                    <div style="display: flex; justify-content: space-between;">
                                        <span><strong>🔧 ${mechanic ? mechanic[1] : m[2]}</strong></span>
                                        <span style="color: var(--text-muted);">${formatDateTime(m[8])}</span>
                                    </div>
                                    <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">
                                        ⛽ ${m[3]}л → ${m[4]}л | 
                                        ${m[5] === 'true' ? (m[6] === 'true' ? '✅ Починен' : '❌ Не починен') : 'Без поломок'}
                                        ${m[7] ? ` | ${m[7]}` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderUserStats() {
    const container = document.getElementById('user-stats-content');
    const users = STATE.users.slice(1);
    
    container.innerHTML = users.map(user => {
        const vkId = user[0];
        const name = user[1];
        const role = user[2];
        
        const carsTaken = STATE.carHistory.slice(1).filter(h => h[2] === vkId);
        const maintenanceDone = STATE.maintenance.slice(1).filter(m => m[2] === vkId);
        const penalties = STATE.penalties.slice(1).filter(p => p[1] === vkId);
        
        const roleText = {
            'driver': 'Водитель',
            'mechanic': 'Механик',
            'admin': 'Администратор',
            'viewer': 'Наблюдатель'
        };
        
        return `
            <div class="user-stats-card" style="background: var(--bg-secondary); padding: 24px; border-radius: var(--radius); margin-bottom: 24px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>${name}</h3>
                    <span class="badge">${roleText[role] || role}</span>
                </div>
                <p style="color: var(--text-muted); margin-top: 8px;">VK ID: ${vkId}</p>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px;">
                    <div style="text-align: center; padding: 16px; background: var(--bg-card); border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${carsTaken.length}</div>
                        <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">Взято авто</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--bg-card); border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--success);">${maintenanceDone.length}</div>
                        <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">Обслуживаний</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--bg-card); border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--danger);">${penalties.length}</div>
                        <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">Взысканий</div>
                    </div>
                </div>
                
                ${penalties.length > 0 ? `
                    <div style="margin-top: 20px;">
                        <h4>Взыскания:</h4>
                        <div style="margin-top: 12px;">
                            ${penalties.map(p => `
                                <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 3px solid var(--danger); margin-bottom: 8px;">
                                    <div style="font-weight: 600;">${p[3]}</div>
                                    <div style="color: var(--text-secondary); font-size: 14px; margin-top: 4px;">
                                        ${p[4]}₽ | ${formatDateTime(p[6])}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function viewCarHistory(carId) {
    navigateToPage('stats');
    
    setTimeout(() => {
        const carStatsTab = document.querySelector('[data-tab="car-stats"]');
        if (carStatsTab) {
            carStatsTab.click();
        }
    }, 100);
}

function viewUserHistory(vkId) {
    navigateToPage('stats');
    
    setTimeout(() => {
        const userStatsTab = document.querySelector('[data-tab="user-stats"]');
        if (userStatsTab) {
            userStatsTab.click();
        }
    }, 100);
}

// ============================================
// ЛОГИРОВАНИЕ
// ============================================

async function logAction(userId, action, details) {
    const logEntry = [
        new Date().toISOString(),
        userId,
        action,
        details,
        'web'
    ];
    
    try {
        await appendSheet(CONFIG.SHEETS.LOGS, logEntry);
        STATE.logs.push(logEntry);
        console.log('✅ Лог записан:', details);
    } catch (error) {
        console.error('❌ Ошибка записи лога:', error);
    }
}

async function sendToVKChat(message) {
    if (!CONFIG.VK_ACCESS_TOKEN || !CONFIG.VK_CHAT_ID) {
        console.log('📝 VK Chat не настроен, сообщение:', message);
        return;
    }
    
    try {
        const response = await fetch(`https://api.vk.com/method/messages.send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                access_token: CONFIG.VK_ACCESS_TOKEN,
                chat_id: CONFIG.VK_CHAT_ID,
                message: message,
                random_id: Math.floor(Math.random() * 1000000),
                v: '5.131'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error('❌ Ошибка отправки в VK:', data.error);
        } else {
            console.log('✅ Сообщение отправлено в VK чат');
        }
    } catch (error) {
        console.error('❌ Ошибка отправки в VK чат:', error);
    }
}

// ============================================
// УТИЛИТЫ
// ============================================

function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications-container');
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${getNotificationIcon(type)}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    return icons[type] || icons.info;
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ GOOGLE API
// ============================================

window.addEventListener('load', () => {
    if (typeof gapi !== 'undefined') {
        gapiLoaded();
    }
});

// ============================================
// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

window.openTakeCarModal = openTakeCarModal;
window.returnCar = returnCar;
window.openMaintenanceModal = openMaintenanceModal;
window.openRoleModal = openRoleModal;
window.viewCarHistory = viewCarHistory;
window.viewUserHistory = viewUserHistory;

console.log('🚗 Приложение готово к работе!');