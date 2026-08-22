const express = require('express');
const axios = require('axios');
const app = express();
const CSV_URL = process.env.SHEET_CSV_URL;

// רשימת מספרי המערכת המורשים (ה-DID של המערכות שלך)
const ALLOWED_DIDS = {
    "0747095686": "מערכת קבוצה"
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

// פונקציה לניקוי טקסט כללי (הסרת תווים שמשבשים פורמט)
const clean = (text) => (text || "").replace(/[&?=\.\-]/g, " ").trim();

// פונקציה לניקוי מספר טלפון (משאירה רק ספרות עבור f-)
const cleanPhone = (text) => (text || "").replace(/\D/g, "");

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
    
    // הודעת פתיחה
    let introText = resultsCount > 10 ? `נמצאו ${resultsCount} תוצאות מושמעות עשר הראשונות` : `נמצאו ${resultsCount} תוצאות`;
    let fullMessage = "t-" + introText + ".";

    const limit = Math.min(resultsCount, 10);
    for (let i = 0; i < limit; i++) {
        const r = results[i];
        
        const fName = clean(r[0]);
        const lName = clean(r[1]);
        const father = clean(r[2]);
        const hotan = clean(r[3]);
        const addr = clean(r[4]);
        
        // ניקוי מספרי הטלפון לספרות בלבד
        const mob = cleanPhone(r[5]);
        const home = cleanPhone(r[6]);
        
        // בניית התוצאה עם הפרדה ל-t עבור טקסט ו-f עבור מספר טלפון
        // כל חלק מסתיים בנקודה (.) כדי להפריד בין ההודעות בשרשור
        let resultLine = `t-תוצאה ${i+1} ${fName} ${lName} בן הרב ${father} חתן ${hotan} כתובת ${addr} מספר טלפון נייד.`;
        resultLine += `d-${mob}.`;
        resultLine += `t-מספר טלפון בבית.`;
        resultLine += `d-${home}.`;
        
        fullMessage += resultLine;
    }

    // סיום המחרוזת ב-&
    fullMessage += "&";

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send("id_list_message=" + fullMessage);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
