// --- 1. Úprava v endpointu /reserve ---
// Místo náhodného řetězce vygenerujeme 4-místné číslo
const token = Math.floor(1000 + Math.random() * 9000).toString(); 

// Zbytek insertu zůstává stejný, ale ujistíme se, že status je active
const { error: insertError } = await supabase
    .from('reservations')
    .insert([{ 
        name, 
        date, 
        time_from, 
        time_to, 
        secret_token: token, // Teď to bude např. "5284"
        status: 'active' 
    }]);

// --- 4. Úprava v endpointu /delete-own ---
app.post('/delete-own', async (req, res) => {
    let { token } = req.body;
    if (!token) return res.json({ success: false, message: "Chybí kód." });

    // Očistíme kód od mezer
    const cleanToken = token.toString().trim();

    const { data, error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('secret_token', cleanToken)
        .eq('status', 'active') // Rušíme jen ty, co jsou ještě aktivní
        .select();

    if (error || !data || data.length === 0) {
        return res.json({ success: false, message: "Neplatný kód! Ujistěte se, že zadáváte správné 4 číslice." });
    }

    res.json({ success: true });
});
