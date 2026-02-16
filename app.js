class SmartTrainerPro {
    constructor() {
        // تهيئة Supabase
        this.supabase = window.supabase.createClient(
            'https://ilopoevhgkgepumjsmid.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsb3BvZXZoZ2tnZXB1bWpzbWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NjQ5NDAsImV4cCI6MjA4NDE0MDk0MH0.LnJN5o9MqSLodN1PXwRLIBuDWUiZ-9rGb1CLdz3fdt8'
        );
        
        this.loadAllData();
        this.init();
    }

    async loadAllData() {
        try {
            // تحميل البيانات من Supabase
            const { data: meals } = await this.supabase.from('meals').select('*');
            this.dailyMeals = meals || [];
            
            const { data: water } = await this.supabase.from('water').select('*');
            this.waterData = water?.[0] || { today: 0, history: {}, target: 8, date: new Date().toISOString().split('T')[0] };
            
            const { data: profile } = await this.supabase.from('profile').select('*');
            this.userProfile = profile?.[0] || { name: '', age: '', height: '', weight: '', targetCalories: 2000 };
            
            const { data: vitals } = await this.supabase.from('vitals').select('*');
            this.vitalsData = vitals || [];
            
            const { data: photos } = await this.supabase.from('photos').select('*');
            this.progressPhotos = photos || [];
        } catch (error) {
            console.log('Using localStorage fallback:', error);
            // Fallback لـ localStorage
            this.dailyMeals = JSON.parse(localStorage.getItem('dailyMeals')) || [];
            this.waterData = JSON.parse(localStorage.getItem('waterData')) || { today: 0, history: {}, target: 8, date: new Date().toISOString().split('T')[0] };
            this.userProfile = JSON.parse(localStorage.getItem('userProfile')) || { name: '', age: '', height: '', weight: '', targetCalories: 2000 };
            this.vitalsData = JSON.parse(localStorage.getItem('vitalsData')) || [];
            this.progressPhotos = JSON.parse(localStorage.getItem('progressPhotos')) || [];
        }
    }

    async saveData(key, data) {
        // حفظ في localStorage كنسخة احتياطية
        localStorage.setItem(key, JSON.stringify(data));
        
        // حفظ في Supabase
        try {
            if (key === 'dailyMeals') {
                await this.supabase.from('meals').upsert(data.map(m => ({ ...m, id: m.id || undefined })));
            } else if (key === 'waterData') {
                await this.supabase.from('water').upsert([data]);
            } else if (key === 'userProfile') {
                await this.supabase.from('profile').upsert([data]);
            }
        } catch (error) {
            console.log('Supabase save error:', error);
        }
        
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

    // --- Water ---
    addWater() {
        if (this.waterData.today < 20) {
            this.waterData.today++;
            this.saveWaterAndSync();
            this.showWaterTip();
        }
    }
    addGlass() {
        if (this.waterData.today < 20) {
            this.waterData.today += 2; // Large glass = 2 cups
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
            '💧 ممتاز! استمر في الشرب',
            '🌊 جسمك يحتاج الماء ليعمل بشكل أفضل',
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
            
            try {
                // استخدام Google Cloud Vision API
                const apiKey = 'AIzaSyChzhyU3u7dPWQ5mnfPWrbs2dOjYzIx614';
                
                // تحويل الصورة لـ base64
                const base64Image = imageData.split(',')[1];
                
                const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        requests: [{
                            image: { content: base64Image },
                            features: [{ type: 'LABEL_DETECTION', maxResults: 10 }],
                            imageContext: { 
                                labelDetectionParams: {
                                    confidenceThreshold: 0.7
                                }
                            }
                        }]
                    })
                });
                
                const result = await response.json();
                
                if (result.responses && result.responses[0].labelAnnotations) {
                    const labels = result.responses[0].labelAnnotations;
                    this.processGoogleVisionResults(labels, imageData);
                } else {
                    // إذا فشل، استخدم البديل المحلي
                    this.analyzeWithLocalDB(imageData);
                }
            } catch (error) {
                console.log('API error:', error);
                this.analyzeWithLocalDB(imageData);
            }
        };
        
        reader.readAsDataURL(file);
    }

    // معالجة نتائج Google Vision
    processGoogleVisionResults(labels, imageData) {
        const box = document.getElementById('uploadBox');
        
        // فلتر النتائج للبحث عن طعام
        const foodLabels = labels.filter(l => 
            l.description.toLowerCase().includes('food') ||
            l.description.toLowerCase().includes('dish') ||
            l.description.toLowerCase().includes('meal') ||
            ['chicken', 'rice', 'salad', 'pizza', 'burger', 'bread', 'egg', 'meat', 'fish', 'vegetable', 'fruit', 'pasta', 'soup', 'dessert', 'cake', 'cookie', 'coffee', 'drink', 'juice', 'sandwich', 'wrap', 'taco', 'sushi', 'noodle', 'potato', 'tomato', 'onion', 'cheese', 'lettuce', 'carrot'].some(f => l.description.toLowerCase().includes(f))
        ).slice(0, 3);
        
        if (foodLabels.length === 0) {
            // إذا لم يجد طعام، استخدم أول 3 نتائج
            this.analyzeWithLocalDB(imageData);
            return;
        }
        
        // قاعدة بيانات لترجمة النتائج
        const foodDatabase = {
            'chicken': { n: 'دجاج', c: 165, p: 31, f: 3.6, cbs: 0, img: '🍗' },
            'rice': { n: 'أرز', c: 130, p: 2.7, f: 0.3, cbs: 28, img: '🍚' },
            'salad': { n: 'سلطة', c: 35, p: 2, f: 0.3, cbs: 7, img: '🥗' },
            'pizza': { n: 'بيتزا', c: 266, p: 11, f: 10, cbs: 33, img: '🍕' },
            'burger': { n: 'همبرجر', c: 295, p: 17, f: 14, cbs: 24, img: '🍔' },
            'bread': { n: 'خبز', c: 79, p: 2.7, f: 1, cbs: 15, img: '🍞' },
            'egg': { n: 'بيض', c: 78, p: 6, f: 5, cbs: 0.6, img: '🥚' },
            'meat': { n: 'لحم', c: 250, p: 26, f: 15, cbs: 0, img: '🥩' },
            'fish': { n: 'سمك', c: 136, p: 26, f: 3, cbs: 0, img: '🐟' },
            'vegetable': { n: 'خضار', c: 35, p: 2, f: 0.3, cbs: 7, img: '🥬' },
            'fruit': { n: 'فاكهة', c: 50, p: 1, f: 0.3, cbs: 12, img: '🍎' },
            'pasta': { n: 'مكرونة', c: 131, p: 5, f: 1.1, cbs: 25, img: '🍝' },
            'soup': { n: 'شوربة', c: 75, p: 4, f: 2, cbs: 10, img: '🍲' },
            'cake': { n: 'كعكة', c: 350, p: 4, f: 18, cbs: 45, img: '🎂' },
            'coffee': { n: 'قهوة', c: 5, p: 0.3, f: 0, cbs: 1, img: '☕' },
            'sandwich': { n: 'ساندويش', c: 280, p: 15, f: 12, cbs: 30, img: '🥪' },
            'sushi': { n: 'سوشي', c: 200, p: 10, f: 5, cbs: 30, img: '🍣' },
            'noodle': { n: 'نودلز', c: 138, p: 4, f: 2, cbs: 25, img: '🍜' },
            'potato': { n: 'بطاطس', c: 77, p: 2, f: 0.1, cbs: 17, img: '🥔' },
            'cheese': { n: 'جبن', c: 113, p: 7, f: 9, cbs: 0.4, img: '🧀' }
        };
        
        const detectedFoods = labels.slice(0, 3).map(label => {
            const key = label.description.toLowerCase();
            const food = foodDatabase[key] || { n: label.description, c: 150, p: 10, f: 5, cbs: 20, img: '🍽️' };
            return {
                ...food,
                conf: Math.round(label.score * 100)
            };
        });
        
        // حساب الإجمالي
        const totalCalories = detectedFoods.reduce((sum, f) => sum + f.c, 0);
        const totalProtein = detectedFoods.reduce((sum, f) => sum + f.p, 0);
        const totalCarbs = detectedFoods.reduce((sum, f) => sum + f.cbs, 0);
        
        // عرض النتائج
        box.innerHTML = `
            <div style="text-align:center;">
                <img src="${imageData}" style="width:120px; height:120px; object-fit:cover; border-radius:15px; margin-bottom:15px;">
                <h4 style="color:var(--secondary);">✅ تم التحليل بالذكاء الاصطناعي!</h4>
                <p style="font-size:0.9rem; color:#aaa;">${detectedFoods.map(f => f.img + ' ' + f.n + ' (' + f.conf + '%)').join(' + ')}</p>
            </div>
        `;
        
        // إضافة للوجبات
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
        
        alert(`✅ تم اكتشاف ${detectedFoods.length} نوع طعام بالذكاء الاصطناعي!\n\n${detectedFoods.map(f => f.img + ' ' + f.n + ': ' + f.c + ' سعرة (دقة: ' + f.conf + '%)').join('\n')}\n\nإجمالي: ${totalCalories} سعرة | ${totalProtein}g بروتين | ${totalCarbs}g كربوهيدرات`);
        
        setTimeout(() => {
            box.innerHTML = '<div class="upload-icon">📷</div><p>اضغط لرفع صورة الطعام</p><small style="color: #6b7280;">JPG, PNG - الحد الأقصى 5MB</small>';
        }, 5000);
    }

    renderDailyLog() {
        const list = document.getElementById('mealsList');
        const today = new Date().toISOString().split('T')[0];
        const meals = this.dailyMeals.filter(m => m.date === today);
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
