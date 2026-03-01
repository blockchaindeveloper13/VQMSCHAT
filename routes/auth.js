const express = require('express');
const router = express.Router();
const crypto = require('crypto'); // MD5 şifreleme için gerekli Node.js modülü
const db = require('../config/db'); // Senin veritabanı bağlantı dosyan

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Kullanıcı adı ve şifre boş olamaz.' });
    }

    try {
        // PHP'deki md5($password) işleminin Node.js karşılığı
        const md5Password = crypto.createHash('md5').update(password).digest('hex');

        // Kullanıcıyı veritabanında ara
        const [rows] = await db.execute(
            'SELECT id, username, full_name, role, rozet, created_at, son_gorulme, profile_image, bio FROM users WHERE username = ? AND password = ? LIMIT 1',
            [username, md5Password]
        );

        if (rows.length > 0) {
            // Kullanıcı bulundu
            res.json({ 
                success: true, 
                user: rows[0] 
            });
        } else {
            // Kullanıcı yok veya şifre yanlış
            res.status(401).json({ success: false, message: 'Hatalı Kullanıcı Adı veya Şifre!' });
        }
    } catch (error) {
        console.error('Giriş Hatası:', error);
        res.status(500).json({ success: false, message: 'Sunucu/Veritabanı hatası oluştu.' });
    }
});

module.exports = router;
              
