// --- 3. MAZÁNÍ ADMINEM (Změna na historii) ---
app.post('/delete', async (req, res) => {
    const { id, adminPassword } = req.body;
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Špatné heslo!" });
    }

    // Místo .delete() použijeme .update()
    const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', id);

    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true });
});

// --- 4. MAZÁNÍ UŽIVATELEM (Změna na historii) ---
app.post('/delete-own', async (req, res) => {
    let { token } = req.body;
    if (!token) return res.json({ success: false, message: "Chybí kód." });

    token = token.trim();

    // Místo .delete() použijeme .update()
    const { data, error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('secret_token', token)
        .select();

    if (error || !data || data.length === 0) {
        return res.json({ success: false, message: "Neplatný kód nebo chyba." });
    }

    res.json({ success: true });
});
