const express = require('express');
const axios = require('axios');
const app = express();
const CSV_URL = process.env.SHEET_CSV_URL;

// רשימת מספרי המערכת המורשים (ה-DID של המערכות שלך)
const ALLOWED_DIDS = {
    "0747095686": "מערכת קבוצה",
};

let cachedData = []; 

async function refreshData() {
    if (!CSV_URL) return;
    try {
        const response = await axios.get(CSV_URL);
        const rows = response.data.split('\n').map(row => {
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });
        cachedData = rows.slice(1); 
    } catch (error) {
        console.error("Error fetching data:", error.message);
    }
}

refreshData();
setInterval(refreshData, 10 * 60 * 1000);

app.get('/', (req, res) => {
    // שליפת מספר המערכת שממנו הגיעה השיחה
    const incomingDID = req.query.ApiDID;

    // בדיקה: האם מספר המערכת נמצא ברשימה הלבנה?
    if (!incomingDID || !ALLOWED_DIDS[incomingDID]) {
        console.warn(`Unauthorized access attempt from DID: ${incomingDID}`);
        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.send("id_list_message=t-המערכת נבנתה שלא כדין נא פנה למנהל המערכת&");
    }

    // אם המערכת מורשית, נמשיך לחיפוש
    console.log(`Access verified for system: ${ALLOWED_DIDS[incomingDID]} (${incomingDID})`);

    const query = (req.query.query || "").trim().toLowerCase();
    const action = (req.query.action || "total").trim().toLowerCase();

    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש&");

    const queryWords = query.split(/\s+/).filter(w => w.length > 0);

    const results = cachedData.filter(row => {
        let textToSearch = "";
        switch(action) {
            case 'name': textToSearch = `${row[0]} ${row[1]}`; break;
            case 'address': textToSearch = row[4] || ""; break;
            case 'father': textToSearch = row[2] || ""; break;
            case 'hotan': textToSearch = row[3] || ""; break;
            case 'phone': textToSearch = `${row[5]} ${row[6]}`; break;
            default: textToSearch = row.join(' ');
        }
        textToSearch = textToSearch.toLowerCase();
        return queryWords.every(word => textToSearch.includes(word));
    });

    if (results.length === 0) return res.send("id_list_message=t-לא נמצאו תוצאות&");

    let resultsCount = results.length;
    
    // פונקציה לניקוי תווים לא רצויים מהטקסט (כולל נקודה ומקף)
    const clean = (text) => (text || "").replace(/[&?=\.\-]/g, " ").trim();

    // בניית הודעת הפתיחה
    let introText = resultsCount > 10 ? `נמצאו ${resultsCount} תוצאות מושמעות רק הראשונות` : `נמצאו ${resultsCount} תוצאות`;
    let fullMessage = "t-" + introText + ".";

    const limit = Math.min(resultsCount, 10);
    for (let i = 0; i < limit; i++) {
        const r = results[i];
        
        // ניקוי כל השדות
        const fName = clean(r[0]);
        const lName = clean(r[1]);
        const father = clean(r[2]);
        const hotan = clean(r[3]);
        const addr = clean(r[4]);
        const mob = clean(r[5]);
        const home = clean(r[6]);
        
        const resultLine = `תוצאה ${i+1} ${fName} ${lName} בן הרב ${father} חתן ${hotan} כתובת ${addr} מספר טלפון נייד ${mob} מספר טלפון בבית ${home}`;
        
        // הוספת t- לפני כל תוצאה ונקודה בסוף
        fullMessage += "t-" + resultLine + ".";
    }

    // הוספת & בסוף כל המחרוזת
    fullMessage += "&";

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send("id_list_message=" + fullMessage);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
