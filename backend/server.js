require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const pdf = require('html-pdf-node'); 

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// 🔗 Conexión a MySQL
let db;
async function connectDB() {
  try {
    db = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    console.log('✅ Conectado a MySQL');
  } catch (err) {
    console.error('❌ Error conectando a MySQL:', err.message);
    process.exit(1);
  }
}


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 📩 Endpoint de suscripción
app.post('/subscribe', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'El email es obligatorio' });

  try {
    const [exists] = await db.query('SELECT id FROM subscribers WHERE email = ?', [email]);
    if (exists.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    await db.query('INSERT INTO subscribers (email) VALUES (?)', [email]);

    //  Ruta al HTML de la guía
    const guiaPath = path.join(__dirname, '../frontend/guia-express.html');
    const guiaHTML = fs.readFileSync(guiaPath, 'utf8');

    //  Generar el PDF temporalmente
    const pdfOptions = { format: 'A4', printBackground: true };
    const pdfBuffer = await pdf.generatePdf({ content: guiaHTML }, pdfOptions);

    //  correo con el PDF adjunto
    await transporter.sendMail({
      from: `"Granada24/7" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎁 Tu Guía Express de Granada — Granada24/7',
      html: `
        <div style="font-family: Arial, sans-serif; color: #444;">
          <h2>¡Gracias por suscribirte a Granada24/7! 🇪🇸</h2>
          <p>Te damos la bienvenida a nuestra comunidad de viajeros curiosos.</p>
          <p>Descargá tu <strong>Guía Express de Granada</strong> haciendo clic en el botón de abajo 👇</p>
          <a style="display:inline-block;margin-top:15px;padding:10px 20px;background:#facc15;color:#222;border-radius:8px;text-decoration:none;font-weight:bold;"
            href="cid:guiaexpress.pdf">Descargar Guía</a>
          <p style="margin-top:20px;font-size:12px;color:#888;">© Granada24/7 | info@granada247.com</p>
        </div>
      `,
      attachments: [
        {
          filename: 'Guia-Express-Granada.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
          cid: 'guiaexpress.pdf'
        },
      ],
    });

    console.log(`✅ Guía enviada a ${email}`);
    res.json({ message: 'Suscripción exitosa. Guía enviada por correo.' });

  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ error: 'Error al procesar la suscripción o envío de correo.' });
  }
});

//  Levantar servidor
app.listen(PORT, async () => {
  await connectDB();
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
