// ============================================
// СЕРВЕРНАЯ ЧАСТЬ - АВТОПАРК
// ============================================

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ИНИЦИАЛИЗАЦИЯ БД
// ============================================

const db = new sqlite3.Database('./autopark.db', (err) => {
    if (err) {
        console.error('❌ Ошибка подключения к БД:', err);
    } else {
        console.log('✅ Подключение к SQLite БД установлено');
        initDatabase();
    }
});

// Создание таблиц
function initDatabase() {
    db.serialize(() => {
        // Таблица пользователей
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                vk_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT DEFAULT 'driver',
                photo_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('❌ Ошибка создания таблицы users:', err);
            else console.log('✅ Таблица users готова');
        });

        // Таблица автомобилей
        db.run(`
            CREATE TABLE IF NOT EXISTS cars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                model TEXT NOT NULL,
                status TEXT DEFAULT 'available',
                current_user_vk_id TEXT,
                fuel_level INTEGER DEFAULT 0,
                is_broken BOOLEAN DEFAULT 0,
                repair_cost INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (current_user_vk_id) REFERENCES users(vk_id)
            )
        `, (err) => {
            if (err) console.error('❌ Ошибка создания таблицы cars:', err);
            else console.log('✅ Таблица cars готова');
        });

        // Таблица истории использования авто
        db.run(`
            CREATE TABLE IF NOT EXISTS car_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_id INTEGER NOT NULL,
                user_vk_id TEXT NOT NULL,
                action TEXT NOT NULL,
                fuel_before INTEGER,
                fuel_after INTEGER,
                is_broken BOOLEAN DEFAULT 0,
                cost INTEGER DEFAULT 0,
                description TEXT,
                taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                returned_at DATETIME,
                FOREIGN KEY (car_id) REFERENCES cars(id),
                FOREIGN KEY (user_vk_id) REFERENCES users(vk_id)
            )
        `, (err) => {
            if (err) console.error('❌ Ошибка создания таблицы car_history:', err);
            else console.log('✅ Таблица car_history готова');
        });

        // Таблица обслуживания
        db.run(`
            CREATE TABLE IF NOT EXISTS maintenance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                car_id INTEGER NOT NULL,
                mechanic_vk_id TEXT NOT NULL,
                fuel_before INTEGER,
                fuel_after INTEGER,
                was_broken BOOLEAN DEFAULT 0,
                repaired BOOLEAN DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (car_id) REFERENCES cars(id),
                FOREIGN KEY (mechanic_vk_id) REFERENCES users(vk_id)
            )
        `, (err) => {
            if (err) console.error('❌ Ошибка создания таблицы maintenance:', err);
            else console.log('✅ Таблица maintenance готова');
        });

        // Таблица взысканий
        db.run(`
            CREATE TABLE IF NOT EXISTS penalties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_vk_id TEXT NOT NULL,
                car_id INTEGER,
                reason TEXT NOT NULL,
                amount INTEGER DEFAULT 0,
                issued_by TEXT NOT NULL,
                issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_vk_id) REFERENCES users(vk_id),
                FOREIGN KEY (car_id) REFERENCES cars(id),
                FOREIGN KEY (issued_by) REFERENCES users(vk_id)
            )
        `, (err) => {
            if (err) console.error('❌ Ошибка создания таблицы penalties:', err);
            else console.log('✅ Таблица penalties готова');
        });

        // Таблица логов
        db.run(`
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_vk_id TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT,
                ip TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_vk_id) REFERENCES users(vk_id)
            )
        `, (err) => {
            if (err) console.error('❌ Ошибка создания таблицы logs:', err);
            else console.log('✅ Таблица logs готова');
        });
    });
}

// ============================================
// УТИЛИТЫ
// ============================================

// Промисификация запросов к БД
const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbRun = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// Логирование действий
async function logAction(vkId, action, details, ip = 'unknown') {
    try {
        await dbRun(
            'INSERT INTO logs (user_vk_id, action, details, ip) VALUES (?, ?, ?, ?)',
            [vkId, action, details, ip]
        );
    } catch (err) {
        console.error('❌ Ошибка записи лога:', err);
    }
}

// Отправка в VK чат
async function sendToVKChat(message) {
    const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN;
    const VK_CHAT_ID = process.env.VK_CHAT_ID;

    if (!VK_ACCESS_TOKEN || !VK_CHAT_ID) {
        console.log('📝 VK Chat не настроен');
        return;
    }

    try {
        await axios.post('https://api.vk.com/method/messages.send', null, {
            params: {
                access_token: VK_ACCESS_TOKEN,
                chat_id: VK_CHAT_ID,
                message: message,
                random_id: Math.floor(Math.random() * 1000000),
                v: '5.131'
            }
        });
        console.log('✅ Сообщение отправлено в VK чат');
    } catch (err) {
        console.error('❌ Ошибка отправки в VK:', err.message);
    }
}

// ============================================
// API ENDPOINTS - ПОЛЬЗОВАТЕЛИ
// ============================================

// Получить или создать пользователя
app.post('/api/auth/user', async (req, res) => {
    try {
        const { vk_id, first_name, last_name, photo_200 } = req.body;

        if (!vk_id) {
            return res.status(400).json({ error: 'VK ID обязателен' });
        }

        // Проверяем, существует ли пользователь
        let user = await dbGet('SELECT * FROM users WHERE vk_id = ?', [vk_id]);

        if (!user) {
            // Создаём нового пользователя
            const name = `${first_name || ''} ${last_name || ''}`.trim() || 'Пользователь';
            await dbRun(
                'INSERT INTO users (vk_id, name, photo_url, role) VALUES (?, ?, ?, ?)',
                [vk_id, name, photo_200 || '', 'driver']
            );

            user = await dbGet('SELECT * FROM users WHERE vk_id = ?', [vk_id]);

            await logAction(vk_id, 'user_created', `Новый пользователь зарегистрирован: ${name}`, req.ip);
            await sendToVKChat(`👤 Новый пользователь: ${name} (VK ID: ${vk_id})`);

            console.log(`✅ Создан новый пользователь: ${name} (${vk_id})`);
        } else {
            await logAction(vk_id, 'login', 'Вход в систему', req.ip);
            console.log(`✅ Пользователь авторизован: ${user.name} (${vk_id})`);
        }

        res.json({ success: true, user });
    } catch (err) {
        console.error('❌ Ошибка авторизации:', err);
        res.status(500).json({ error: 'Ошибка сервера', details: err.message });
    }
});

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
    try {
        const users = await dbAll('SELECT * FROM users ORDER BY created_at DESC');
        res.json({ success: true, users });
    } catch (err) {
        console.error('❌ Ошибка получения пользователей:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить роль пользователя
app.put('/api/users/:vk_id/role', async (req, res) => {
    try {
        const { vk_id } = req.params;
        const { role, admin_vk_id } = req.body;

        if (!['driver', 'mechanic', 'admin', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль' });
        }

        await dbRun(
            'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE vk_id = ?',
            [role, vk_id]
        );

        const user = await dbGet('SELECT * FROM users WHERE vk_id = ?', [vk_id]);

        await logAction(admin_vk_id, 'role_change', `Изменена роль пользователя ${user.name} на ${role}`, req.ip);
        await sendToVKChat(`👥 Изменена роль: ${user.name} → ${role}`);

        res.json({ success: true, user });
    } catch (err) {
        console.error('❌ Ошибка изменения роли:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// API ENDPOINTS - АВТОМОБИЛИ
// ============================================

// Получить все автомобили
app.get('/api/cars', async (req, res) => {
    try {
        const cars = await dbAll(`
            SELECT c.*, u.name as current_user_name 
            FROM cars c
            LEFT JOIN users u ON c.current_user_vk_id = u.vk_id
            ORDER BY c.id
        `);
        res.json({ success: true, cars });
    } catch (err) {
        console.error('❌ Ошибка получения автомобилей:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить доступные автомобили
app.get('/api/cars/available', async (req, res) => {
    try {
        const cars = await dbAll('SELECT * FROM cars WHERE status = "available"');
        res.json({ success: true, cars });
    } catch (err) {
        console.error('❌ Ошибка получения автомобилей:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить автомобили пользователя
app.get('/api/cars/user/:vk_id', async (req, res) => {
    try {
        const { vk_id } = req.params;
        const cars = await dbAll(
            'SELECT * FROM cars WHERE current_user_vk_id = ? AND status = "in_use"',
            [vk_id]
        );
        res.json({ success: true, cars });
    } catch (err) {
        console.error('❌ Ошибка получения автомобилей:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить автомобиль
app.post('/api/cars', async (req, res) => {
    try {
        const { brand, model, fuel_level, admin_vk_id } = req.body;

        if (!brand || !model) {
            return res.status(400).json({ error: 'Укажите марку и модель' });
        }

        const result = await dbRun(
            'INSERT INTO cars (brand, model, fuel_level) VALUES (?, ?, ?)',
            [brand, model, fuel_level || 0]
        );

        const car = await dbGet('SELECT * FROM cars WHERE id = ?', [result.id]);

        await logAction(admin_vk_id, 'car_added', `Добавлен автомобиль ${brand} ${model}`, req.ip);
        await sendToVKChat(`🚗 Добавлен новый автомобиль: ${brand} ${model}`);

        res.json({ success: true, car });
    } catch (err) {
        console.error('❌ Ошибка добавления автомобиля:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Взять автомобиль
app.post('/api/cars/:id/take', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_vk_id, fuel_level, is_broken, repair_cost, description } = req.body;

        // Проверяем доступность авто
        const car = await dbGet('SELECT * FROM cars WHERE id = ?', [id]);
        if (!car) {
            return res.status(404).json({ error: 'Автомобиль не найден' });
        }
        if (car.status !== 'available') {
            return res.status(400).json({ error: 'Автомобиль недоступен' });
        }

        // Обновляем статус авто
        await dbRun(
            `UPDATE cars SET 
                status = 'in_use', 
                current_user_vk_id = ?, 
                fuel_level = ?, 
                is_broken = ?, 
                repair_cost = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [user_vk_id, fuel_level, is_broken ? 1 : 0, repair_cost || 0, id]
        );

        // Добавляем в историю
        await dbRun(
            `INSERT INTO car_history 
            (car_id, user_vk_id, action, fuel_before, fuel_after, is_broken, cost, description) 
            VALUES (?, ?, 'take', ?, ?, ?, ?, ?)`,
            [id, user_vk_id, fuel_level, fuel_level, is_broken ? 1 : 0, repair_cost || 0, description || '']
        );

        const user = await dbGet('SELECT * FROM users WHERE vk_id = ?', [user_vk_id]);
        const updatedCar = await dbGet('SELECT * FROM cars WHERE id = ?', [id]);

        await logAction(
            user_vk_id, 
            'car_take', 
            `Взял автомобиль ${car.brand} ${car.model}${is_broken ? ' (ПОЛОМАН)' : ''}`, 
            req.ip
        );

        const message = `🚗 ${user.name} взял автомобиль ${car.brand} ${car.model}\n⛽ Бензин: ${fuel_level}л${is_broken ? `\n❌ ПОЛОМАН\n💰 Оценка: ${repair_cost}₽` : '\n✅ Исправен'}`;
        await sendToVKChat(message);

        res.json({ success: true, car: updatedCar });
    } catch (err) {
        console.error('❌ Ошибка взятия автомобиля:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вернуть автомобиль
app.post('/api/cars/:id/return', async (req, res) => {
    try {
        const { id } = req.params;
        const { user_vk_id } = req.body;

        const car = await dbGet('SELECT * FROM cars WHERE id = ?', [id]);
        if (!car) {
            return res.status(404).json({ error: 'Автомобиль не найден' });
        }

        // Обновляем статус авто
        await dbRun(
            `UPDATE cars SET 
                status = 'available', 
                current_user_vk_id = NULL,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [id]
        );

        // Обновляем историю - ставим время возврата
        await dbRun(
            `UPDATE car_history 
            SET returned_at = CURRENT_TIMESTAMP 
            WHERE car_id = ? AND user_vk_id = ? AND returned_at IS NULL`,
            [id, user_vk_id]
        );

        const user = await dbGet('SELECT * FROM users WHERE vk_id = ?', [user_vk_id]);

        await logAction(user_vk_id, 'car_return', `Вернул автомобиль ${car.brand} ${car.model}`, req.ip);
        await sendToVKChat(`🔄 ${user.name} вернул автомобиль ${car.brand} ${car.model}`);

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Ошибка возврата автомобиля:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// API ENDPOINTS - ОБСЛУЖИВАНИЕ
// ============================================

// Обслужить автомобиль
app.post('/api/maintenance', async (req, res) => {
    try {
        const { car_id, mechanic_vk_id, fuel_before, fuel_after, was_broken, repaired, notes } = req.body;

        const car = await dbGet('SELECT * FROM cars WHERE id = ?', [car_id]);
        if (!car) {
            return res.status(404).json({ error: 'Автомобиль не найден' });
        }

        // Добавляем запись об обслуживании
        await dbRun(
            `INSERT INTO maintenance 
            (car_id, mechanic_vk_id, fuel_before, fuel_after, was_broken, repaired, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [car_id, mechanic_vk_id, fuel_before, fuel_after, was_broken ? 1 : 0, repaired ? 1 : 0, notes || '']
        );

        // Обновляем автомобиль
        const newStatus = (was_broken && !repaired) ? 'maintenance' : 'available';
        await dbRun(
            `UPDATE cars SET 
                fuel_level = ?, 
                is_broken = ?, 
                status = ?,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
            [fuel_after, (was_broken && !repaired) ? 1 : 0, newStatus, car_id]
        );

        const mechanic = await dbGet('SELECT * FROM users WHERE vk_id = ?', [mechanic_vk_id]);

        await logAction(
            mechanic_vk_id, 
            'maintenance', 
            `Обслужил ${car.brand} ${car.model}${was_broken ? (repaired ? ' - ПОЧИНИЛ' : ' - НЕ ПОЧИНИЛ') : ''}`, 
            req.ip
        );

        const message = `🔧 ${mechanic.name} обслужил ${car.brand} ${car.model}\n⛽ Бензин: ${fuel_before}л → ${fuel_after}л${was_broken ? (repaired ? '\n✅ Автомобиль ПОЧИНЕН' : '\n❌ Автомобиль НЕ ПОЧИНЕН') : ''}${notes ? `\n📝 ${notes}` : ''}`;
        await sendToVKChat(message);

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Ошибка обслуживания:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить историю обслуживания
app.get('/api/maintenance', async (req, res) => {
    try {
        const maintenance = await dbAll(`
            SELECT m.*, c.brand, c.model, u.name as mechanic_name
            FROM maintenance m
            JOIN cars c ON m.car_id = c.id
            JOIN users u ON m.mechanic_vk_id = u.vk_id
            ORDER BY m.created_at DESC
        `);
        res.json({ success: true, maintenance });
    } catch (err) {
        console.error('❌ Ошибка получения обслуживания:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// API ENDPOINTS - ВЗЫСКАНИЯ
// ============================================

// Выдать взыскание
app.post('/api/penalties', async (req, res) => {
    try {
        const { user_vk_id, car_id, reason, amount, issued_by } = req.body;

        if (!user_vk_id || !reason) {
            return res.status(400).json({ error: 'Заполните обязательные поля' });
        }

        await dbRun(
            `INSERT INTO penalties (user_vk_id, car_id, reason, amount, issued_by) 
            VALUES (?, ?, ?, ?, ?)`,
            [user_vk_id, car_id || null, reason, amount || 0, issued_by]
        );

        const user = await dbGet('SELECT * FROM users WHERE vk_id = ?', [user_vk_id]);
        const issuer = await dbGet('SELECT * FROM users WHERE vk_id = ?', [issued_by]);

        await logAction(issued_by, 'penalty_issued', `Выдал взыскание: ${user.name} - ${reason} (${amount}₽)`, req.ip);
        await sendToVKChat(`⚠️ ${issuer.name} выдал взыскание\n👤 ${user.name}\n📝 ${reason}\n💰 ${amount}₽`);

        res.json({ success: true });
    } catch (err) {
        console.error('❌ Ошибка выдачи взыскания:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить взыскания
app.get('/api/penalties', async (req, res) => {
    try {
        const penalties = await dbAll(`
            SELECT p.*, u.name as user_name, issuer.name as issuer_name
            FROM penalties p
            JOIN users u ON p.user_vk_id = u.vk_id
            JOIN users issuer ON p.issued_by = issuer.vk_id
            ORDER BY p.issued_at DESC
        `);
        res.json({ success: true, penalties });
    } catch (err) {
        console.error('❌ Ошибка получения взысканий:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// API ENDPOINTS - ЛОГИ И СТАТИСТИКА
// ============================================

// Получить логи
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await dbAll(`
            SELECT l.*, u.name as user_name
            FROM logs l
            JOIN users u ON l.user_vk_id = u.vk_id
            ORDER BY l.created_at DESC
            LIMIT 100
        `);
        res.json({ success: true, logs });
    } catch (err) {
        console.error('❌ Ошибка получения логов:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить статистику по автомобилям
app.get('/api/stats/cars', async (req, res) => {
    try {
        const stats = await dbAll(`
            SELECT 
                c.*,
                COUNT(DISTINCT ch.id) as total_uses,
                COUNT(DISTINCT m.id) as maintenance_count
            FROM cars c
            LEFT JOIN car_history ch ON c.id = ch.car_id
            LEFT JOIN maintenance m ON c.id = m.car_id
            GROUP BY c.id
        `);
        res.json({ success: true, stats });
    } catch (err) {
        console.error('❌ Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить историю автомобиля
app.get('/api/cars/:id/history', async (req, res) => {
    try {
        const { id } = req.params;
        
        const history = await dbAll(`
            SELECT ch.*, u.name as user_name
            FROM car_history ch
            JOIN users u ON ch.user_vk_id = u.vk_id
            WHERE ch.car_id = ?
            ORDER BY ch.taken_at DESC
        `, [id]);

        const maintenance = await dbAll(`
            SELECT m.*, u.name as mechanic_name
            FROM maintenance m
            JOIN users u ON m.mechanic_vk_id = u.vk_id
            WHERE m.car_id = ?
            ORDER BY m.created_at DESC
        `, [id]);

        res.json({ success: true, history, maintenance });
    } catch (err) {
        console.error('❌ Ошибка получения истории:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить статистику пользователя
app.get('/api/users/:vk_id/stats', async (req, res) => {
    try {
        const { vk_id } = req.params;

        const carsTaken = await dbAll(
            'SELECT COUNT(*) as count FROM car_history WHERE user_vk_id = ?',
            [vk_id]
        );

        const maintenanceDone = await dbAll(
            'SELECT COUNT(*) as count FROM maintenance WHERE mechanic_vk_id = ?',
            [vk_id]
        );

        const penalties = await dbAll(
            `SELECT p.*, c.brand, c.model 
            FROM penalties p
            LEFT JOIN cars c ON p.car_id = c.id
            WHERE p.user_vk_id = ?
            ORDER BY p.issued_at DESC`,
            [vk_id]
        );

        res.json({
            success: true,
            stats: {
                cars_taken: carsTaken[0].count,
                maintenance_done: maintenanceDone[0].count,
                penalties: penalties
            }
        });
    } catch (err) {
        console.error('❌ Ошибка получения статистики:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║   🚗 СЕРВЕР АВТОПАРКА ЗАПУЩЕН        ║
    ║   Порт: ${PORT}                         ║
    ║   http://localhost:${PORT}              ║
    ╚═══════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Закрытие соединения с БД...');
    db.close((err) => {
        if (err) {
            console.error('❌ Ошибка закрытия БД:', err);
        } else {
            console.log('✅ Соединение с БД закрыто');
        }
        process.exit(0);
    });
});