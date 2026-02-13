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
console.log("TWILIO FROM:", process.env.TWILIO_FROM);

// --- 1. VYTVOŘENÍ REZERVACE ---
app.post('/reserve', async (req, res) => {
    const { name, date, time_from, time_to } = req.body;

    // Kontrola překryvu času (logika: začátek < nový_konec AND konec > nový_začátek)
    const { data: existing, error: searchError } = await supabase
        .from('reservations')
        .select('*')
        .eq('date', date)
        .filter('time_from', 'lt', time_to)
        .filter('time_to', 'gt', time_from);

    if (existing && existing.length > 0) {
        return res.json({ success: false, message: "Tento čas je už obsazený!" });
    }

    const token = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { error: insertError } = await supabase
        .from('reservations')
        .insert([{ name, date, time_from, time_to, secret_token: token }]);

    if (insertError) {
        return res.json({ success: false, error: insertError.message });
    }

    // WhatsApp oznámení
    try {
        await client.messages.create({
            from: process.env.TWILIO_FROM, // např. 'whatsapp:+14155238886'
            to: process.env.ADMIN_TO,     // např. 'whatsapp:+420123456789'
            body: `✅ Nová rezervace: ${name}\n📅 ${date}\n⏰ ${time_from} - ${time_to}\n🔑 Kód: ${token}`
        });
    } catch (err) {
        console.log("Twilio Error:", err.message);
    }

    res.json({ success: true, token: token });
});

// --- 2. ZÍSKÁNÍ REZERVACÍ ---
app.get('/reservations', async (req, res) => {
    const { date } = req.query; // Filtrování podle data z frontendu
    let query = supabase.from('reservations').select('*');
    
    if (date) {
        query = query.eq('date', date);
    }

    const { data, error } = await query.order('time_from', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- 3. MAZÁNÍ ADMINEM (přes ID a heslo) ---
app.post('/delete', async (req, res) => {
    const { id, adminPassword } = req.body;

    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
        console.log("Nepodařený pokus o admin smazání! Zadáno:", adminPassword);
        return res.status(401).json({ success: false, message: "Špatné heslo!" });
    }

    const { error } = await supabase.from('reservations').delete().eq('id', id);

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});;

// --- 4. MAZÁNÍ UŽIVATELEM (přes tajný kód/token) ---
app.post('/delete-own', async (req, res) => {
    const { token } = req.body;

    if (!token) return res.json({ success: false, message: "Chybí kód." });

    const { error, data } = await supabase
        .from('reservations')
        .delete()
        .eq('secret_token', token)
        .select(); // .select() zajistí, že poznáme, jestli se něco smazalo

    if (error) return res.json({ success: false, error: error.message });
    
    if (data.length === 0) {
        return res.json({ success: false, message: "Neplatný kód!" });
    }

    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server běží na portu ${PORT}`));
