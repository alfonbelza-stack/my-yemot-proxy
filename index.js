const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// הלינק של ה-Google Apps Script שלך
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkYRT1NhuUGYKDVNF4bgXaSQIXZwudCUMeXw3wF0siX_AXq4r3cgz9CEslzy_Or8nw/exec";

app.get('/', async (req, res) => {
    try {
        // העברת כל הפרמטרים שמגיעים מימות המשיח ישירות לגוגל
        const response = await axios.get(GOOGLE_SCRIPT_URL, {
            params: {
                action: "search",
                query: req.query.query || "",
                // אנחנו לא שולחים html=yes כדי שהסקריפט ידע שזה לימות המשיח
            }
        });

        // החזרת התשובה מגוגל (שהיא כבר בפורמט read=t-...) ישירות לימות המשיח
        res.send(response.data);

    } catch (error) {
        console.error("Error:", error.message);
        res.send("read=t-חלה שגיאה בחיבור למאגר.");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
