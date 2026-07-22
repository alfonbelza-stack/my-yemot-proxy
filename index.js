const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkYRT1NhuUGYKDVNF4bgXaSQIXZwudCUMeXw3wF0siX_AXq4r3cgz9CEslzy_Or8nw/exec";

app.get('/', async (req, res) => {
    // 1. שליחת פקודת "המתנה" מיידית לימות המשיח כדי שלא יתנתקו
    // t-אנא המתן בזמן שאנו מחפשים במאגר (ניתן לשנות למוזיקה אם רוצים)
    res.write("say_waiting_message=t-אנא המתן בזמן שאנו מחפשים במאגר&");

    try {
        // 2. פנייה לגוגל סקריפט (זה החלק שלוקח זמן)
        const response = await axios.get(GOOGLE_SCRIPT_URL, {
            params: {
                action: "search",
                query: req.query.query || ""
            },
            timeout: 30000 // מחכה עד 30 שניות לתגובה מגוגל
        });

        let googleResponse = response.data.toString().trim();
        googleResponse = googleResponse.replace(/^read=t-/, "");

        // 3. בניית התשובה הסופית
        let finalResponse = "id_list_message=t-" + googleResponse.replace(/&/g, "&t-");

        // שליחת התשובה הסופית וסגירת החיבור
        res.write(finalResponse);
        res.end();

    } catch (error) {
        console.error("Error:", error.message);
        res.write("id_list_message=t-חלה שגיאה בחיבור למאגר הנתונים או שהחיפוש ארך זמן רב מדי");
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
