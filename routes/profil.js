const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. Profil Verilerini Getir (GET)
router.get('/getir/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, full_name, role, username, bio, last_seen, created_at, profile_image, rozet FROM users WHERE id = ?', 
            [req.params.id]
        );
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Kullanıcı yok' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// 2. Profil Güncelle (POST) - Şifre, Bio, Foto vs.
router.post('/guncelle', async (req, res) => {
    const { userId, column, value } = req.body;

    // GÜVENLİK: Sadece izin verilen sütunları değiştirebilsinler (SQL Injection Önlemi)
    const allowedColumns = ['username', 'userBio', 'password', 'profile_image'];
    
    // Veritabanındaki sütun adların farklı olabilir, burayı eşleştirelim:
    // Android'den gelen 'bio' -> Veritabanında 'userBio' ise ona göre düzelt.
    // Senin Android koduna göre sütun adları: 'username', 'bio', 'password', 'profile_image'
    
    if (!allowedColumns.includes(column)) {
        return res.status(400).json({ error: 'Geçersiz işlem!' });
    }

    try {
        // Dinamik SQL sorgusu
        const sql = `UPDATE users SET ${column} = ? WHERE id = ?`;
        await db.query(sql, [value, userId]);
        res.json({ status: 'success', message: 'Güncellendi' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Güncelleme hatası' });
    }
});

module.exports = router;
