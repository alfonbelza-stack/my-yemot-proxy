const express = require('express');
const axios = require('axios');
const app = express();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkYRT1NhuUGYKDVNF4bgXaSQIXZwudCUMeXw3wF0siX_AXq4r3cgz9CEslzy_Or8nw/exec";

app.get('/', async (req, res) => {
    const query = req.query.query || "";
    
    // אם אין שאילתה, נחזיר הודעה ריקה מיד
    if (!query) {
        return res.send("id_list_message=t-נא להקיש ערך לחיפוש");
    }

    try {
        // פנייה ישירה לגוגל עם טיימאאוט גבוה
        const response = await axios.get(GOOGLE_SCRIPT_URL, {
            params: { action: "search", query: query },
            timeout: 50000 
        });

        let data = response.data.toString();
        
        // ניקוי כל מה שלא טקסט (חשוב מאוד לימות המשיח)
        data = data.replace(/read=t-/g, "").trim();
        
        // בניית התשובה בפורמט id_list_message
        // הוספת t- אחרי כל & כדי שיקריא הכל כטקסט
        const finalResponse = "id_list_message=t-" + data.split('&').join('&t-');

        // שליחה נקייה ללא שום כותרות מיותרות
        res.send(finalResponse);

    } catch (error) {
        res.send("id_list_message=t-חלה שגיאה בחיבור למאגר הנתונים");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
