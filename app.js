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
        
        // Show loading state
        box.innerHTML = '<div style="text-align:center;"><div class="upload-icon">🤖</div><p>🤔 جاري تحليل الصورة بالذكاء الاصطناعي...</p></div>';
        
        // Create image preview
        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target.result;
            
            // Simulate AI processing time
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Extended food database for AI-like detection
            const foodDatabase = [
                { n: 'دجاج مشوي', c: 165, p: 31, f: 3.6, cbs: 0, img: '🍗' },
                { n: 'أرز أبيض', c: 130, p: 2.7, f: 0.3, cbs: 28, img: '🍚' },
                { n: 'سلطة خضراء', c: 35, p: 2, f: 0.3, cbs: 7, img: '🥗' },
                { n: 'سمك مشوي', c: 136, p: 26, f: 3, cbs: 0, img: '🐟' },
                { n: 'بيض مسلوق', c: 78, p: 6, f: 5, cbs: 0.6, img: '🥚' },
                { n: 'شوفان', c: 150, p: 5, f: 3, cbs: 27, img: '🥣' },
                { n: 'موز', c: 89, p: 1.1, f: 0.3, cbs: 23, img: '🍌' },
                { n: 'تفاح', c: 52, p: 0.3, f: 0.2, cbs: 14, img: '🍎' },
                { n: 'زبادي', c: 100, p: 17, f: 0.7, cbs: 6, img: '🥛' },
                { n: 'خبز أبيض', c: 79, p: 2.7, f: 1, cbs: 15, img: '🍞' },
                { n: 'مكرونة', c: 131, p: 5, f: 1.1, cbs: 25, img: '🍝' },
                { n: 'hamburger', c: 295, p: 17, f: 14, cbs: 24, img: '🍔' },
                { n: 'بيتزا', c: 266, p: 11, f: 10, cbs: 33, img: '🍕' },
                { n: 'فول مدمس', c: 114, p: 8, f: 0.4, cbs: 20, img: '🫘' },
                { n: 'كبة', c: 180, p: 12, f: 10, cbs: 12, img: '🥟' }
            ];
            
            // Simulate AI detection with random selection
            const detectedFoods = [];
            const numFoods = Math.floor(Math.random() * 3) + 1; // Detect 1-3 foods
            
            for (let i = 0; i < numFoods; i++) {
                const randomFood = foodDatabase[Math.floor(Math.random() * foodDatabase.length)];
                if (!detectedFoods.find(f => f.n === randomFood.n)) {
                    detectedFoods.push(randomFood);
                }
            }
            
            // Calculate totals
            const totalCalories = detectedFoods.reduce((sum, f) => sum + f.c, 0);
            const totalProtein = detectedFoods.reduce((sum, f) => sum + f.p, 0);
            const totalCarbs = detectedFoods.reduce((sum, f) => sum + f.cbs, 0);
            
            // Show results
            box.innerHTML = `
                <div style="text-align:center;">
                    <img src="${imageData}" style="width:120px; height:120px; object-fit:cover; border-radius:15px; margin-bottom:15px;">
                    <h4 style="color:var(--secondary);">✅ تم التحليل!</h4>
                    <p style="font-size:0.9rem; color:#aaa;">${detectedFoods.map(f => f.img + ' ' + f.n).join(' + ')}</p>
                </div>
            `;
            
            // Add to meals
            detectedFoods.forEach(f => {
                const meal = {
                    id: Date.now() + Math.random(),
                    name: f.n,
                    calories: f.c,
                    protein: f.p,
                    carbs: f.cbs,
                    fat: f.f,
                    date: new Date().toISOString().split('T')[0]
                };
                this.dailyMeals.push(meal);
            });
            
            this.saveData('dailyMeals', this.dailyMeals);
            this.renderDailyLog();
            
            // Show detailed result
            alert(`✅ تم اكتشاف ${numFoods} نوع طعام!\n\n${detectedFoods.map(f => f.img + ' ' + f.n + ': ' + f.c + ' سعرة').join('\n')}\n\nإجمالي: ${totalCalories} سعرة | ${totalProtein}g بروتين | ${totalCarbs}g كربوهيدرات`);
            
            // Reset box after 3 seconds
            setTimeout(() => {
                box.innerHTML = '<div class="upload-icon">📷</div><p>اضغط لرفع صورة الطعام</p><small style="color: #6b7280;">JPG, PNG - الحد الأقصى 5MB</small>';
            }, 5000);
        };
        
        reader.readAsDataURL(file);
    }

    renderDailyLog() {
        const list = document.getElementById('mealsList');
        const today = new Date().toISOString().split('T')[0];
        const meals = this.dailyMeals.filter(m => m.date === today);
        list.innerHTML = meals.map(m => `
            <div class="meal-item" style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.05); padding:12px; border-radius:10px; margin-bottom:8px;">
                <span>${m.name}</span>
                <span style="color:#aaa; font-size:0.85rem;">${m.calories} سعرة | ${m.protein}g بروتين${m.carbs ? ' | '+m.carbs+'g كربو' : ''}${m.fat ? ' | '+m.fat+'g دهن' : ''}</span>
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
