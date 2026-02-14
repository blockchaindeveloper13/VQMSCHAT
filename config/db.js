const mysql = require('mysql2');

// Bağlantı Havuzu (Pool) - Kopmaları önler
const pool = mysql.createPool({
    host: process.env.DB_HOST,      // Heroku'dan gelecek
    user: process.env.DB_USER,      // Heroku'dan gelecek
    password: process.env.DB_PASSWORD, // Heroku'dan gelecek
    database: process.env.DB_NAME,  // Heroku'dan gelecek
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Bağlantıyı Test Et
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Veritabanı Bağlantı HATASI:', err.message);
    } else {
        console.log('Hostinger Veritabanına BAŞARIYLA Bağlandı!');
        connection.release();
    }
});

module.exports = pool.promise();
