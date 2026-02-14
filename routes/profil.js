const express = require('express');
const router = express.Router();
const db = require('../config/db');

// =================================================
// 1. MEVCUT KODLARIN (Bunlar Profil Sayfası İçin)
// =================================================

// Profil Verilerini Getir (GET)
router.get('/getir/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT id, full_name, role, username, bio, last_seen, created_at, profile_image, rozet FROM users WHERE id = ?', 
            [req.params.id]
        );
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Kullanıcı yok' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Profil Güncelle (POST)
router.post('/guncelle', async (req, res) => {
    const { userId, column, value } = req.body;

    // GÜVENLİK: İzin verilen sütunlar
    const allowedColumns = ['username', 'bio', 'password', 'profile_image', 'userBio']; 
    
    if (!allowedColumns.includes(column)) {
        return res.status(400).json({ error: 'Geçersiz işlem!' });
    }

    try {
        const sql = `UPDATE users SET ${column} = ? WHERE id = ?`;
        await db.execute(sql, [value, userId]);
        res.json({ status: 'success', message: 'Güncellendi' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Güncelleme hatası' });
    }
});


// =================================================
// 2. YENİ EKLENEN KISIM (Sohbet Listesi İçin)
// =================================================

// Kullanıcıları Listele (Son Mesaj ve Okunmadı Sayısı ile)
router.post('/listele', async (req, res) => {
    const { user_id } = req.body; // Bunu isteyen kişi (Sen)

    if (!user_id) return res.status(400).json({ error: "User ID gerekli" });

    try {
        // Bu sorgu biraz karışık görünebilir ama yaptığı iş şu:
        // Her kullanıcıyı getirirken, seninle olan son mesajını ve okunmamış mesaj sayısını da bulup getiriyor.
        const query = `
            SELECT 
                u.id, 
                u.full_name, 
                u.profile_image, 
                u.role,
                u.rozet,
                u.bio,
                u.last_seen,
                
                -- Son Mesajı Bul
                (SELECT mesaj FROM mesajlar 
                 WHERE (gonderen_id = u.id AND alici_id = ?) OR (gonderen_id = ? AND alici_id = u.id) 
                 ORDER BY tarih DESC LIMIT 1) as last_message,
                 
                -- Son Mesajın Tarihini Bul
                (SELECT tarih FROM mesajlar 
                 WHERE (gonderen_id = u.id AND alici_id = ?) OR (gonderen_id = ? AND alici_id = u.id) 
                 ORDER BY tarih DESC LIMIT 1) as last_time,

                -- Okunmamış Mesaj Sayısını Bul (Sana gelenler)
                (SELECT COUNT(*) FROM mesajlar 
                 WHERE gonderen_id = u.id AND alici_id = ? AND okundu = 0) as unread_count

            FROM users u
            WHERE u.id != ?  -- Kendini listede görme
        `;

        // Soru işaretlerinin yerine user_id koyuyoruz
        const [rows] = await db.execute(query, [user_id, user_id, user_id, user_id, user_id, user_id]);
        
        res.json(rows);

    } catch (error) {
        console.error("Listeleme hatası:", error);
        res.status(500).json({ error: "Sunucu hatası" });
    }
});

module.exports = router;
