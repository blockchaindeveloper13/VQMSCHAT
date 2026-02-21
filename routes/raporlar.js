const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. Günlük Rapor Listesi (Sınırsız)
router.get('/gunluk', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM gunluk_raporlar ORDER BY tarih DESC');
        res.json(rows); // Android'e JSON array olarak gider
    } catch (err) {
        res.status(500).json({ error: 'Günlük raporlar alınamadı' });
    }
});

// 2. Üretim Rapor Listesi (Sınırsız)
router.get('/uretim', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM uretim_raporlar ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Üretim raporları alınamadı' });
    }
});

// 3. Kalite Rapor Listesi (Niyazi'yi yakan paketleme fireleri - Sınırsız)
router.get('/kalite', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM kalite_raporlar ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Kalite raporları alınamadı' });
    }
});

// 4. Verimlilik Rapor Listesi (Sınırsız)
router.get('/verimlilik', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM verimlilik_raporlar ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Verimlilik raporları alınamadı' });
    }
});

module.exports = router;
