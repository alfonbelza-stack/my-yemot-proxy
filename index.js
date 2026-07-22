const express = require('express');
const axios = require('axios');
const app = express();

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwkYRT1NhuUGYKDVNF4bgXaSQIXZwudCUMeXw3wF0siX_AXq4r3cgz9CEslzy_Or8nw/exec";
let cachedData = []; // כאן נשמור את כל המאגר בזיכרון

// פונקציה למשיכת הנתונים מגוגל לזיכרון של השרת
async function refreshCache() {
    try {
        console.log("מושך נתונים מגוגל...");
        const response = await axios.get(GOOGLE_SCRIPT_URL + "?action=search&query=---"); // חיפוש ריק שמחזיר הכל
        if (response.data && response.data.results) {
            cachedData = response.data.results;
            console.log(`המאגר עודכן: ${cachedData.length} רשומות.`);
        }
    } catch (error) {
        console.error("שגיאה בעדכון המאגר:", error.message);
    }
}

// עדכון המאגר מיד עם הפעלת השרת וכל 15 דקות
refreshCache();
setInterval(refreshCache, 15 * 60 * 1000);

app.get('/', (req, res) => {
    const query = (req.query.query || "").trim().toLowerCase();
    
    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש");

    // חיפוש מהיר בתוך הזיכרון של השרת (ללא פנייה לגוגל!)
    const results = cachedData.filter(item => {
        const searchStr = `${item.name} ${item.son} ${item.law} ${item.address} ${item.mobile} ${item.home}`.toLowerCase();
        return searchStr.includes(query);
    });

    if (results.length === 0) {
        return res.send("id_list_message=t-לא נמצאו תוצאות");
    }

    // בניית התשובה (עד 10 תוצאות)
    let msg = results.length > 10 ? `נמצאו ${results.length} תוצאות. המערכת מקריאה עד 10 תוצאות. ` : `נמצאו ${results.length} תוצאות. `;
    const limit = Math.min(results.length, 10);
    
    for (let i = 0; i < limit; i++) {
        const r = results[i];
        msg += `&t-תוצאה ${i+1}: ${r.name}. כתובת: ${r.address}. טלפון: ${r.mobile || r.home}. `;
    }

    res.send("id_list_message=t-" + msg);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running`));
