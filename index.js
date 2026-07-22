const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// הלינק של ה-Google Apps Script שלך
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkYRT1NhuUGYKDVNF4bgXaSQIXZwudCUMeXw3wF0siX_AXq4r3cgz9CEslzy_Or8nw/exec";

app.get('/', async (req, res) => {
    try {
        // קבלת הערך שהמשתמש הקיש בטלפון
        const query = req.query.query || "";
        
        // פנייה לגוגל סקריפט עם הפרמטרים הנכונים לפי הלינק שלך
        const response = await axios.get(GOOGLE_SCRIPT_URL, {
            params: {
                action: "search", // הוספנו את זה לפי הלינק שלך
                query: query,
                callback: "none" 
            }
        });

        const data = response.data;
        let message = "";

        if (data.success && data.results && data.results.length > 0) {
            const totalFound = data.results.length;
            
            // בדיקה אם יש יותר מ-10 תוצאות
            if (totalFound > 10) {
                message = `נמצאו ${totalFound} תוצאות. המערכת תקריא רק את עשר התוצאות הראשונות. מומלץ לחפש באופן מדויק יותר. `;
            } else {
                message = `נמצאו ${totalFound} תוצאות. `;
            }

            // לקיחת 10 התוצאות הראשונות בלבד
            const resultsToRead = data.results.slice(0, 10);
            
            // בניית הטקסט להקראה
            resultsToRead.forEach((item, index) => {
                message += `תוצאה מספר ${index + 1}: שם: ${item.name}. כתובת: ${item.address}. טלפון: ${item.mobile || item.home}. `;
            });

        } else {
            message = "לא נמצאו נתונים תואמים לחיפוש שלך.";
        }

        // החזרת תשובה לימות המשיח
        res.send(`read=t-${message}`);

    } catch (error) {
        console.error("Error:", error.message);
        res.send("read=t-חלה שגיאה זמנית בחיבור למאגר הנתונים. נסו שוב מאוחר יותר.");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
