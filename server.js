require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_TOKEN
);

// 1. Endpoint pro vytvoření rezervace
app.post('/reserve', async (req, res) => {
  const { name, date, time_from, time_to } = req.body;

  // Kontrola duplicit
  const { data: existing } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', date)
    .or(`and(time_from.lte.${time_to},time_to.gte.${time_from})`);

  if (existing && existing.length > 0) {
    return res.json({ success: false, message: "Tento čas je už obsazený!" });
  }

  // Vložení do databáze
  const { error } = await supabase
    .from('reservations')
    .insert([
      {
        name,
        date,
        time_from,
        time_to,
        secret_token: Math.random().toString(36).substring(2, 10)
      }
    ]);

  if (error) {
    return res.json({ success: false, error });
  }

  // Odeslání WhatsApp zprávy
  try {
    await client.messages.create({
      from: process.env.TWILIO_FROM,
      to: process.env.ADMIN_TO,
      body: `Nová rezervace: ${name} ${date} ${time_from}-${time_to}`
    });
    console.log("WhatsApp zpráva odeslána");
  } catch (err) {
    console.log("CHYBA WHATSAPP:", err.message);
  }

  res.json({ success: true });
});

// 2. Endpoint pro získání všech rezervací
app.get('/reservations', async (req, res) => {
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// 3. Spuštění serveru
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});
