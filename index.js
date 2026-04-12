const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;

// ตั้งค่า Supabase Client
const supabaseUrl = 'https://rrkuvmgwkgfwsdhwvrve.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJya3V2bWd3a2dmd3NkaHd2cnZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NzI4NzEsImV4cCI6MjA5MTU0ODg3MX0.RaTtdu4FW8D-J2yQWfx6x652zk8ShfK4o7EOiHkEu68';
const supabase = createClient(supabaseUrl, supabaseKey);

// ตั้งค่า Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Middleware สำหรับตรวจสอบการ login
const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// --- Routing ---

// หน้า Login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data, error } = await supabase
            .from('account')
            .select('*')
            .eq('username', username)
            .eq('password', password);
        if (error) throw error;
        if (data && data.length > 0) {
            req.session.user = data[0].username;
            res.redirect('/');
        } else {
            res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' });
    }
});

// หน้าหลัก (ตาราง question)
app.get('/', requireLogin, async (req, res) => {
    try {
        const { data: types, error: typeError } = await supabase
            .from('question')
            .select('type')
            .order('type', { ascending: true });
        if (typeError) throw typeError;
        const uniqueTypes = [...new Set(types.map(t => t.type))].map(type => ({ type }));
        const { data: questions, error: questionError } = await supabase
            .from('question')
            .select('type, question, answer')
            .order('type', { ascending: true })
            .order('question', { ascending: true });
        if (questionError) throw questionError;
        res.render('dashboard', {
            username: req.session.user,
            types: uniqueTypes,
            questions: questions,
            selectedType: null,
            activeTab: 'question',
            youtubelinks: []
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถโหลดข้อมูลได้' });
    }
});

// แสดงตารางตาม type ที่เลือก (question)
app.post('/filter', requireLogin, async (req, res) => {
    const { type } = req.body;
    try {
        const { data: types, error: typeError } = await supabase
            .from('question')
            .select('type')
            .order('type', { ascending: true });
        if (typeError) throw typeError;
        const uniqueTypes = [...new Set(types.map(t => t.type))].map(type => ({ type }));
        let questions;
        if (type) {
            const { data, error } = await supabase
                .from('question')
                .select('type, question, answer')
                .eq('type', type)
                .order('question', { ascending: true });
            if (error) throw error;
            questions = data;
        } else {
            const { data, error } = await supabase
                .from('question')
                .select('type, question, answer')
                .order('type', { ascending: true })
                .order('question', { ascending: true });
            if (error) throw error;
            questions = data;
        }
        res.render('dashboard', {
            username: req.session.user,
            types: uniqueTypes,
            questions: questions,
            selectedType: type,
            activeTab: 'question',
            youtubelinks: []
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถกรองข้อมูลได้' });
    }
});

// อัปเดตคำตอบ (question)
app.post('/update', requireLogin, async (req, res) => {
    const { question, answer, type } = req.body;
    try {
        const { error } = await supabase
            .from('question')
            .update({ answer })
            .eq('question', question)
            .eq('type', type);
        if (error) throw error;
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
});

// หน้า YouTube Links
app.get('/youtubelink', requireLogin, async (req, res) => {
    try {
        const { data: youtubelinks, error } = await supabase
            .from('youtubelink')
            .select('id, link')
            .order('id', { ascending: true });
        if (error) throw error;
        res.render('dashboard', {
            username: req.session.user,
            types: [],
            questions: [],
            selectedType: null,
            activeTab: 'youtubelink',
            youtubelinks: youtubelinks
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถโหลดข้อมูลได้' });
    }
});

// สร้างลิงก์ YouTube
app.post('/youtubelink/create', requireLogin, async (req, res) => {
    const { link } = req.body;
    try {
        const { count, error: countError } = await supabase
            .from('youtubelink')
            .select('id', { count: 'exact', head: true });
        if (countError) throw countError;
        if (count >= 5) {
            return res.redirect('/youtubelink');
        }
        const { error } = await supabase
            .from('youtubelink')
            .insert([{ link }]);
        if (error) throw error;
        res.redirect('/youtubelink');
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถเพิ่มลิงก์ได้' });
    }
});

// อัปเดตลิงก์ YouTube
app.post('/youtubelink/update/:id', requireLogin, async (req, res) => {
    const { id } = req.params;
    const { link } = req.body;
    try {
        const { error } = await supabase
            .from('youtubelink')
            .update({ link })
            .eq('id', id);
        if (error) throw error;
        res.redirect('/youtubelink');
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถอัปเดตลิงก์ได้' });
    }
});

// ลบลิงก์ YouTube
app.post('/youtubelink/delete/:id', requireLogin, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('youtubelink')
            .delete()
            .eq('id', id);
        if (error) throw error;
        res.redirect('/youtubelink');
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถลบลิงก์ได้' });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// เริ่มต้น Server
app.listen(port, () => {
    console.log(`Server กำลังทำงานที่ http://localhost:${port}`);
});