const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Profil Verilerini Getir
// Android İsteği: GET /api/profil/getir/1
router.get('/getir/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, full_name, profile_image, role, rozet, bio, son_gorulme FROM users WHERE id = ?', 
            [req.params.id]
        );
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Veritabanı hatası' });
    }
});

module.exports = router;

