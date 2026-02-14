const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Günlük Rapor Listesi
router.get('/gunluk', async (req, res) => {
    try {
        // Örnek sorgu - Kendi tablo adına göre düzenleriz
        const [rows] = await db.query('SELECT * FROM gunluk_raporlar ORDER BY tarih DESC LIMIT 30');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Raporlar alınamadı' });
    }
});

module.exports = router;
