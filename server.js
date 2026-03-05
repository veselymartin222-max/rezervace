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

// --- 1. VYTVOŘENÍ REZERVACE ---
app.post('/reserve', async (req, res) => {
    const { name, date, time_from, time_to } = req.body;

    const { data: existing, error: searchError } = await supabase
        .from('reservations')
        .select('*')
        .eq('date', date)
        .eq('status', 'active') 
        .filter('time_from', 'lt', time_to)
        .filter('time_to', 'gt', time_from);

    if (existing && existing.length > 0) {
        return res.json({ success: false, message: "Tento čas je už obsazený!" });
    }

    // Generování 4-místného číselného kódu
    const token = Math.floor(1000 + Math.random() * 9000).toString();

    const { error: insertError } = await supabase
        .from('reservations')
        .insert([{ 
            name, 
            date, 
            time_from, 
            time_to, 
            secret_token: token,
            status: 'active' 
        }]);

    if (insertError) {
        return res.json({ success: false, error: insertError.message });
    }

    try {
        // Tady přidáme .trim() a kontrolu prefixu
        let recipient = process.env.ADMIN_TO.trim();
        if (!recipient.startsWith('whatsapp:')) {
            recipient = `whatsapp:${recipient}`;
        }

        let sender = process.env.TWILIO_FROM.trim();
        if (!sender.startsWith('whatsapp:')) {
            sender = `whatsapp:${sender}`;
        }

        await client.messages.create({
            from: sender,
            to: recipient,
            body: `✅ Nová rezervace: ${name}\n📅 ${date}\n⏰ ${time_from} - ${time_to}\n🔑 Kód pro zrušení: ${token}`
        });
        console.log("Hurá! Zpráva odeslána na:", recipient);
    } catch (err) {
        console.log("Twilio Error:", err.message);
    }

    res.json({ success: true, token: token });
});

// --- 2. ZÍSKÁNÍ REZERVACÍ ---
app.get('/reservations', async (req, res) => {
    const { date } = req.query;
    let query = supabase.from('reservations').select('*').eq('status', 'active');
    if (date) query = query.eq('date', date);

    const { data, error } = await query.order('time_from', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- 3. MAZÁNÍ ADMINEM ---
app.post('/delete', async (req, res) => {
    const { id, adminPassword } = req.body;
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Špatné heslo!" });
    }
    const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', id);

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

// --- 4. MAZÁNÍ UŽIVATELEM (4-místný kód) ---
app.post('/delete-own', async (req, res) => {
    let { token } = req.body;
    
    if (!token) {
        return res.json({ success: false, message: "Chybí kód." });
    }

    // Převedeme na řetězec a zbavíme se mezer i neviditelných znaků
    const cleanToken = String(token).trim();
    
    console.log(`POŽADAVEK NA MAZÁNÍ: Kód z webu: "${cleanToken}"`);

    // Provedeme update
    const { data, error, count } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('secret_token', cleanToken)
        .eq('status', 'active')
        .select(); // Vrátí změněné řádky

    if (error) {
        console.error("Chyba Supabase:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }

    console.log("Výsledek z databáze (změněno řádků):", data ? data.length : 0);

    if (!data || data.length === 0) {
        return res.json({ 
            success: false, 
            message: "Kód nebyl nalezen nebo je rezervace již zrušena. (Zadali jste: " + cleanToken + ")" 
        });
    }

    res.json({ success: true });
});

// --- 5. HISTORIE PRO ADMINA ---
app.post('/history', async (req, res) => {
    const { adminPassword } = req.body;
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Špatné heslo!" });
    }
    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('date', { ascending: false })
        .order('time_from', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, history: data });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server běží na portu ${PORT}`));
