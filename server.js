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

app.post('/reserve', async (req, res) => {
  const { name, date, time_from, time_to } = req.body;

  const { data: existing } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', date)
    .or(`and(time_from.lte.${time_to},time_to.gte.${time_from})`);

  if (existing && existing.length > 0) {
    return res.json({ success: false, message: "Tento čas je už obsazený!" });
  }

  const { data, error } = await supabase
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


app.get('/reservations', async (req, res) => {
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

app.post('/reserve', async (req, res) => {
  const { name, date, time_from, time_to } = req.body;

  const { data: existing } = await supabase
    .from('reservations')
    .select('*')
    .eq('date', date)
    .or(`and(time_from.lte.${time_to},time_to.gte.${time_from})`);

  if (existing && existing.length > 0) {
    return res.json({ success: false, message: "Tento čas je už obsazený!" });
  }

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

app.post('/delete', async (req, res) => {
  const { id } = req.body;

  const { error } = await supabase
    .from('reservations')
    .delete()
    .eq('id', id);

  if (error) {
    return res.json({ success: false, error });
  }

  try {
    await client.messages.create({
      from: process.env.TWILIO_FROM,
      to: process.env.ADMIN_TO,
      body: `Rezervace byla zrušena (ID: ${id})`
    });
  } catch (err) {
    console.log("Chyba WhatsApp při zrušení:", err.message);
  }

  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server běží na portu ${PORT}`);
});
