/**
 * Gym Pro Backend - Express Server
 * Smart Trainer Pro - Full Stack Application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://ilopoevhgkgepumjsmid.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlsb3BvZXZoZ2tnZXB1bWpzbWlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1NjQ5NDAsImV4cCI6MjA4NDE0MDk0MH0.LnJN5o9MqSLodN1PXwRLIBuDWUiZ-9rGb1CLdz3fdt8';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});

// Serve uploaded files statically
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const { data: user, error } = await supabase
            .from('users')
            .insert([{
                email,
                password: hashedPassword,
                name: name || email.split('@')[0],
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        // Generate JWT token (simple version)
        const token = Buffer.from(JSON.stringify({ 
            userId: user.id, 
            email: user.email 
        })).toString('base64');

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = Buffer.from(JSON.stringify({ 
            userId: user.id, 
            email: user.email 
        })).toString('base64');

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, name, created_at')
            .eq('id', decoded.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Auth check error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Middleware to verify token
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        req.userId = decoded.userId;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// ============================================
// USER PROFILE ROUTES
// ============================================

// Get user profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { data: profile, error } = await supabase
            .from('profile')
            .select('*')
            .eq('user_id', req.userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        res.json(profile || {});
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Save/update profile
app.post('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { name, age, height, weight, targetCalories } = req.body;

        const profileData = {
            user_id: req.userId,
            name,
            age: parseInt(age),
            height: parseFloat(height),
            weight: parseFloat(weight),
            target_calories: parseInt(targetCalories) || 2000,
            updated_at: new Date().toISOString()
        };

        // Check if profile exists
        const { data: existing } = await supabase
            .from('profile')
            .select('id')
            .eq('user_id', req.userId)
            .single();

        let result;
        if (existing) {
            // Update
            result = await supabase
                .from('profile')
                .update(profileData)
                .eq('user_id', req.userId)
                .select()
                .single();
        } else {
            // Insert
            result = await supabase
                .from('profile')
                .insert([profileData])
                .select()
                .single();
        }

        if (result.error) throw result.error;
        res.json({ message: 'Profile saved', profile: result.data });
    } catch (error) {
        console.error('Save profile error:', error);
        res.status(500).json({ error: 'Failed to save profile' });
    }
});

// ============================================
// MEALS/FOOD ROUTES
// ============================================

// Get all meals for user
app.get('/api/meals', authenticateToken, async (req, res) => {
    try {
        const { date } = req.query;
        let query = supabase
            .from('meals')
            .select('*')
            .eq('user_id', req.userId);

        if (date) {
            query = query.eq('date', date);
        } else {
            // Get last 30 days by default
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
        }

        const { data: meals, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        res.json(meals || []);
    } catch (error) {
        console.error('Get meals error:', error);
        res.status(500).json({ error: 'Failed to get meals' });
    }
});

// Add meal manually
app.post('/api/meals', authenticateToken, async (req, res) => {
    try {
        const { name, calories, protein, carbs, fat, date } = req.body;

        if (!name || !calories) {
            return res.status(400).json({ error: 'Name and calories are required' });
        }

        const mealData = {
            user_id: req.userId,
            name,
            calories: parseInt(calories),
            protein: parseFloat(protein) || 0,
            carbs: parseFloat(carbs) || 0,
            fat: parseFloat(fat) || 0,
            date: date || new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };

        const { data: meal, error } = await supabase
            .from('meals')
            .insert([mealData])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Meal added', meal });
    } catch (error) {
        console.error('Add meal error:', error);
        res.status(500).json({ error: 'Failed to add meal' });
    }
});

// Delete meal
app.delete('/api/meals/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('meals')
            .delete()
            .eq('id', id)
            .eq('user_id', req.userId);

        if (error) throw error;
        res.json({ message: 'Meal deleted' });
    } catch (error) {
        console.error('Delete meal error:', error);
        res.status(500).json({ error: 'Failed to delete meal' });
    }
});

// ============================================
// WATER TRACKING ROUTES
// ============================================

// Get water data
app.get('/api/water', authenticateToken, async (req, res) => {
    try {
        const { data: water, error } = await supabase
            .from('water')
            .select('*')
            .eq('user_id', req.userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        res.json(water || { today: 0, target: 8, history: {} });
    } catch (error) {
        console.error('Get water error:', error);
        res.status(500).json({ error: 'Failed to get water data' });
    }
});

// Update water
app.post('/api/water', authenticateToken, async (req, res) => {
    try {
        const { today, target, history } = req.body;

        const waterData = {
            user_id: req.userId,
            today: parseInt(today) || 0,
            target: parseInt(target) || 8,
            history: history || {},
            date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
        };

        // Check if exists
        const { data: existing } = await supabase
            .from('water')
            .select('id')
            .eq('user_id', req.userId)
            .single();

        let result;
        if (existing) {
            result = await supabase
                .from('water')
                .update(waterData)
                .eq('user_id', req.userId)
                .select()
                .single();
        } else {
            result = await supabase
                .from('water')
                .insert([waterData])
                .select()
                .single();
        }

        if (result.error) throw result.error;
        res.json({ message: 'Water updated', water: result.data });
    } catch (error) {
        console.error('Update water error:', error);
        res.status(500).json({ error: 'Failed to update water' });
    }
});

// ============================================
// PROGRESS PHOTOS ROUTES
// ============================================

// Get photos
app.get('/api/photos', authenticateToken, async (req, res) => {
    try {
        const { data: photos, error } = await supabase
            .from('photos')
            .select('*')
            .eq('user_id', req.userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(photos || []);
    } catch (error) {
        console.error('Get photos error:', error);
        res.status(500).json({ error: 'Failed to get photos' });
    }
});

// Upload photo
app.post('/api/photos', authenticateToken, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No photo provided' });
        }

        const { type } = req.body;
        
        // Upload to Supabase Storage
        const fileName = `${req.userId}/${uuidv4()}.${req.file.originalname.split('.').pop()}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('progress-photos')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('progress-photos')
            .getPublicUrl(fileName);

        // Save to database
        const { data: photo, error } = await supabase
            .from('photos')
            .insert([{
                user_id: req.userId,
                image_url: publicUrl,
                type: type || 'front',
                date: new Date().toISOString().split('T')[0],
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Photo uploaded', photo });
    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// Delete photo
app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Get photo info first
        const { data: photo } = await supabase
            .from('photos')
            .select('image_url')
            .eq('id', id)
            .eq('user_id', req.userId)
            .single();

        if (photo) {
            // Extract file path from URL
            const filePath = photo.image_url.split('/storage/v1/object/public/')[1];
            if (filePath) {
                await supabase.storage
                    .from('progress-photos')
                    .remove([filePath]);
            }
        }

        const { error } = await supabase
            .from('photos')
            .delete()
            .eq('id', id)
            .eq('user_id', req.userId);

        if (error) throw error;
        res.json({ message: 'Photo deleted' });
    } catch (error) {
        console.error('Delete photo error:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// ============================================
// VITALS ROUTES
// ============================================

// Get vitals
app.get('/api/vitals', authenticateToken, async (req, res) => {
    try {
        const { data: vitals, error } = await supabase
            .from('vitals')
            .select('*')
            .eq('user_id', req.userId)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) throw error;
        res.json(vitals || []);
    } catch (error) {
        console.error('Get vitals error:', error);
        res.status(500).json({ error: 'Failed to get vitals' });
    }
});

// Save vitals
app.post('/api/vitals', authenticateToken, async (req, res) => {
    try {
        const { systolic, diastolic, heartRate, bloodSugar, cholesterol } = req.body;

        const vitalsData = {
            user_id: req.userId,
            systolic: parseInt(systolic),
            diastolic: parseInt(diastolic),
            heart_rate: parseInt(heartRate),
            blood_sugar: parseInt(bloodSugar),
            cholesterol: parseInt(cholesterol),
            created_at: new Date().toISOString()
        };

        const { data: vitals, error } = await supabase
            .from('vitals')
            .insert([vitalsData])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ message: 'Vitals saved', vitals });
    } catch (error) {
        console.error('Save vitals error:', error);
        res.status(500).json({ error: 'Failed to save vitals' });
    }
});

// ============================================
// AI FOOD ANALYSIS ROUTE
// ============================================

// Analyze food image
app.post('/api/analyze-food', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file && !req.body.image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const imageBase64 = req.body.image || req.file.buffer.toString('base64');
        const apiKey = process.env.GOOGLE_VISION_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        // Call Google Vision API
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: imageBase64 },
                    features: [{ type: 'LABEL_DETECTION', maxResults: 15 }],
                    imageContext: {
                        labelDetectionParams: { confidenceThreshold: 0.6 }
                    }
                }]
            })
        });

        const result = await response.json();

        if (!result.responses || !result.responses[0].labelAnnotations) {
            return res.status(400).json({ error: 'Could not analyze image' });
        }

        const labels = result.responses[0].labelAnnotations;

        // Food database for nutrition info
        const foodDatabase = {
            'chicken': { name: 'دجاج', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
            'rice': { name: 'أرز', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
            'salad': { name: 'سلطة', calories: 35, protein: 2, carbs: 7, fat: 0.3 },
            'pizza': { name: 'بيتزا', calories: 266, protein: 11, carbs: 33, fat: 10 },
            'burger': { name: 'همبرجر', calories: 295, protein: 17, carbs: 24, fat: 14 },
            'bread': { name: 'خبز', calories: 79, protein: 2.7, carbs: 15, fat: 1 },
            'egg': { name: 'بيض', calories: 78, protein: 6, carbs: 0.6, fat: 5 },
            'meat': { name: 'لحم', calories: 250, protein: 26, carbs: 0, fat: 15 },
            'fish': { name: 'سمك', calories: 136, protein: 26, carbs: 0, fat: 3 },
            'vegetable': { name: 'خضار', calories: 35, protein: 2, carbs: 7, fat: 0.3 },
            'fruit': { name: 'فاكهة', calories: 50, protein: 1, carbs: 12, fat: 0.3 },
            'pasta': { name: 'مكرونة', calories: 131, protein: 5, carbs: 25, fat: 1.1 },
            'soup': { name: 'شوربة', calories: 75, protein: 4, carbs: 10, fat: 2 },
            'cake': { name: 'كعكة', calories: 350, protein: 4, carbs: 45, fat: 18 },
            'coffee': { name: 'قهوة', calories: 5, protein: 0.3, carbs: 1, fat: 0 },
            'sandwich': { name: 'ساندويش', calories: 280, protein: 15, carbs: 30, fat: 12 },
            'sushi': { name: 'سوشي', calories: 200, protein: 10, carbs: 30, fat: 5 },
            'noodle': { name: 'نودلز', calories: 138, protein: 4, carbs: 25, fat: 2 },
            'potato': { name: 'بطاطس', calories: 77, protein: 2, carbs: 17, fat: 0.1 },
            'cheese': { name: 'جبن', calories: 113, protein: 7, carbs: 0.4, fat: 9 },
            'fries': { name: 'بطاطس مقلية', calories: 312, protein: 3, carbs: 41, fat: 15 },
            'ice cream': { name: 'آيسكريم', calories: 207, protein: 3, carbs: 24, fat: 11 },
            'banana': { name: 'موزة', calories: 89, protein: 1, carbs: 23, fat: 0.3 },
            'apple': { name: 'تفاحة', calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
            'orange': { name: 'برتقالة', calories: 47, protein: 1, carbs: 12, fat: 0.1 },
            'steak': { name: 'ستيك', calories: 271, protein: 26, carbs: 0, fat: 19 },
            'shrimp': { name: 'جمبري', calories: 99, protein: 24, carbs: 0, fat: 0.3 },
            'broccoli': { name: 'بروكلي', calories: 34, protein: 3, carbs: 7, fat: 0.4 },
            'carrot': { name: 'جزر', calories: 41, protein: 1, carbs: 10, fat: 0.2 },
            'tomato': { name: 'طماطم', calories: 18, protein: 1, carbs: 4, fat: 0.2 }
        };

        // Filter for food-related labels
        const foodKeywords = ['food', 'dish', 'meal', 'cuisine', 'chicken', 'rice', 'salad', 'pizza', 
            'burger', 'bread', 'egg', 'meat', 'fish', 'vegetable', 'fruit', 'pasta', 'soup', 'cake', 
            'coffee', 'drink', 'juice', 'sandwich', 'sushi', 'noodle', 'potato', 'cheese', 'fries',
            'ice cream', 'banana', 'apple', 'orange', 'steak', 'shrimp', 'broccoli', 'carrot', 'tomato',
            'lettuce', 'cucumber', 'onion', 'garlic', 'pepper', 'mushroom', 'avocado', 'grape', 'mango'];

        const detectedFoods = labels
            .filter(label => {
                const desc = label.description.toLowerCase();
                return foodKeywords.some(kw => desc.includes(kw));
            })
            .slice(0, 5)
            .map(label => {
                const key = label.description.toLowerCase();
                const food = foodDatabase[key] || { 
                    name: label.description, 
                    calories: 150, 
                    protein: 8, 
                    carbs: 20, 
                    fat: 5 
                };
                return {
                    ...food,
                    confidence: Math.round(label.score * 100)
                };
            });

        if (detectedFoods.length === 0) {
            // Use general labels if no food found
            labels.slice(0, 3).forEach(label => {
                detectedFoods.push({
                    name: label.description,
                    calories: 150,
                    protein: 8,
                    carbs: 20,
                    fat: 5,
                    confidence: Math.round(label.score * 100)
                });
            });
        }

        // Calculate totals
        const totals = {
            calories: detectedFoods.reduce((sum, f) => sum + f.calories, 0),
            protein: detectedFoods.reduce((sum, f) => sum + f.protein, 0),
            carbs: detectedFoods.reduce((sum, f) => sum + f.carbs, 0),
            fat: detectedFoods.reduce((sum, f) => sum + f.fat, 0)
        };

        res.json({
            foods: detectedFoods,
            totals,
            labels: labels.slice(0, 10).map(l => l.description)
        });
    } catch (error) {
        console.error('Analyze food error:', error);
        res.status(500).json({ error: 'Failed to analyze food' });
    }
});

// ============================================
// HEALTH TIPS ROUTE
// ============================================

app.get('/api/health-tips', (req, res) => {
    const tips = [
        "💧 اشرب 8 أكواب من الماء يومياً للحفاظ على ترطيب جسمك",
        "🥗 تناول الخضار والفواكه الغنية بالفيتامينات",
        "😴 احصل على 7-8 ساعات من النوم يومياً",
        "🏃‍♀️ مارس التمارين الرياضية بانتظام 30 دقيقة يومياً",
        "🥩 تناول البروتين بعد التمرين لبناء العضلات",
        "🍚 تجنب الطعام السريع والمقليات",
        "🧘 مارس تمارين التنفس للتخلص من التوتر",
        "🥛 اشرب الحليب للحصول على الكالسيوم",
        "🍎 تفاحة يومياً تبعدك عن الطبيب",
        "🚶 المشي بعد الأكل يساعد على الهضم"
    ];
    
    res.json({ 
        tip: tips[Math.floor(Math.random() * tips.length)],
        tips 
    });
});

// ============================================
// DASHBOARD STATS
// ============================================

app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get meals for today
        const { data: meals } = await supabase
            .from('meals')
            .select('calories, protein, carbs')
            .eq('user_id', req.userId)
            .eq('date', today);

        // Get water for today
        const { data: water } = await supabase
            .from('water')
            .select('today, target')
            .eq('user_id', req.userId)
            .single();

        // Get profile
        const { data: profile } = await supabase
            .from('profile')
            .select('target_calories')
            .eq('user_id', req.userId)
            .single();

        const stats = {
            calories: {
                today: meals?.reduce((sum, m) => sum + m.calories, 0) || 0,
                target: profile?.target_calories || 2000
            },
            protein: {
                today: meals?.reduce((sum, m) => sum + (m.protein || 0), 0) || 0
            },
            water: {
                today: water?.today || 0,
                target: water?.target || 8
            }
        };

        res.json(stats);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ============================================
// HEALTH CHECK & ERROR HANDLING
// ============================================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏋️ Gym Pro Backend running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}/api`);
});

module.exports = app;
