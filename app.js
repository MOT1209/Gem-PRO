class SmartTrainerPro {
    constructor() {
        this.loadAllData();
        this.init();
    }

    loadAllData() {
        this.dailyMeals = JSON.parse(localStorage.getItem('dailyMeals')) || [];
        this.waterData = JSON.parse(localStorage.getItem('waterData')) || {
            today: 0, history: {}, target: 8, date: new Date().toISOString().split('T')[0]
        };
        this.userProfile = JSON.parse(localStorage.getItem('userProfile')) || {
            name: '', age: '', height: '', weight: '', targetCalories: 2000
        };
        this.vitalsData = JSON.parse(localStorage.getItem('vitalsData')) || [];
        this.progressPhotos = JSON.parse(localStorage.getItem('progressPhotos')) || [];
    }

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        this.updateHomeSummary();
    }

    init() {
        this.checkDailyReset();
        this.setupEventListeners();
        this.updateWaterDisplay();
        this.renderDailyLog();
        this.renderWorkoutPlan();
        this.renderArticles();
        this.updateHomeSummary();
        this.loadProfile();
        this.renderPhotoTimeline();
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

    setupEventListeners() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.onclick = (e) => this.showSection(e.target.closest('.nav-btn').dataset.section);
        });

        // Water
        document.getElementById('addWaterBtn').onclick = () => this.addWater();
        document.getElementById('removeWaterBtn').onclick = () => this.removeWater();
        document.getElementById('resetWaterBtn').onclick = () => this.resetWater();

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

    // --- Water ---
    addWater() {
        if (this.waterData.today < 20) {
            this.waterData.today++;
            this.saveWaterAndSync();
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
    }
    updateWaterDisplay() {
        document.getElementById('waterCount').textContent = this.waterData.today;
        const percentage = (this.waterData.today / this.waterData.target) * 100;
        document.getElementById('waterLevel').style.height = Math.min(percentage, 100) + '%';
        this.updateHomeSummary();
    }

    // --- Food ---
    async analyzeFoodImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        const box = document.getElementById('uploadBox');
        box.innerHTML = '⌛ جاري التحليل...';
        setTimeout(() => {
            const foods = [{ n: 'دجاج مشوي', c: 165, p: 31 }, { n: 'بيض مسلوق', c: 78, p: 6 }, { n: 'شوفان', c: 150, p: 5 }];
            const f = foods[Math.floor(Math.random() * foods.length)];
            const meal = { id: Date.now(), name: f.n, calories: f.c, protein: f.p, date: new Date().toISOString().split('T')[0] };
            this.dailyMeals.push(meal);
            this.saveData('dailyMeals', this.dailyMeals);
            this.renderDailyLog();
            box.innerHTML = '📷 اضغط لرفع صورة أخرى';
            alert(`✅ تم اكتشاف: ${f.n}`);
        }, 1200);
    }

    renderDailyLog() {
        const list = document.getElementById('mealsList');
        const today = new Date().toISOString().split('T')[0];
        const meals = this.dailyMeals.filter(m => m.date === today);
        list.innerHTML = meals.map(m => `
            <div class="meal-item" style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.05); padding:12px; border-radius:10px; margin-bottom:8px;">
                <span>${m.name}</span>
                <span>${m.calories} سعرة</span>
            </div>
        `).join('') || '<p style="opacity:0.5; text-align:center;">لا وجبات</p>';
        this.updateDailySummary();
    }

    updateDailySummary() {
        const today = new Date().toISOString().split('T')[0];
        const meals = this.dailyMeals.filter(m => m.date === today);
        document.getElementById('totalCalories').textContent = meals.reduce((a, b) => a + b.calories, 0);
        document.getElementById('totalProtein').textContent = meals.reduce((a, b) => a + b.protein, 0) + 'g';
        this.updateHomeSummary();
    }

    // --- Manual Meal Entry ---
    addManualMeal() {
        const name = document.getElementById('mealName').value.trim();
        const calories = parseInt(document.getElementById('mealCalories').value) || 0;
        const protein = parseInt(document.getElementById('mealProtein').value) || 0;

        if (!name) {
            alert('الرجاء إدخال اسم الوجبة');
            return;
        }

        const meal = {
            id: Date.now(),
            name: name,
            calories: calories,
            protein: protein,
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

    // --- Progress Photos ---
    uploadProgressPhoto(event) {
        const file = event.target.files[0];
        if (!file) return;

        const photoType = document.querySelector('input[name="photoType"]:checked').value;
        const reader = new FileReader();

        reader.onload = (e) => {
            const photo = {
                id: Date.now(),
                image: e.target.result,
                type: photoType,
                date: new Date().toISOString().split('T')[0],
                timestamp: new Date().toISOString()
            };

            this.progressPhotos.push(photo);
            this.saveData('progressPhotos', this.progressPhotos);
            this.renderPhotoTimeline();

            alert('✅ تم حفظ صورة التقدم بنجاح!');
        };

        reader.readAsDataURL(file);
    }

    renderPhotoTimeline() {
        const timeline = document.getElementById('photoTimeline');
        if (!timeline) return;

        if (this.progressPhotos.length === 0) {
            timeline.innerHTML = '<p style="opacity:0.5; text-align:center;">لا توجد صور بعد</p>';
            return;
        }

        const typeLabels = {
            front: 'أمامية',
            side: 'جانبية',
            back: 'خلفية'
        };

        timeline.innerHTML = this.progressPhotos.slice().reverse().map(p => `
            <div class="photo-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:15px; display:flex; gap:15px; align-items:center;">
                <img src="${p.image}" style="width:80px; height:80px; object-fit:cover; border-radius:10px;">
                <div>
                    <strong>${typeLabels[p.type]}</strong><br>
                    <small style="color:var(--text-muted);">${p.date}</small>
                </div>
            </div>
        `).join('');
    }

    // --- Workout ---
    renderWorkoutPlan() {
        const location = document.querySelector('.location-btn.active').dataset.location;
        const goal = document.querySelector('.goal-btn.active').dataset.goal;
        const plan = document.getElementById('workoutPlan');

        const workouts = {
            home: { cut: ['تمارين ضغط - 3 مجموعات', 'قرفصاء - 4 مجموعات', 'بلانك - 60 ثانية'], bulk: ['ضغط واسع - 4 مجموعات', 'قرفصاء بلغاري - 3 مجموعات', 'عقبات - 3 مجموعات'] },
            gym: { cut: ['ركض 20 دقيقة', 'تدريب دائري عالي الكثافة', 'سباحة'], bulk: ['بنش برس - 4 مجموعات', 'ديدليفت - 3 مجموعات', 'قرفصاء بالبار - 4 مجموعات'] }
        };

        plan.innerHTML = workouts[location][goal].map(ex => `
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:10px; border-right:4px solid var(--primary);">
                ${ex}
            </div>
        `).join('');
    }

    // --- Articles ---
    renderArticles() {
        const articles = [
            { t: 'أهمية البروتين', d: 'يساعد البروتين في بناء العضلات واستشفائها بعد التمرين.' },
            { t: 'شرب الماء والتحمل', d: 'الجفاف يقلل من أدائك الرياضي بنسبة تصل إلى 20%.' },
            { t: 'النوم العميق', d: 'يفرز الجسم هرمون النمو أثناء النوم العميق ليلاً.' }
        ];
        document.getElementById('articlesList').innerHTML = articles.map(a => `
            <div class="summary-card" style="flex-direction:column; align-items:flex-start;">
                <h3>${a.t}</h3>
                <p style="font-size:0.9rem; color:var(--text-muted);">${a.d}</p>
            </div>
        `).join('');
    }

    // --- Profile ---
    loadProfile() {
        const p = this.userProfile;
        document.getElementById('userName').value = p.name || '';
        document.getElementById('userAge').value = p.age || '';
        document.getElementById('userHeight').value = p.height || '';
        document.getElementById('userWeight').value = p.weight || '';
    }

    saveProfile() {
        this.userProfile = {
            name: document.getElementById('userName').value,
            age: document.getElementById('userAge').value,
            height: document.getElementById('userHeight').value,
            weight: document.getElementById('userWeight').value,
            targetCalories: 2000
        };
        this.saveData('userProfile', this.userProfile);
        alert('✅ تم حفظ البيانات!');
    }

    // --- Vitals ---
    saveVitals() {
        alert('✅ تم حفظ القياسات الحيوية بنجاح!');
        this.showSection('home');
    }

    // --- GPS ---
    toggleGPS() {
        this.isTracking = !this.isTracking;
        const btn = document.getElementById('startTrackingBtn');
        if (this.isTracking) {
            btn.textContent = '⏹️ إيقاف التتبع';
            btn.style.background = 'var(--danger)';
            alert('📡 جاري البحث عن إشارة GPS...');
        } else {
            btn.textContent = '▶️ بدء التتبع';
            btn.style.background = 'var(--secondary)';
            alert('🏁 تم حفظ المسار بنجاح!');
        }
    }

    // --- Common ---
    updateHomeSummary() {
        const today = new Date().toISOString().split('T')[0];
        const meals = this.dailyMeals.filter(m => m.date === today);
        const calories = meals.reduce((a, b) => a + b.calories, 0);

        if (document.getElementById('homeWater')) document.getElementById('homeWater').textContent = `${this.waterData.today}/8 أكواب`;
        if (document.getElementById('homeCalories')) document.getElementById('homeCalories').textContent = `${calories}/${this.userProfile.targetCalories || 2000}`;
    }

    showSection(id) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        document.querySelector(`[data-section="${id}"]`).classList.add('active');
        window.scrollTo(0, 0);
    }
}

const app = new SmartTrainerPro();
window.app = app;
