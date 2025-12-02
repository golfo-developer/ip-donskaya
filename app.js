// Конфигурация Supabase
const SUPABASE_URL = 'https://ylhhaswthxeyvnfhbzff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaGhhc3d0aHhleXZuZmhiemZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NjAyMDYsImV4cCI6MjA4MDIzNjIwNn0.scARH5fnfFJdlYeF8KBR6CLXc4xvY55zNgUUO8EOmZI';
const VK_APP_ID = 54372400;

// Инициализация Supabase клиента
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Глобальные переменные
let currentUser = null;
let selectedCarId = null;
let selectedUserId = null;
let currentGarageFilter = 'all';
let currentMaintenanceGarageFilter = 'all';

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Проверяем сохраненную сессию
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    } else {
        showLogin();
    }
}

// Показать экран авторизации
function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    
    // Инициализация VK ID
    setTimeout(() => {
        if (window.VKIDSDK) {
            const VKID = window.VKIDSDK;
            
            VKID.Config.init({
                app: VK_APP_ID,
                redirectUrl: window.location.origin + window.location.pathname,
                responseMode: VKID.ConfigResponseMode.Callback,
                source: VKID.ConfigSource.LOWCODE,
                scope: 'email',
            });
            
            const oneTap = new VKID.OneTap();
            const container = document.getElementById('vk-auth-container');
            
            if (container) {
                oneTap.render({
                    container: container,
                    showAlternativeLogin: true
                })
                .on(VKID.WidgetEvents.ERROR, (error) => {
                    console.error('VK ID Error:', error);
                })
                .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload) => {
                    try {
                        console.log('=== VK LOGIN SUCCESS ===');
                        console.log('Payload:', payload);
                        
                        const code = payload.code;
                        const deviceId = payload.device_id;
                        
                        if (!code) {
                            throw new Error('Код авторизации не получен');
                        }
                        
                        // Обмениваем код на токены
                        const authData = await VKID.Auth.exchangeCode(code, deviceId);
                        console.log('Auth data получен');
                        
                        if (!authData || !authData.access_token) {
                            throw new Error('Не получен access token');
                        }
                        
                        // Получаем данные пользователя через VK ID API
                        console.log('Получаем данные пользователя...');
                        const userData = await fetchUserInfo(authData.access_token);
                        
                        if (!userData) {
                            throw new Error('Не удалось получить данные пользователя');
                        }
                        
                        console.log('Данные пользователя:', userData);
                        
                        // Сохраняем пользователя в Supabase
                        await saveUserToDatabase(userData);
                        
                    } catch (error) {
                        console.error('=== ОШИБКА АВТОРИЗАЦИИ ===');
                        console.error(error);
                        alert(`Ошибка авторизации: ${error.message}\n\nПопробуйте обновить страницу или очистить кэш браузера.`);
                    }
                });
            }
        }
    }, 500);
}

// Получение данных пользователя через VK ID API
async function fetchUserInfo(accessToken) {
    try {
        console.log('Вызов VK ID API user_info...');
        
        const response = await fetch('https://id.vk.ru/oauth2/user_info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: VK_APP_ID.toString(),
                access_token: accessToken
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('VK ID API response:', data);
        
        if (data.error) {
            throw new Error(data.error_description || data.error);
        }
        
        if (!data.user) {
            throw new Error('Нет данных пользователя в ответе');
        }
        
        return data.user;
    } catch (error) {
        console.error('Ошибка получения данных пользователя:', error);
        throw error;
    }
}

// Сохранение пользователя в базу данных
async function saveUserToDatabase(userData) {
    try {
        console.log('Сохранение пользователя в БД...');
        
        const vkUserId = userData.user_id.toString();
        const firstName = userData.first_name || 'Пользователь';
        const lastName = userData.last_name || '';
        
        console.log('VK User ID:', vkUserId);
        console.log('Имя:', firstName, lastName);
        
        // Проверяем, существует ли пользователь
        const { data: existingUser, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('vk_id', vkUserId)
            .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 = запись не найдена, это нормально
            throw fetchError;
        }
        
        if (existingUser) {
            console.log('Пользователь уже существует:', existingUser);
            currentUser = existingUser;
        } else {
            console.log('Создаем нового пользователя...');
            
            // Создаем нового пользователя
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{
                    vk_id: vkUserId,
                    first_name: firstName,
                    last_name: lastName,
                    role: 'user'
                }])
                .select()
                .single();
            
            if (insertError) {
                console.error('Ошибка создания пользователя:', insertError);
                throw insertError;
            }
            
            console.log('Пользователь создан:', newUser);
            currentUser = newUser;
        }
        
        // Сохраняем в localStorage
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        // Показываем приложение
        showApp();
        
    } catch (error) {
        console.error('Ошибка сохранения пользователя:', error);
        throw error;
    }
}

// Обработка авторизации VK (устаревшая функция, оставлена для совместимости)
async function handleVKAuth(authData) {
    // Эта функция больше не используется
    // Логика перенесена в fetchUserInfo и saveUserToDatabase
    console.warn('handleVKAuth вызвана, но больше не используется');
}


// Показать главное приложение
function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    
    // Отображаем имя пользователя
    const userName = document.getElementById('userName');
    const displayName = currentUser.custom_position || getRoleDisplayName(currentUser.role);
    userName.textContent = `${currentUser.first_name} ${currentUser.last_name} - ${displayName}`;
    
    // Настраиваем навигацию в зависимости от роли
    setupNavigation();
    
    // Загружаем данные
    loadCars();
    
    // Настраиваем обработчики событий
    setupEventListeners();
}

// Настройка навигации
function setupNavigation() {
    const isAdmin = currentUser.role === 'deputy_director' || currentUser.role === 'director';
    const isSeniorManager = currentUser.role === 'senior_manager' || isAdmin;
    
    // Показываем/скрываем вкладки
    const navButtons = {
        users: isAdmin,  // Только администраторы (зам. директора и директор)
        maintenance: isSeniorManager,  // Старший менеджер и выше
        statistics: isAdmin,  // Только администраторы
        verification: isAdmin  // Только администраторы
    };
    
    Object.entries(navButtons).forEach(([tab, show]) => {
        const btn = document.querySelector(`[data-tab="${tab}"]`);
        if (btn) {
            btn.style.display = show ? 'block' : 'none';
        }
    });
    
    // Показываем кнопку добавления автомобиля для админов
    const addCarBtn = document.getElementById('addCarBtn');
    if (addCarBtn) {
        addCarBtn.style.display = isAdmin ? 'block' : 'none';
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация между вкладками
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Фильтры гаражей
    document.querySelectorAll('.filter-btn[data-garage]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentGarageFilter = btn.dataset.garage;
            document.querySelectorAll('.filter-btn[data-garage]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadCars();
        });
    });
    
    // Фильтры гаражей для обслуживания
    document.querySelectorAll('.filter-btn[data-garage-m]').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMaintenanceGarageFilter = btn.dataset['garageM'];
            document.querySelectorAll('.filter-btn[data-garage-m]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadMaintenanceCars();
        });
    });
    
    // Подвкладки обслуживания
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const subtab = btn.dataset.subtab;
            document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.subtab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(subtab + 'Subtab').classList.add('active');
            
            if (subtab === 'history') {
                loadMaintenanceHistory();
            }
        });
    });
    
    // Кнопка добавления автомобиля
    const addCarBtn = document.getElementById('addCarBtn');
    if (addCarBtn) {
        addCarBtn.addEventListener('click', () => openModal('addCarModal'));
    }
    
    // Форма добавления автомобиля
    const addCarForm = document.getElementById('addCarForm');
    if (addCarForm) {
        addCarForm.addEventListener('submit', handleAddCar);
        
        // Показываем поле "Место" только для общего гаража
        const garageTypeSelect = addCarForm.querySelector('[name="garage_type"]');
        garageTypeSelect.addEventListener('change', () => {
            const locationGroup = document.getElementById('locationGroup');
            locationGroup.style.display = garageTypeSelect.value === 'general' ? 'block' : 'none';
        });
        
        // Обработка загрузки фото через input
        const photoInput = document.getElementById('carPhotoInput');
        if (photoInput) {
            photoInput.addEventListener('change', handlePhotoSelect);
        }
        
        // Обработка вставки фото через Ctrl+V
        addCarForm.addEventListener('paste', handlePhotoPaste);
    }
    
    // Форма взятия автомобиля
    const takeCarForm = document.getElementById('takeCarForm');
    if (takeCarForm) {
        takeCarForm.addEventListener('submit', handleTakeCar);
    }
    
    // Форма возврата автомобиля
    const returnCarForm = document.getElementById('returnCarForm');
    if (returnCarForm) {
        returnCarForm.addEventListener('submit', handleReturnCar);
    }
    
    // Форма редактирования пользователя
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
        editUserForm.addEventListener('submit', handleEditUser);
        
        // Показываем поле индивидуальной должности для высоких ролей
        const roleSelect = editUserForm.querySelector('[name="role"]');
        roleSelect.addEventListener('change', () => {
            const customPositionGroup = document.getElementById('customPositionGroup');
            const highRoles = ['senior_manager', 'deputy_director', 'director'];
            customPositionGroup.style.display = highRoles.includes(roleSelect.value) ? 'block' : 'none';
        });
    }
    
    // Форма обслуживания
    const maintenanceForm = document.getElementById('maintenanceForm');
    if (maintenanceForm) {
        maintenanceForm.addEventListener('submit', handleMaintenance);
        
        const wasDamagedCheck = document.getElementById('wasDamagedCheck');
        const repairedCheck = document.getElementById('repairedCheck');
        
        wasDamagedCheck.addEventListener('change', () => {
            const repairGroup = document.getElementById('repairGroup');
            repairGroup.style.display = wasDamagedCheck.checked ? 'block' : 'none';
            
            if (!wasDamagedCheck.checked) {
                repairedCheck.checked = false;
                document.getElementById('repairCostGroup').style.display = 'none';
            }
        });
        
        repairedCheck.addEventListener('change', () => {
            const repairCostGroup = document.getElementById('repairCostGroup');
            repairCostGroup.style.display = repairedCheck.checked ? 'block' : 'none';
        });
    }
}

// Переключение вкладок
function switchTab(tabName) {
    // Обновляем навигацию
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Обновляем контент
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Загружаем данные для активной вкладки
    switch(tabName) {
        case 'cars':
            loadCars();
            break;
        case 'mycars':
            loadMyCars();
            break;
        case 'users':
            loadUsers();
            break;
        case 'maintenance':
            loadMaintenanceCars();
            break;
        case 'statistics':
            loadStatistics();
            break;
        case 'verification':
            loadVerification();
            break;
    }
}

// Получить отображаемое название роли
function getRoleDisplayName(role) {
    const roleNames = {
        user: 'Пользователь',
        senior_staff: 'Старший состав',
        junior_staff: 'Младший состав',
        manager: 'Менеджер',
        senior_manager: 'Старший менеджер',
        deputy_director: 'Зам. Директора',
        director: 'Директор'
    };
    return roleNames[role] || role;
}

// Получить цвет для роли
function getRoleBadgeClass(role) {
    const colors = {
        user: 'background: #f3f4f6; color: #374151;',
        senior_staff: 'background: #dbeafe; color: #1e40af;',
        junior_staff: 'background: #cffafe; color: #155e75;',
        manager: 'background: #d1fae5; color: #065f46;',
        senior_manager: 'background: #fef3c7; color: #92400e;',
        deputy_director: 'background: #fed7aa; color: #9a3412;',
        director: 'background: #fee2e2; color: #991b1b;'
    };
    return colors[role] || colors.user;
}

// Получить название гаража
function getGarageLabel(type) {
    const labels = {
        general: 'Общий гараж',
        tk: 'ТК',
        atp: 'АТП'
    };
    return labels[type] || type;
}

// Выход из системы
function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    location.reload();
}

// Работа с модальными окнами
function openModal(modalId) {
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById('modalOverlay').classList.add('hidden');
    document.getElementById(modalId).classList.add('hidden');
    
    // Сбрасываем формы
    const modal = document.getElementById(modalId);
    const form = modal.querySelector('form');
    if (form) form.reset();
}

// Закрытие модального окна при клике на overlay
document.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') {
        document.querySelectorAll('.modal').forEach(modal => {
            if (!modal.classList.contains('hidden')) {
                closeModal(modal.id);
            }
        });
    }
});

// ==================== РАБОТА С АВТОМОБИЛЯМИ ====================

// Глобальная переменная для хранения фото
let selectedCarPhoto = null;

// Обработка выбора фото через input
function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        displayPhotoPreview(file);
    }
}

// Обработка вставки фото через Ctrl+V
function handlePhotoPaste(e) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            displayPhotoPreview(file);
            e.preventDefault();
            break;
        }
    }
}

// Отображение превью фото
function displayPhotoPreview(file) {
    selectedCarPhoto = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('photoPreview');
        const img = document.getElementById('photoPreviewImg');
        img.src = e.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Конвертация фото в Base64
async function convertPhotoToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Загрузка автомобилей
async function loadCars() {
    const carsList = document.getElementById('carsList');
    carsList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    try {
        let query = supabase.from('cars').select('*').order('name');
        
        if (currentGarageFilter !== 'all') {
            query = query.eq('garage_type', currentGarageFilter);
        }
        
        // ВАЖНО: Показываем только доступные автомобили
        query = query.eq('is_available', true);
        
        const { data: cars, error } = await query;
        
        if (error) throw error;
        
        if (!cars || cars.length === 0) {
            carsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <p class="empty-state-text">Нет доступных автомобилей</p>
                    <p style="color: #9ca3af; font-size: 14px; margin-top: 10px;">Все автомобили заняты. Проверьте вкладку "Мои авто"</p>
                </div>
            `;
            return;
        }
        
        // Получаем активные использования для текущего пользователя
        const { data: activeUsages } = await supabase
            .from('car_usage')
            .select('*')
            .eq('user_id', currentUser.id)
            .is('returned_at', null);
        
        const userActiveCars = new Set(activeUsages?.map(u => u.car_id) || []);
        
        carsList.innerHTML = cars.map(car => {
            const isUserUsing = userActiveCars.has(car.id);
            const canTake = car.is_available && !isUserUsing;
            const canReturn = isUserUsing;
            
            return `
                <div class="car-card ${!car.is_available ? 'unavailable' : ''} ${car.is_damaged ? 'damaged' : ''}">
                    ${car.photo_url ? `
                        <div style="width: 100%; height: 150px; overflow: hidden; border-radius: 10px; margin-bottom: 15px;">
                            <img src="${car.photo_url}" alt="${car.name}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    ` : ''}
                    <div class="car-header">
                        <div class="car-title">${car.name}</div>
                        ${car.is_damaged ? '<span style="color: #f59e0b; font-size: 20px;">⚠️</span>' : ''}
                    </div>
                    <div class="car-info">
                        <div class="car-info-row">
                            <span class="car-info-label">Номер:</span>
                            <span class="car-info-value">${car.license_plate}</span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Цвет:</span>
                            <span class="car-info-value">${car.color}</span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Гараж:</span>
                            <span class="car-info-value">${getGarageLabel(car.garage_type)}</span>
                        </div>
                        ${car.location ? `
                        <div class="car-info-row">
                            <span class="car-info-label">Место:</span>
                            <span class="car-info-value">${car.location}</span>
                        </div>
                        ` : ''}
                        ${car.stages ? `
                        <div class="car-info-row">
                            <span class="car-info-label">Стейджи:</span>
                            <span class="car-info-value">${car.stages}</span>
                        </div>
                        ` : ''}
                        <div class="car-info-row">
                            <span class="car-info-label">Топливо:</span>
                            <span class="car-info-value">${car.current_fuel_level || 0} л</span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Стоимость:</span>
                            <span class="car-info-value">${car.state_cost.toLocaleString()} ₽</span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Статус:</span>
                            <span class="status-badge ${car.is_available ? 'status-available' : 'status-unavailable'}">
                                ${car.is_available ? 'Доступен' : 'Занят'}
                            </span>
                        </div>
                        ${car.is_damaged ? `
                        <div class="car-info-row">
                            <span class="status-badge status-damaged">⚠️ Поврежден</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="car-actions">
                        ${canTake ? `
                            <button class="btn-primary" onclick="openTakeCarModal('${car.id}')">Взять</button>
                        ` : ''}
                        ${canReturn ? `
                            <button class="btn-danger" onclick="openReturnCarModal('${car.id}')">Вернуть</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки автомобилей:', error);
        carsList.innerHTML = '<div class="empty-state"><p class="empty-state-text">Ошибка загрузки данных</p></div>';
    }
}

// Загрузка моих автомобилей (в использовании)
async function loadMyCars() {
    const myCarsList = document.getElementById('myCarsList');
    myCarsList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    try {
        // Получаем активные использования текущего пользователя
        const { data: activeUsages, error: usageError } = await supabase
            .from('car_usage')
            .select(`
                *,
                cars (*)
            `)
            .eq('user_id', currentUser.id)
            .is('returned_at', null);
        
        if (usageError) throw usageError;
        
        if (!activeUsages || activeUsages.length === 0) {
            myCarsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <p class="empty-state-text">У вас нет взятых автомобилей</p>
                    <p style="color: #9ca3af; font-size: 14px; margin-top: 10px;">Перейдите на вкладку "Автомобили" чтобы взять автомобиль</p>
                </div>
            `;
            return;
        }
        
        myCarsList.innerHTML = activeUsages.map(usage => {
            const car = usage.cars;
            if (!car) return '';
            
            const takenDate = new Date(usage.taken_at);
            const hoursUsed = Math.floor((Date.now() - takenDate.getTime()) / (1000 * 60 * 60));
            const minutesUsed = Math.floor((Date.now() - takenDate.getTime()) / (1000 * 60)) % 60;
            
            return `
                <div class="car-card" style="border: 3px solid #667eea;">
                    ${car.photo_url ? `
                        <div style="width: 100%; height: 150px; overflow: hidden; border-radius: 10px; margin-bottom: 15px;">
                            <img src="${car.photo_url}" alt="${car.name}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    ` : ''}
                    <div class="car-header">
                        <div class="car-title">${car.name}</div>
                        <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">В ИСПОЛЬЗОВАНИИ</span>
                    </div>
                    <div class="car-info">
                        <div class="car-info-row">
                            <span class="car-info-label">Номер:</span>
                            <span class="car-info-value">${car.license_plate}</span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Цвет:</span>
                            <span class="car-info-value">${car.color}</span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Гараж:</span>
                            <span class="car-info-value">${getGarageLabel(car.garage_type)}</span>
                        </div>
                        ${car.location ? `
                        <div class="car-info-row">
                            <span class="car-info-label">Место:</span>
                            <span class="car-info-value">${car.location}</span>
                        </div>
                        ` : ''}
                        <div class="car-info-row">
                            <span class="car-info-label">Взято:</span>
                            <span class="car-info-value">${takenDate.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Использую:</span>
                            <span class="car-info-value" style="color: #667eea; font-weight: 600;">
                                ${hoursUsed > 0 ? `${hoursUsed} ч ` : ''}${minutesUsed} мин
                            </span>
                        </div>
                        <div class="car-info-row">
                            <span class="car-info-label">Топливо при взятии:</span>
                            <span class="car-info-value">${usage.fuel_taken || 0} л</span>
                        </div>
                        ${car.is_damaged || usage.was_damaged_on_take ? `
                        <div class="car-info-row">
                            <span class="car-info-label">Повреждения:</span>
                            <span class="car-info-value" style="color: #ef4444;">⚠️ Есть</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="car-actions" style="margin-top: 15px;">
                        <button class="btn-primary" onclick="openReturnCarModal('${car.id}')" style="width: 100%;">
                            Вернуть автомобиль
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка:', error);
        myCarsList.innerHTML = '<div class="empty-state"><p class="empty-state-text">Ошибка загрузки данных</p></div>';
    }
}

// Добавление автомобиля
async function handleAddCar(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    
    let photoBase64 = null;
    if (selectedCarPhoto) {
        photoBase64 = await convertPhotoToBase64(selectedCarPhoto);
    }
    
    const carData = {
        name: formData.get('name'),
        license_plate: formData.get('license_plate'),
        color: formData.get('color'),
        state_cost: parseFloat(formData.get('state_cost')),
        garage_type: formData.get('garage_type'),
        location: formData.get('location'),
        stages: formData.get('stages'),
        photo_url: photoBase64,
        current_fuel_level: parseFloat(formData.get('fuel')) || 0,
        is_available: true,
        is_damaged: false
    };
    
    try {
        const { error } = await supabase.from('cars').insert([carData]);
        
        if (error) throw error;
        
        // Сбрасываем фото
        selectedCarPhoto = null;
        document.getElementById('photoPreview').style.display = 'none';
        
        closeModal('addCarModal');
        loadCars();
        alert('Автомобиль успешно добавлен!');
    } catch (error) {
        console.error('Ошибка добавления автомобиля:', error);
        alert('Ошибка при добавлении автомобиля: ' + error.message);
    }
}

// Открыть модальное окно взятия автомобиля
async function openTakeCarModal(carId) {
    selectedCarId = carId;
    
    try {
        const { data: car, error } = await supabase
            .from('cars')
            .select('*')
            .eq('id', carId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('takeCarInfo').innerHTML = `
            <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p><strong>${car.name}</strong> (${car.license_plate})</p>
                <p style="margin-top: 8px; color: #666;">Текущий уровень топлива: <strong>${car.current_fuel_level || 0} л</strong></p>
            </div>
        `;
        
        openModal('takeCarModal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных автомобиля');
    }
}

// Взять автомобиль
async function handleTakeCar(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const wasDamaged = formData.get('was_damaged') === 'on';
    
    try {
        // Получаем данные автомобиля
        const { data: car } = await supabase
            .from('cars')
            .select('*')
            .eq('id', selectedCarId)
            .single();
        
        // Создаем запись использования
        const { error: usageError } = await supabase
            .from('car_usage')
            .insert([{
                car_id: selectedCarId,
                user_id: currentUser.id,
                fuel_taken: car.current_fuel_level || 0,
                was_damaged_on_take: wasDamaged,
                incorrect_parking_count: 0
            }]);
        
        if (usageError) throw usageError;
        
        // Обновляем статус автомобиля
        const { error: updateError } = await supabase
            .from('cars')
            .update({ is_available: false })
            .eq('id', selectedCarId);
        
        if (updateError) throw updateError;
        
        closeModal('takeCarModal');
        loadCars();
        
        // Если пользователь на вкладке "Мои авто", обновляем её
        const activeTab = document.querySelector('.nav-btn.active');
        if (activeTab && activeTab.dataset.tab === 'mycars') {
            loadMyCars();
        }
        
        alert('Автомобиль успешно взят! Перейдите на вкладку "Мои авто" чтобы вернуть его.');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при взятии автомобиля: ' + error.message);
    }
}

// Открыть модальное окно возврата автомобиля
async function openReturnCarModal(carId) {
    selectedCarId = carId;
    
    try {
        const { data: car } = await supabase
            .from('cars')
            .select('*')
            .eq('id', carId)
            .single();
        
        const { data: usage } = await supabase
            .from('car_usage')
            .select('*')
            .eq('car_id', carId)
            .eq('user_id', currentUser.id)
            .is('returned_at', null)
            .single();
        
        document.getElementById('returnCarInfo').innerHTML = `
            <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p><strong>${car.name}</strong> (${car.license_plate})</p>
                <p style="margin-top: 8px; color: #666;">Топливо при взятии: <strong>${usage.fuel_taken} л</strong></p>
            </div>
        `;
        
        // Предзаполняем текущий уровень топлива
        document.querySelector('#returnCarForm [name="fuel_returned"]').value = car.current_fuel_level || 0;
        
        openModal('returnCarModal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных');
    }
}

// Вернуть автомобиль
async function handleReturnCar(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const fuelReturned = parseFloat(formData.get('fuel_returned'));
    const wasDamaged = formData.get('was_damaged') === 'on';
    const incorrectParking = formData.get('incorrect_parking') === 'on';
    
    try {
        // Получаем активное использование
        const { data: usage } = await supabase
            .from('car_usage')
            .select('*')
            .eq('car_id', selectedCarId)
            .eq('user_id', currentUser.id)
            .is('returned_at', null)
            .single();
        
        // Обновляем запись использования
        const { error: usageError } = await supabase
            .from('car_usage')
            .update({
                returned_at: new Date().toISOString(),
                fuel_returned: fuelReturned,
                was_damaged_on_return: wasDamaged,
                incorrect_parking_count: incorrectParking ? (usage.incorrect_parking_count + 1) : usage.incorrect_parking_count
            })
            .eq('id', usage.id);
        
        if (usageError) throw usageError;
        
        // Обновляем автомобиль
        const { error: updateError } = await supabase
            .from('cars')
            .update({
                is_available: true,
                current_fuel_level: fuelReturned,
                is_damaged: wasDamaged
            })
            .eq('id', selectedCarId);
        
        if (updateError) throw updateError;
        
        closeModal('returnCarModal');
        loadCars();
        loadMyCars(); // Обновляем "Мои авто"
        
        alert('Автомобиль успешно возвращен!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при возврате автомобиля: ' + error.message);
    }
}

// ==================== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ====================

async function loadUsers() {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        usersList.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Пользователь</th>
                        <th>Роль</th>
                        <th>Должность</th>
                        <th>Дата регистрации</th>
                        <th style="text-align: right;">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 40px; height: 40px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                                        ${user.first_name[0]}${user.last_name[0]}
                                    </div>
                                    <div>
                                        <div style="font-weight: 500;">${user.first_name} ${user.last_name}</div>
                                        <div style="font-size: 12px; color: #666;">VK ID: ${user.vk_id}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="role-badge" style="${getRoleBadgeClass(user.role)}">
                                    ${getRoleDisplayName(user.role)}
                                </span>
                            </td>
                            <td>${user.custom_position || '-'}</td>
                            <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
                            <td style="text-align: right;">
                                <button class="btn-secondary" onclick="openEditUserModal('${user.id}')">Изменить</button>
                                <button class="btn-secondary" onclick="viewUserHistory('${user.id}')" style="margin-left: 5px;">История</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        usersList.innerHTML = '<div class="empty-state"><p class="empty-state-text">Ошибка загрузки данных</p></div>';
    }
}

async function openEditUserModal(userId) {
    selectedUserId = userId;
    
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('editUserInfo').innerHTML = `
            <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p style="font-weight: 500;">${user.first_name} ${user.last_name}</p>
                <p style="font-size: 12px; color: #666; margin-top: 5px;">VK ID: ${user.vk_id}</p>
            </div>
        `;
        
        const form = document.getElementById('editUserForm');
        form.querySelector('[name="role"]').value = user.role;
        form.querySelector('[name="custom_position"]').value = user.custom_position || '';
        
        const highRoles = ['senior_manager', 'deputy_director', 'director'];
        document.getElementById('customPositionGroup').style.display = 
            highRoles.includes(user.role) ? 'block' : 'none';
        
        openModal('editUserModal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных пользователя');
    }
}

async function handleEditUser(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const role = formData.get('role');
    const customPosition = formData.get('custom_position');
    
    const highRoles = ['senior_manager', 'deputy_director', 'director'];
    
    // Защита от самоповышения
    if (selectedUserId === currentUser.id) {
        const roleHierarchy = {
            'user': 0,
            'junior_staff': 1,
            'senior_staff': 2,
            'manager': 3,
            'senior_manager': 4,
            'deputy_director': 5,
            'director': 6
        };
        
        const currentRoleLevel = roleHierarchy[currentUser.role] || 0;
        const newRoleLevel = roleHierarchy[role] || 0;
        
        if (newRoleLevel > currentRoleLevel) {
            alert('⛔ Вы не можете повысить сами себя!\n\nПопросите другого администратора изменить вашу роль.');
            return;
        }
        
        // Запрещаем менять свою должность
        if (highRoles.includes(role) && customPosition && currentUser.custom_position !== customPosition) {
            alert('⛔ Вы не можете изменить свою индивидуальную должность!\n\nПопросите другого администратора.');
            return;
        }
    }
    
    try {
        const { error } = await supabase
            .from('users')
            .update({
                role: role,
                custom_position: highRoles.includes(role) ? customPosition : null
            })
            .eq('id', selectedUserId);
        
        if (error) throw error;
        
        // Если изменили свою роль, обновляем currentUser
        if (selectedUserId === currentUser.id) {
            currentUser.role = role;
            currentUser.custom_position = highRoles.includes(role) ? customPosition : null;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            setupNavigation(); // Обновляем навигацию с новыми правами
        }
        
        closeModal('editUserModal');
        loadUsers();
        alert('Пользователь успешно обновлен!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при обновлении пользователя: ' + error.message);
    }
}

// Просмотр истории пользователя
async function viewUserHistory(userId) {
    try {
        const { data: user } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', userId)
            .single();
        
        const { data: usages } = await supabase
            .from('car_usage')
            .select(`
                *,
                cars (name, license_plate)
            `)
            .eq('user_id', userId)
            .order('taken_at', { ascending: false })
            .limit(50);
        
        if (!usages || usages.length === 0) {
            alert(`У пользователя ${user.first_name} ${user.last_name} пока нет истории использования автомобилей`);
            return;
        }
        
        // Создаем модальное окно для истории
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="display: block; max-width: 900px;">
                <div class="modal-content">
                    <h3>История использования: ${user.first_name} ${user.last_name}</h3>
                    <div style="max-height: 500px; overflow-y: auto; margin-top: 20px;">
                        <table style="width: 100%;">
                            <thead>
                                <tr>
                                    <th>Автомобиль</th>
                                    <th>Взято</th>
                                    <th>Возвращено</th>
                                    <th>Парковка</th>
                                    <th>Повреждения</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${usages.map(usage => `
                                    <tr>
                                        <td>
                                            <div style="font-weight: 500;">${usage.cars?.name || 'Н/Д'}</div>
                                            <div style="font-size: 12px; color: #666;">${usage.cars?.license_plate || ''}</div>
                                        </td>
                                        <td>${new Date(usage.taken_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                        <td>${usage.returned_at ? new Date(usage.returned_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '<span style="color: #f59e0b;">В использовании</span>'}</td>
                                        <td>
                                            ${usage.parking_verified === null ? '<span style="color: #9ca3af;">Не проверено</span>' : 
                                              usage.parking_verified ? '<span style="color: #10b981;">✓</span>' : 
                                              '<span style="color: #ef4444;">✗ Неправильно</span>'}
                                        </td>
                                        <td>
                                            ${usage.was_damaged_on_take || usage.was_damaged_on_return ? 
                                                '<span style="color: #ef4444;">⚠️ Да</span>' : 
                                                '<span style="color: #10b981;">✓ Нет</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-actions" style="margin-top: 20px;">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке истории');
    }
}

// ==================== ОБСЛУЖИВАНИЕ ====================

async function loadMaintenanceCars() {
    const carsList = document.getElementById('maintenanceCarsList');
    carsList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    try {
        let query = supabase.from('cars').select('*').order('name');
        
        if (currentMaintenanceGarageFilter !== 'all') {
            query = query.eq('garage_type', currentMaintenanceGarageFilter);
        }
        
        const { data: cars, error } = await query;
        
        if (error) throw error;
        
        if (!cars || cars.length === 0) {
            carsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <p class="empty-state-text">Автомобили не найдены</p>
                </div>
            `;
            return;
        }
        
        carsList.innerHTML = cars.map(car => `
            <div class="car-card ${car.is_damaged ? 'damaged' : ''}">
                <div class="car-header">
                    <div class="car-title">${car.name}</div>
                </div>
                <div class="car-info">
                    <div class="car-info-row">
                        <span class="car-info-label">Номер:</span>
                        <span class="car-info-value">${car.license_plate}</span>
                    </div>
                    <div class="car-info-row">
                        <span class="car-info-label">Гараж:</span>
                        <span class="car-info-value">${getGarageLabel(car.garage_type)}</span>
                    </div>
                    <div class="car-info-row">
                        <span class="car-info-label">Топливо:</span>
                        <span class="car-info-value">${car.current_fuel_level || 0} л</span>
                    </div>
                    <div class="car-info-row">
                        <span class="car-info-label">Статус:</span>
                        <span class="status-badge ${car.is_damaged ? 'status-damaged' : 'status-available'}">
                            ${car.is_damaged ? '⚠️ Поврежден' : '✓ Целое'}
                        </span>
                    </div>
                </div>
                <div class="car-actions">
                    <button class="btn-primary" onclick="openMaintenanceModal('${car.id}')">Обслужить</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка:', error);
        carsList.innerHTML = '<div class="empty-state"><p class="empty-state-text">Ошибка загрузки данных</p></div>';
    }
}

async function openMaintenanceModal(carId) {
    selectedCarId = carId;
    
    try {
        const { data: car, error } = await supabase
            .from('cars')
            .select('*')
            .eq('id', carId)
            .single();
        
        if (error) throw error;
        
        document.getElementById('maintenanceCarInfo').innerHTML = `
            <div style="background: #f3f4f6; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                <p style="font-weight: 500;">${car.name}</p>
                <p style="font-size: 14px; color: #666; margin-top: 5px;">${car.license_plate}</p>
                <p style="font-size: 14px; color: #666; margin-top: 5px;">Текущий уровень топлива: <strong>${car.current_fuel_level || 0} л</strong></p>
            </div>
        `;
        
        const form = document.getElementById('maintenanceForm');
        form.reset();
        
        document.getElementById('wasDamagedCheck').checked = car.is_damaged;
        document.getElementById('repairGroup').style.display = car.is_damaged ? 'block' : 'none';
        document.getElementById('repairCostGroup').style.display = 'none';
        document.getElementById('repairedCheck').checked = false;
        
        openModal('maintenanceModal');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при загрузке данных автомобиля');
    }
}

async function handleMaintenance(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const fuelAdded = parseFloat(formData.get('fuel_added')) || 0;
    const wasDamaged = formData.get('was_damaged') === 'on';
    const repaired = formData.get('repaired') === 'on';
    const repairCost = repaired ? parseFloat(formData.get('repair_cost')) || 0 : null;
    
    try {
        // Получаем текущие данные автомобиля
        const { data: car } = await supabase
            .from('cars')
            .select('*')
            .eq('id', selectedCarId)
            .single();
        
        const newFuelLevel = (car.current_fuel_level || 0) + fuelAdded;
        
        // Создаем запись обслуживания
        const { error: maintenanceError } = await supabase
            .from('car_maintenance')
            .insert([{
                car_id: selectedCarId,
                maintained_by: currentUser.id,
                fuel_added: fuelAdded,
                repair_cost: repairCost,
                was_damaged: wasDamaged
            }]);
        
        if (maintenanceError) throw maintenanceError;
        
        // Обновляем автомобиль
        const { error: updateError } = await supabase
            .from('cars')
            .update({
                current_fuel_level: newFuelLevel,
                is_damaged: repaired ? false : wasDamaged
            })
            .eq('id', selectedCarId);
        
        if (updateError) throw updateError;
        
        closeModal('maintenanceModal');
        loadMaintenanceCars();
        alert('Обслуживание выполнено успешно!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при обслуживании: ' + error.message);
    }
}

async function loadMaintenanceHistory() {
    const historyDiv = document.getElementById('maintenanceHistory');
    historyDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    try {
        const { data: history, error } = await supabase
            .from('car_maintenance')
            .select(`
                *,
                cars (name, license_plate),
                users (first_name, last_name)
            `)
            .order('maintained_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        if (!history || history.length === 0) {
            historyDiv.innerHTML = '<div class="empty-state"><p class="empty-state-text">История обслуживания пуста</p></div>';
            return;
        }
        
        historyDiv.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Автомобиль</th>
                        <th>Обслужил</th>
                        <th>Топливо</th>
                        <th>Ремонт</th>
                        <th>Дата</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.map(record => `
                        <tr>
                            <td>
                                <div style="font-weight: 500;">${record.cars?.name || 'Н/Д'}</div>
                                <div style="font-size: 12px; color: #666;">${record.cars?.license_plate || ''}</div>
                            </td>
                            <td>${record.users?.first_name || ''} ${record.users?.last_name || ''}</td>
                            <td style="color: #10b981;">+${record.fuel_added} л</td>
                            <td>${record.repair_cost ? `${record.repair_cost.toLocaleString()} ₽` : '-'}</td>
                            <td>${new Date(record.maintained_at).toLocaleString('ru-RU')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Ошибка:', error);
        historyDiv.innerHTML = '<div class="empty-state"><p class="empty-state-text">Ошибка загрузки данных</p></div>';
    }
}

// ==================== СТАТИСТИКА ====================

async function loadStatistics() {
    const statsContent = document.getElementById('statisticsContent');
    statsContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    try {
        // Общая статистика
        const { data: cars } = await supabase.from('cars').select('*');
        const { data: usages } = await supabase.from('car_usage').select('*');
        const { data: maintenance } = await supabase.from('car_maintenance').select('*');
        
        // Подсчитываем использование каждого автомобиля
        const carUsageCount = {};
        usages?.forEach(usage => {
            carUsageCount[usage.car_id] = (carUsageCount[usage.car_id] || 0) + 1;
        });
        
        // Сортируем автомобили по использованию
        const sortedCars = cars?.map(car => ({
            ...car,
            usageCount: carUsageCount[car.id] || 0
        })).sort((a, b) => b.usageCount - a.usageCount) || [];
        
        const totalCars = cars?.length || 0;
        const availableCars = cars?.filter(c => c.is_available).length || 0;
        const damagedCars = cars?.filter(c => c.is_damaged).length || 0;
        const totalUsages = usages?.length || 0;
        const totalMaintenance = maintenance?.length || 0;
        
        statsContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${totalCars}</div>
                    <div class="stat-label">Всего автомобилей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${availableCars}</div>
                    <div class="stat-label">Доступно</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${damagedCars}</div>
                    <div class="stat-label">Повреждено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalUsages}</div>
                    <div class="stat-label">Всего использований</div>
                </div>
            </div>
            
            <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); margin-top: 20px;">
                <h3 style="margin-bottom: 20px; color: #333;">Использование автомобилей</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Автомобиль</th>
                            <th>Гос. номер</th>
                            <th>Гараж</th>
                            <th style="text-align: center;">Использований</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedCars.map(car => `
                            <tr>
                                <td style="font-weight: 500;">${car.name}</td>
                                <td>${car.license_plate}</td>
                                <td>${getGarageLabel(car.garage_type)}</td>
                                <td style="text-align: center;">
                                    <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 600;">
                                        ${car.usageCount}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка:', error);
        statsContent.innerHTML = '<div class="empty-state"><p class="empty-state-text">Ошибка загрузки статистики</p></div>';
    }
}

// ==================== ПРОВЕРКА ====================

async function loadVerification() {
    const verificationContent = document.getElementById('verificationContent');
    verificationContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>';
    
    try {
        const { data: usages, error } = await supabase
            .from('car_usage')
            .select(`
                *,
                cars (name, license_plate),
                users (first_name, last_name)
            `)
            .not('returned_at', 'is', null)
            .order('returned_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        if (!usages || usages.length === 0) {
            verificationContent.innerHTML = '<div class="empty-state"><p class="empty-state-text">Нет данных для проверки</p></div>';
            return;
        }
        
        verificationContent.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);">
                <table>
                    <thead>
                        <tr>
                            <th>Автомобиль</th>
                            <th>Пользователь</th>
                            <th>Возвращено</th>
                            <th>Парковка</th>
                            <th>Повреждения</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${usages.map(usage => {
                            let parkingStatus = '';
                            if (usage.parking_verified === null) {
                                parkingStatus = '<span style="color: #f59e0b;">⏳ Не проверено</span>';
                            } else if (usage.parking_verified === true) {
                                parkingStatus = '<span style="color: #10b981;">✓ Правильно</span>';
                            } else {
                                parkingStatus = '<span style="color: #ef4444;">✗ Неправильно</span>';
                            }
                            
                            return `
                            <tr>
                                <td>
                                    <div style="font-weight: 500;">${usage.cars?.name || 'Н/Д'}</div>
                                    <div style="font-size: 12px; color: #666;">${usage.cars?.license_plate || ''}</div>
                                </td>
                                <td>${usage.users?.first_name || ''} ${usage.users?.last_name || ''}</td>
                                <td>${new Date(usage.returned_at).toLocaleString('ru-RU')}</td>
                                <td>${parkingStatus}</td>
                                <td>
                                    ${usage.was_damaged_on_take || usage.was_damaged_on_return ? 
                                        '<span style="color: #ef4444;">⚠️ Да</span>' : 
                                        '<span style="color: #10b981;">✓ Нет</span>'}
                                </td>
                                <td>
                                    ${usage.parking_verified === null ? `
                                        <button class="btn-primary" style="padding: 5px 10px; font-size: 12px;" onclick="verifyParking('${usage.id}', true)">
                                            ✓
                                        </button>
                                        <button class="btn-danger" style="padding: 5px 10px; font-size: 12px;" onclick="verifyParking('${usage.id}', false)">
                                            ✗
                                        </button>
                                    ` : `
                                        <button class="btn-secondary" style="padding: 5px 10px; font-size: 12px;" onclick="verifyParking('${usage.id}', null)">
                                            Сбросить
                                        </button>
                                    `}
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка:', error);
        verificationContent.innerHTML = '<div class="empty-state"><p class="empty-state-text">Ошибка загрузки данных</p></div>';
    }
}

// Проверка парковки
async function verifyParking(usageId, isCorrect) {
    try {
        const updateData = {
            parking_verified: isCorrect,
            verified_by: currentUser.id,
            verified_at: new Date().toISOString()
        };
        
        // Если парковка неправильная, увеличиваем счетчик
        if (isCorrect === false) {
            const { data: usage } = await supabase
                .from('car_usage')
                .select('incorrect_parking_count')
                .eq('id', usageId)
                .single();
            
            if (usage) {
                updateData.incorrect_parking_count = (usage.incorrect_parking_count || 0) + 1;
            }
        }
        
        const { error } = await supabase
            .from('car_usage')
            .update(updateData)
            .eq('id', usageId);
        
        if (error) throw error;
        
        loadVerification();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при проверке парковки');
    }
}
