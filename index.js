const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkYRT1NhuUGYKDVNF4bgXaSQIXZwudCUMeXw3wF0siX_AXq4r3cgz9CEslzy_Or8nw/exec";

app.get('/', async (req, res) => {
    try {
        const response = await axios.get(GOOGLE_SCRIPT_URL, {
            params: {
                action: "search",
                query: req.query.query || ""
            }
        });

        // קבלת הטקסט מגוגל
        let googleResponse = response.data.toString().trim();

        // הסרת "read=t-" אם גוגל כבר הוסיף אותו בטעות, כדי שלא תהיה כפילות
        googleResponse = googleResponse.replace(/^read=t-/, "");

        // בניית התשובה בפורמט id_list_message כפי שביקשת
        // אנחנו מוסיפים t- אחרי כל & כדי שכל חלק ברשימה יוקרא כטקסט
        let finalResponse = "id_list_message=t-" + googleResponse.replace(/&/g, "&t-");

        // שליחה לימות המשיח כטקסט פשוט
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(finalResponse);

    } catch (error) {
        console.error("Error:", error.message);
        res.send("id_list_message=t-חלה שגיאה בחיבור למאגר הנתונים");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
