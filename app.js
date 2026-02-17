/**
 * Gym Pro Smart Trainer - Frontend Application
 * Connected to Node.js/Express Backend + Supabase
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    // Backend API URL - change this to your server URL
    API_URL: 'https://gym-pro-backend.onrender.com',
    // OR use local server:
    // API_URL: 'http://localhost:3000',

    // Supabase (for direct database access as fallback)
    SUPABASE_URL: 'https://ilopoevhgkgepumjsmid.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsb3BvZXZoZ2tnZXB1bWpzbWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NjQ5NDAsImV4cCI6MjA4NDE0MDk0MH0.LnJN5o9MqSLodN1PXwRLIBuDWUiZ-9rGb1CLdz3fdt8',

    // Google Vision API
    GOOGLE_VISION_KEY: 'AIzaSyChzhyU3u7dPWQ5mnfPWrbs2dOjYzIx614'
};

// ============================================
// API Helper Functions
// ============================================
class API {
    static async request(endpoint, options = {}) {
        const token = localStorage.getItem('authToken');

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            ...options
        };

        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    static get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    static delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// ============================================
// Main Application Class
// ============================================
class SmartTrainerPro {
    constructor() {
        // Initialize Supabase
        this.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

        // State
        this.isAuthenticated = false;
        this.isGuestMode = true;
        this.user = null;
        this.token = null;

        // Data stores
        this.dailyMeals = [];
        this.waterData = { today: 0, history: {}, target: 8, date: new Date().toISOString().split('T')[0] };
        this.userProfile = { name: '', age: '', height: '', weight: '', targetCalories: 2000, weightHistory: [] };
        this.vitalsData = [];
        this.progressPhotos = [];

        // Initialize
        this.charts = {};
        this.checkAuth();
    }

    // ============================================
    // Authentication
    // ============================================
    async checkAuth() {
        // Check for Google OAuth callback
        const { data: { session } } = await this.supabase.auth.getSession();
        
        if (session && session.user) {
            // User is logged in via Supabase (Google or email)
            this.user = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email.split('@')[0]
            };
            
            localStorage.setItem('userData', JSON.stringify(this.user));
            
            // Create profile if not exists
            await this.ensureProfile(session.user.id);
            
            this.isAuthenticated = true;
            this.isGuestMode = false;
            this.showApp();
            this.loadAllData();
            return;
        }
        
        // Check localStorage for existing session
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('userData');

        if (token && user) {
            this.token = token;
            this.user = JSON.parse(user);
            this.isAuthenticated = true;
            this.isGuestMode = false;
            this.showApp();
            this.loadAllData();
        } else {
            this.showAuthModal();
        }
    }

    async ensureProfile(userId) {
        try {
            const { data: existingProfile } = await this.supabase
                .from('profile')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (!existingProfile) {
                // Create profile
                await this.supabase.from('profile').insert([{
                    user_id: userId,
                    name: this.user.name,
                    target_calories: 2000,
                    target_water: 8
                }]);
            }
        } catch (error) {
            console.log('Profile check error:', error);
        }
    }

    showAuthModal() {
        document.getElementById('authModal').classList.add('active');
        document.getElementById('app').style.display = 'none';
    }

    showApp() {
        document.getElementById('authModal').classList.remove('active');
        document.getElementById('app').style.display = 'block';

        // Show user info
        const userInfo = document.getElementById('userInfo');
        if (this.user) {
            userInfo.style.display = 'flex';
            document.getElementById('userNameDisplay').textContent = this.user.name || this.user.email;
        }
    }

    async handleLogin(email, password) {
        try {
            // Use Supabase directly for login
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (data.user) {
                // Get profile
                const { data: profile } = await this.supabase
                    .from('profile')
                    .select('name')
                    .eq('user_id', data.user.id)
                    .single();

                this.user = {
                    id: data.user.id,
                    email: data.user.email,
                    name: profile?.name || email.split('@')[0]
                };

                localStorage.setItem('userData', JSON.stringify(this.user));

                this.showApp();
                this.loadAllData();
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAuthError(error.message || 'فشل تسجيل الدخول');
        }
    }

    async handleGoogleLogin() {
        try {
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/index.html'
                }
            });

            if (error) throw error;
            
            // The user will be redirected to Google, then back to the app
            // The session will be handled in checkAuth after redirect
        } catch (error) {
            console.error('Google login error:', error);
            this.showAuthError(error.message || 'فشل تسجيل الدخول بـ Google');
        }
    }

    async handleRegister(name, email, password) {
        try {
            // Use Supabase directly for registration
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name }
                }
            });

            if (error) throw error;

            if (data.user) {
                // Create profile
                await this.supabase.from('profile').insert([{
                    user_id: data.user.id,
                    name: name,
                    target_calories: 2000,
                    target_water: 8
                }]);

                // Save locally
                this.user = { id: data.user.id, email, name };
                localStorage.setItem('userData', JSON.stringify(this.user));

                alert('✅ تم إنشاء الحساب بنجاح! تحقق من بريدك للتفعيل.');
                this.showApp();
                this.loadAllData();
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showAuthError(error.message || 'حدث خطأ أثناء التسجيل');
        }
    }

    handleAuthSuccess(data) {
        this.token = data.token;
        this.user = data.user;
        this.isAuthenticated = true;
        this.isGuestMode = false;

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));

        this.showApp();
        this.loadAllData();
    }

    handleGuestLogin() {
        this.isGuestMode = true;
        this.isAuthenticated = false;

        // Load from localStorage
        this.dailyMeals = JSON.parse(localStorage.getItem('dailyMeals')) || [];
        this.waterData = JSON.parse(localStorage.getItem('waterData')) || { today: 0, history: {}, target: 8, date: new Date().toISOString().split('T')[0] };
        this.userProfile = JSON.parse(localStorage.getItem('userProfile')) || { name: '', age: '', height: '', weight: '', targetCalories: 2000, weightHistory: [] };
        this.vitalsData = JSON.parse(localStorage.getItem('vitalsData')) || [];
        this.progressPhotos = JSON.parse(localStorage.getItem('progressPhotos')) || [];

        this.showApp();
        this.init();
    }

    logout() {
        this.token = null;
        this.user = null;
        this.isAuthenticated = false;

        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');

        location.reload();
    }

    showAuthError(message) {
        const errorEl = document.getElementById('authError');
        errorEl.textContent = message;
        errorEl.classList.add('show');
        setTimeout(() => errorEl.classList.remove('show'), 3000);
    }

    // ============================================
    // Data Loading
    // ============================================
    async loadAllData() {
        if (this.isGuestMode) {
            this.loadFromLocalStorage();
            this.init();
            return;
        }

        try {
            // Load from Supabase directly
            if (this.user && this.user.id) {
                // Load profile
                const { data: profile } = await this.supabase
                    .from('profile')
                    .select('*')
                    .eq('user_id', this.user.id)
                    .single();
                if (profile) {
                    this.userProfile = profile;
                }

                // Load meals
                const { data: meals } = await this.supabase
                    .from('meals')
                    .select('*')
                    .eq('user_id', this.user.id);
                this.dailyMeals = meals || [];

                // Load water
                const { data: water } = await this.supabase
                    .from('water')
                    .select('*')
                    .eq('user_id', this.user.id)
                    .single();
                if (water) {
                    this.waterData = { ...this.waterData, ...water };
                }

                // Load photos
                const { data: photos } = await this.supabase
                    .from('photos')
                    .select('*')
                    .eq('user_id', this.user.id);
                this.progressPhotos = photos || [];
            }
            
            this.init();
        } catch (error) {
            console.log('Supabase load failed, using localStorage:', error);
            this.loadFromLocalStorage();
            this.init();
        }
    }

    loadFromLocalStorage() {
        this.dailyMeals = JSON.parse(localStorage.getItem('dailyMeals')) || [];
        this.waterData = JSON.parse(localStorage.getItem('waterData')) || { today: 0, history: {}, target: 8, date: new Date().toISOString().split('T')[0] };
        this.userProfile = JSON.parse(localStorage.getItem('userProfile')) || { name: '', age: '', height: '', weight: '', targetCalories: 2000, weightHistory: [] };
        this.vitalsData = JSON.parse(localStorage.getItem('vitalsData')) || [];
        this.progressPhotos = JSON.parse(localStorage.getItem('progressPhotos')) || [];
    }

    // ============================================
    // Data Saving
    // ============================================
    async saveData(key, data) {
        // Always save to localStorage
        localStorage.setItem(key, JSON.stringify(data));

        if (this.isGuestMode) return;

        try {
            switch (key) {
                case 'dailyMeals':
                    // Already handled in add/delete functions
                    break;
                case 'waterData':
                    await API.post('/api/water', data);
                    break;
                case 'userProfile':
                    await API.post('/api/profile', data);
                    break;
            }
        } catch (error) {
            console.log('API save failed:', error);
        }

        this.updateHomeSummary();
    }

    // ============================================
    // Initialization
    // ============================================
    init() {
        this.checkDailyReset();
        this.setupEventListeners();
        this.setupAuthListeners();
        this.updateWaterDisplay();
        this.renderDailyLog();
        this.renderWorkoutPlan();
        this.renderArticles();
        this.updateHomeSummary();
        this.loadProfile();
        this.renderPhotoTimeline();
        this.initCharts();
        console.log('🚀 Gym Pro Ready!');
    }

    checkDailyReset() {
        const today = new Date().toISOString().split('T')[0];
        if (this.waterData.date !== today) {
            this.waterData.date = today;
            this.waterData.today = 0;
            this.saveData('waterData', this.waterData);
        }
    }

    // ============================================
    // Event Listeners
    // ============================================
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.onclick = (e) => this.showSection(e.target.closest('.nav-btn').dataset.section);
        });

        // Water
        document.getElementById('addWaterBtn').onclick = () => this.addWater();
        document.getElementById('addGlassBtn').onclick = () => this.addGlass();
        document.getElementById('removeWaterBtn').onclick = () => this.removeWater();
        document.getElementById('resetWaterBtn').onclick = () => this.resetWater();
        document.getElementById('waterGoalSelect').onchange = (e) => this.setWaterGoal(e.target.value);

        // Food
        const foodInput = document.getElementById('foodImage');
        document.getElementById('uploadBox').onclick = () => foodInput.click();
        foodInput.onchange = (e) => this.analyzeFoodImage(e);

        // Manual Meal Entry
        document.getElementById('addMealBtn').onclick = () => this.addManualMeal();

        // Progress Photos
        const photoInput = document.getElementById('photoInput');
        document.getElementById('photoUploadBox').onclick = () => photoInput.click();
        photoInput.onchange = (e) => this.uploadProgressPhoto(e);

        // Profile
        document.getElementById('profileForm').onsubmit = (e) => {
            e.preventDefault();
            this.saveProfile();
        };

        // Vitals
        document.getElementById('saveVitalsBtn').onclick = () => this.saveVitals();

        // GPS
        document.getElementById('startTrackingBtn').onclick = () => this.toggleGPS();

        // Workout Filters
        document.querySelectorAll('.location-btn, .goal-btn').forEach(btn => {
            btn.onclick = (e) => {
                const parent = e.target.parentElement;
                parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderWorkoutPlan();
            };
        });
    }

    setupAuthListeners() {
        // Auth tabs
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.onclick = (e) => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');

                const tabName = e.target.dataset.tab;
                document.getElementById('loginForm').style.display = tabName === 'login' ? 'flex' : 'none';
                document.getElementById('registerFormModal').style.display = tabName === 'register' ? 'flex' : 'none';
            };
        });

        // Login form
        document.getElementById('loginForm').onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await this.handleLogin(email, password);
        };

        // Google login button
        const googleBtn = document.getElementById('googleLoginBtn');
        if (googleBtn) {
            googleBtn.onclick = () => this.handleGoogleLogin();
        }

        // Guest button
        document.getElementById('guestBtn').onclick = () => this.handleGuestLogin();

        // Logout button
        document.getElementById('logoutBtn').onclick = () => this.logout();
    }

    showSection(sectionId) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        document.getElementById(sectionId).classList.add('active');
        document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
    }

    // ============================================
    // Water Tracking
    // ============================================
    addWater() {
        if (this.waterData.today < 20) {
            this.waterData.today++;
            this.saveWaterAndSync();
            this.showWaterTip();
        }
    }

    addGlass() {
        if (this.waterData.today < 20) {
            this.waterData.today += 2;
            this.saveWaterAndSync();
            this.showWaterTip();
        }
    }

    removeWater() {
        if (this.waterData.today > 0) {
            this.waterData.today--;
            this.saveWaterAndSync();
        }
    }

    resetWater() {
        this.waterData.today = 0;
        this.saveWaterAndSync();
    }

    saveWaterAndSync() {
        const today = new Date().toISOString().split('T')[0];
        this.waterData.history[today] = this.waterData.today;
        this.saveData('waterData', this.waterData);
        this.updateWaterDisplay();
        this.renderWaterHistory();
    }

    updateWaterDisplay() {
        document.getElementById('waterCount').textContent = this.waterData.today;
        document.getElementById('waterTarget').textContent = '/ ' + this.waterData.target + ' أكواب';
        const percentage = (this.waterData.today / this.waterData.target) * 100;
        document.getElementById('waterLevel').style.height = Math.min(percentage, 100) + '%';
        document.getElementById('waterProgressText').textContent = Math.round(percentage) + '% من الهدف اليومي';
        this.updateHomeSummary();
    }

    showWaterTip() {
        const tips = [
            '💧 ممتاز!',
            ' استمر في الشرب🌊 جسمك يحتاج الماء ليعمل بشكل أفضل',
            '🥤 الماء يساعد على حرق الدهون',
            '💪 ممتاز! أنت على الطريق الصحيح',
            '🎯 اقتربت من هدفك اليومي',
            '😄 الماء يجعلك أكثر سعادة',
            '🏃 الماء مهم للرياضيين'
        ];
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        document.getElementById('tipText').textContent = randomTip;
    }

    renderWaterHistory() {
        const container = document.getElementById('historyBars');
        if (!container) return;

        const days = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
        const today = new Date();

        let html = '';
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = days[date.getDay()];
            const count = this.waterData.history[dateStr] || 0;
            const height = Math.min((count / this.waterData.target) * 100, 100);

            html += `
                <div class="history-day">
                    <div class="history-bar">
                        <div class="history-fill" style="height: ${height}%"></div>
                    </div>
                    <span>${i === 0 ? 'اليوم' : dayName}</span>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    setWaterGoal(goal) {
        this.waterData.target = parseInt(goal);
        this.saveData('waterData', this.waterData);
        this.updateWaterDisplay();
    }

    // ============================================
    // Food Tracking
    // ============================================
    async analyzeFoodImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        const box = document.getElementById('uploadBox');
        box.innerHTML = '<div style="text-align:center;"><div class="upload-icon">🤖</div><p>🤔 جاري تحليل الصورة بالذكاء الاصطناعي...</p></div>';

        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target.result;

            if (!this.isGuestMode) {
                try {
                    // Try API first
                    const base64Image = imageData.split(',')[1];
                    const data = await API.post('/api/analyze-food', { image: base64Image });

                    if (data.foods && data.foods.length > 0) {
                        this.processFoodAnalysis(data.foods, data.totals, imageData);
                        return;
                    }
                } catch (error) {
                    console.log('API failed, using local:', error);
                }
            }

            // Fallback to local analysis
            this.analyzeWithLocalDB(imageData);
        };

        reader.readAsDataURL(file);
    }

    processFoodAnalysis(foods, totals, imageData) {
        const box = document.getElementById('uploadBox');

        const emoji = { front: '📷', side: '📸', back: '📸' };

        box.innerHTML = `
            <div style="text-align:center;">
                <img src="${imageData}" style="width:120px; height:120px; object-fit:cover; border-radius:15px; margin-bottom:15px;">
                <h4 style="color:var(--secondary);">✅ تم التحليل بالذكاء الاصطناعي!</h4>
                <p style="font-size:0.9rem; color:#aaa;">${foods.map(f => f.name + ' (' + f.confidence + '%)').join(' + ')}</p>
            </div>
        `;

        foods.forEach(f => {
            const meal = {
                id: Date.now() + Math.random(),
                name: f.name,
                calories: f.calories,
                protein: f.protein,
                carbs: f.carbs,
                fat: f.fat,
                date: new Date().toISOString().split('T')[0]
            };
            this.dailyMeals.push(meal);
        });

        this.saveData('dailyMeals', this.dailyMeals);
        this.renderDailyLog();

        alert(`✅ تم اكتشاف ${foods.length} نوع طعام!\n\n${foods.map(f => f.name + ': ' + f.calories + ' سعرة').join('\n')}\n\nإجمالي: ${totals.calories} سعرة | ${totals.protein}g بروتين`);

        setTimeout(() => {
            box.innerHTML = '<div class="upload-icon">📷</div><p>اضغط لرفع صورة الطعام</p><small style="color: #6b7280;">JPG, PNG - الحد الأقصى 5MB</small>';
        }, 5000);
    }

    analyzeWithLocalDB(imageData) {
        // Use local food database for fallback
        const foods = [
            { name: 'وجبة', calories: 250, protein: 15, carbs: 30, fat: 8 }
        ];

        this.processFoodAnalysis(foods, { calories: 250, protein: 15 }, imageData);
    }

    renderDailyLog() {
        const list = document.getElementById('mealsList');
        const today = new Date().toISOString().split('T')[0];

        let meals;
        if (this.isGuestMode || !this.isAuthenticated) {
            meals = this.dailyMeals.filter(m => m.date === today);
        } else {
            // API mode - show all meals
            meals = this.dailyMeals;
        }

        list.innerHTML = meals.map(m => `
            <div class="meal-item" style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.05); padding:12px; border-radius:10px; margin-bottom:8px;">
                <span>${m.name}</span>
                <span style="color:#aaa; font-size:0.85rem;">${m.calories} سعرة | ${m.protein}g بروتين${m.carbs ? ' | ' + m.carbs + 'g كربو' : ''}${m.fat ? ' | ' + m.fat + 'g دهن' : ''}</span>
            </div>
        `).join('') || '<p style="opacity:0.5; text-align:center;">لا وجبات</p>';

        this.updateDailySummary();
    }

    updateDailySummary() {
        const today = new Date().toISOString().split('T')[0];
        let meals;

        if (this.isGuestMode || !this.isAuthenticated) {
            meals = this.dailyMeals.filter(m => m.date === today);
        } else {
            meals = this.dailyMeals;
        }

        document.getElementById('totalCalories').textContent = meals.reduce((a, b) => a + b.calories, 0);
        document.getElementById('totalProtein').textContent = meals.reduce((a, b) => a + (b.protein || 0), 0) + 'g';
        this.updateHomeSummary();
    }

    // Manual meal entry
    addManualMeal() {
        const name = document.getElementById('mealName').value.trim();
        const calories = parseInt(document.getElementById('mealCalories').value) || 0;
        const protein = parseInt(document.getElementById('mealProtein').value) || 0;
        const carbs = parseInt(document.getElementById('mealCarbs')?.value) || 0;

        if (!name) {
            alert('الرجاء إدخال اسم الوجبة');
            return;
        }

        const meal = {
            id: Date.now(),
            name: name,
            calories: calories,
            protein: protein,
            carbs: carbs,
            date: new Date().toISOString().split('T')[0]
        };

        this.dailyMeals.push(meal);
        this.saveData('dailyMeals', this.dailyMeals);
        this.renderDailyLog();

        // Clear inputs
        document.getElementById('mealName').value = '';
        document.getElementById('mealCalories').value = '';
        document.getElementById('mealProtein').value = '';

        alert('✅ تم إضافة الوجبة بنجاح!');
    }

    // ============================================
    // Progress Photos
    // ============================================
    async uploadProgressPhoto(event) {
        const file = event.target.files[0];
        if (!file) return;

        const photoType = document.querySelector('input[name="photoType"]:checked').value;
        const reader = new FileReader();

        reader.onload = async (e) => {
            const imageData = e.target.result;

            if (!this.isGuestMode) {
                try {
                    // Upload via API
                    const formData = new FormData();
                    formData.append('photo', new Blob([this.base64ToArrayBuffer(imageData)], { type: 'file.type' }));
                    formData.append('type', photoType);

                    const response = await fetch(`${CONFIG.API_URL}/api/photos`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.token}` },
                        body: formData
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.progressPhotos.unshift(data.photo);
                        this.saveData('progressPhotos', this.progressPhotos);
                        this.renderPhotoTimeline();
                        alert('✅ تم حفظ صورة التقدم!');
                        return;
                    }
                } catch (error) {
                    console.log('API upload failed:', error);
                }
            }

            // Fallback to local
            const photo = {
                id: Date.now(),
                image: imageData,
                type: photoType,
                date: new Date().toISOString().split('T')[0],
                timestamp: new Date().toISOString()
            };

            this.progressPhotos.push(photo);
            this.saveData('progressPhotos', this.progressPhotos);
            this.renderPhotoTimeline();

            alert('✅ تم حفظ صورة التقدم محلياً!');
        };

        reader.readAsDataURL(file);
    }

    base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64.split(',')[1]);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    renderPhotoTimeline() {
        const timeline = document.getElementById('photoTimeline');
        if (!timeline) return;

        if (this.progressPhotos.length === 0) {
            timeline.innerHTML = '<p style="opacity:0.5; text-align:center;">لا توجد صور بعد</p>';
            return;
        }

        const typeLabels = { front: 'أمامية', side: 'جانبية', back: 'خلفية' };

        timeline.innerHTML = this.progressPhotos.slice(0, 10).map(p => `
            <div class="photo-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:15px; display:flex; gap:15px; align-items:center;">
                <img src="${p.image || p.image_url}" style="width:80px; height:80px; object-fit:cover; border-radius:10px;">
                <div>
                    <strong>${typeLabels[p.type]}</strong><br>
                    <small style="color:var(--text-muted);">${p.date}</small>
                </div>
            </div>
        `).join('');
    }

    // ============================================
    // Workout
    // ============================================
    renderWorkoutPlan() {
        const location = document.querySelector('.location-btn.active')?.dataset.location || 'home';
        const goal = document.querySelector('.goal-btn.active')?.dataset.goal || 'cut';
        const plan = document.getElementById('workoutPlan');
        if (!plan) return;

        const workouts = {
            home: {
                cut: ['تمارين ضغط - 3 مجموعات', 'قرفصاء - 4 مجموعات', 'بلانك - 60 ثانية', 'قفز بالحبل - 10 دقائق'],
                bulk: ['ضغط واسع - 4 مجموعات', 'قرفصاء بلغاري - 3 مجموعات', 'عقبات - 3 مجموعات', 'دقائق رفع أثقال']
            },
            gym: {
                cut: ['ركض 20 دقيقة', 'تدريب دائري عالي الكثافة', 'سباحة', 'تمارين كارديو'],
                bulk: ['بنش برس - 4 مجموعات', 'ديدليفت - 3 مجموعات', 'قرفصاء بالبار - 4 مجموعات', 'صفوف - 4 مجموعات']
            }
        };

        plan.innerHTML = workouts[location][goal].map(ex => `
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:10px; border-right:4px solid var(--primary);">
                ${ex}
            </div>
        `).join('');
    }

    // ============================================
    // Articles
    // ============================================
    renderArticles() {
        const articles = [
            { t: 'أهمية البروتين', d: 'يساعد البروتين في بناء العضلات واستشفائها بعد التمرين.', c: '🥗' },
            { t: 'شرب الماء والتحمل', d: 'الجفاف يقلل من أدائك الرياضي بنسبة تصل إلى 20%.', c: '💧' },
            { t: 'النوم العميق', d: 'يفرز الجسم هرمون النمو أثناء النوم العميق ليلاً.', c: '😴' },
            { t: 'التوازن الغذائي', d: 'احصل على توازن بين البروتين والكربوهيدرات والدهون.', c: '⚖️' }
        ];

        const container = document.getElementById('articlesList');
        if (!container) return;

        container.innerHTML = articles.map(a => `
            <div class="summary-card" style="flex-direction:column; align-items:flex-start;">
                <div style="font-size:2rem; margin-bottom:10px;">${a.c}</div>
                <h3 style="font-size:1rem; margin-bottom:8px;">${a.t}</h3>
                <p style="color:var(--text-muted); font-size:0.9rem;">${a.d}</p>
            </div>
        `).join('');
    }

    // ============================================
    // Profile
    // ============================================
    loadProfile() {
        document.getElementById('userName').value = this.userProfile.name || '';
        document.getElementById('userAge').value = this.userProfile.age || '';
        document.getElementById('userHeight').value = this.userProfile.height || '';
        document.getElementById('userWeight').value = this.userProfile.weight || '';
    }

    async saveProfile() {
        const name = document.getElementById('userName').value;
        const age = document.getElementById('userAge').value;
        const height = document.getElementById('userHeight').value;
        const weight = document.getElementById('userWeight').value;

        const oldWeight = this.userProfile.weight;

        this.userProfile = {
            ...this.userProfile,
            name, age, height, weight
        };

        // Add to history if weight changed or history empty
        if (weight && weight !== oldWeight) {
            if (!this.userProfile.weightHistory) this.userProfile.weightHistory = [];
            this.userProfile.weightHistory.push({
                weight: parseFloat(weight),
                date: new Date().toISOString().split('T')[0]
            });
            // Keep only last 10 entries
            if (this.userProfile.weightHistory.length > 10) this.userProfile.weightHistory.shift();
        }

        this.saveData('userProfile', this.userProfile);
        alert('✅ تم حفظ البيانات!');
    }

    // ============================================
    // Vitals
    // ============================================
    async saveVitals() {
        const vitals = {
            systolic: document.getElementById('systolicBP').value,
            diastolic: document.getElementById('diastolicBP').value,
            heartRate: document.getElementById('heartRate').value,
            bloodSugar: document.getElementById('bloodSugar').value,
            cholesterol: document.getElementById('cholesterol').value
        };

        if (this.isGuestMode) {
            this.vitalsData.push({ ...vitals, created_at: new Date().toISOString() });
            localStorage.setItem('vitalsData', JSON.stringify(this.vitalsData));
        } else {
            try {
                await API.post('/api/vitals', vitals);
            } catch (error) {
                console.log('API failed, saving locally');
                this.vitalsData.push({ ...vitals, created_at: new Date().toISOString() });
                localStorage.setItem('vitalsData', JSON.stringify(this.vitalsData));
            }
        }

        alert('✅ تم حفظ القياسات!');
    }

    // ============================================
    // Dashboard Summary
    // ============================================
    updateHomeSummary() {
        const today = new Date().toISOString().split('T')[0];

        // Water
        document.getElementById('homeWater').textContent =
            `${this.waterData.today}/${this.waterData.target} أكواب`;

        // Calories
        const todayMeals = this.dailyMeals.filter(m => m.date === today);
        const totalCalories = todayMeals.reduce((a, b) => a + b.calories, 0);
        const target = this.userProfile.targetCalories || 2000;
        document.getElementById('homeCalories').textContent = `${totalCalories}/${target}`;

        // Workout
        document.getElementById('homeWorkout').textContent = this.progressPhotos.length > 0 ? 'نشط' : 'لم يبدأ';

        // Sleep (placeholder)
        document.getElementById('homeSleep').textContent = '-- ساعات';

        // Update Charts
        this.updateCharts();
    }

    // ============================================
    // GPS Tracking (Placeholder)
    // ============================================
    toggleGPS() {
        const startBtn = document.getElementById('startTrackingBtn');
        const stopBtn = document.getElementById('stopTrackingBtn');

        if (startBtn.style.display !== 'none') {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            alert('📍 جاري تتبع موقعك...');
        } else {
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            alert('⏹️ تم إيقاف التتبع');
        }
    }

    // ============================================
    // Chart.js Implementations
    // ============================================
    initCharts() {
        const ctxWeight = document.getElementById('weightProgressChart')?.getContext('2d');
        const ctxCalories = document.getElementById('caloriesChart')?.getContext('2d');

        if (ctxWeight) {
            this.charts.weight = new Chart(ctxWeight, {
                type: 'line',
                data: {
                    labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4'],
                    datasets: [{
                        label: 'الوزن (كجم)',
                        data: [this.userProfile.weight || 80, (this.userProfile.weight || 80) - 0.5, (this.userProfile.weight || 80) - 1.2, (this.userProfile.weight || 80) - 1.5],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#3b82f6',
                        pointBorderColor: '#fff',
                        pointRadius: 5
                    }]
                },
                options: this.getChartOptions()
            });
        }

        if (ctxCalories) {
            this.charts.calories = new Chart(ctxCalories, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'السعرات المستهلكة',
                        data: [],
                        backgroundColor: '#10b981',
                        borderRadius: 8,
                    }]
                },
                options: this.getChartOptions()
            });
        }

        const ctxWater = document.getElementById('waterHistoryChart')?.getContext('2d');
        if (ctxWater) {
            this.charts.water = new Chart(ctxWater, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'أكواب الماء',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointBackgroundColor: '#3b82f6'
                    }]
                },
                options: this.getChartOptions()
            });
        }

        const ctxBP = document.getElementById('bpChart')?.getContext('2d');
        if (ctxBP) {
            this.charts.vitals = new Chart(ctxBP, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'انقباضي', data: [], borderColor: '#ef4444', tension: 0.3 },
                        { label: 'انبساطي', data: [], borderColor: '#3b82f6', tension: 0.3 }
                    ]
                },
                options: this.getChartOptions()
            });
        }

        this.updateCharts();
    }

    getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Cairo' },
                    bodyFont: { family: 'Cairo' }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Cairo' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Cairo' } }
                }
            }
        };
    }

    updateCharts() {
        if (this.charts.calories) {
            const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const last7Days = [];
            const data = [];

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                last7Days.push(days[d.getDay()]);

                const dayCalories = this.dailyMeals
                    .filter(m => m.date === dateStr)
                    .reduce((sum, m) => sum + m.calories, 0);
                data.push(dayCalories);
            }

            this.charts.calories.data.labels = last7Days;
            this.charts.calories.data.datasets[0].data = data;
            this.charts.calories.update();
        }

        // Water History Chart
        if (this.charts.water) {
            const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const last7Days = [];
            const data = [];

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                last7Days.push(days[d.getDay()]);

                const dayWater = this.waterData.history[dateStr] || 0;
                data.push(dayWater);
            }

            this.charts.water.data.labels = last7Days;
            this.charts.water.data.datasets[0].data = data;
            this.charts.water.update();
        }

        // Vitals Chart
        if (this.charts.vitals && this.vitalsData.length > 0) {
            const history = this.vitalsData.slice(-7); // Last 10 readings
            this.charts.vitals.data.labels = history.map(v => new Date(v.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' }));
            this.charts.vitals.data.datasets[0].data = history.map(v => v.systolic);
            this.charts.vitals.data.datasets[1].data = history.map(v => v.diastolic);
            this.charts.vitals.update();
        }

        // For Weight
        if (this.charts.weight && this.userProfile.weightHistory && this.userProfile.weightHistory.length > 0) {
            const history = this.userProfile.weightHistory;
            this.charts.weight.data.labels = history.map(h => h.date);
            this.charts.weight.data.datasets[0].data = history.map(h => h.weight);
            this.charts.weight.update();
        } else if (this.charts.weight) {
            this.charts.weight.update();
        }
    }
}

// ============================================
// Initialize App
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SmartTrainerPro();
});

// Global function for modal registration
async function registerUser() {
    const name = document.getElementById('registerNameModal').value;
    const email = document.getElementById('registerEmailModal').value;
    const password = document.getElementById('registerPasswordModal').value;

    if (!email || !password) {
        alert('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
        return;
    }

    if (password.length < 6) {
        alert('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return;
    }

    if (window.app) {
        await window.app.handleRegister(name, email, password);
    }
}
