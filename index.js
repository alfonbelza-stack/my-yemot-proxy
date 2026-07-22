const express = require('express');
const axios = require('axios');
const app = express();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkYRT1NhuUGYKDVNF4bgXaSQIXZwudCUMeXw3wF0siX_AXq4r3cgz9CEslzy_Or8nw/exec";

app.get('/', async (req, res) => {
    // שליחת כותרת מיד כדי שימות המשיח ידעו שהשרת קיים
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const query = req.query.query || "";
    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש");

    try {
        const response = await axios.get(GOOGLE_SCRIPT_URL, {
            params: { action: "search", query: query },
            timeout: 50000 
        });

        let data = response.data.toString().trim();
        
        // ניקוי "read=t-" אם קיים והפיכה ל-id_list_message
        data = data.replace(/^read=t-/, "");
        
        // בניית התשובה
        const finalResponse = "id_list_message=t-" + data.split('&').join('&t-');
        
        res.send(finalResponse);

    } catch (error) {
        res.send("id_list_message=t-חלה שגיאה בחיבור למאגר הנתונים");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
