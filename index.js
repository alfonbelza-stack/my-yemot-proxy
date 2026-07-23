const express = require('express');
const axios = require('axios');
const app = express();

const SHEET_ID = "1aftoVF8eL2yXLITdXr2D3MKksZgJbBeXMPVgBgaxcZk";
const SHEET_NAME = encodeURIComponent("וחי אחיך ל HTML");
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;

let cachedData = []; 

async function refreshData() {
    try {
        const response = await axios.get(CSV_URL);
        const rows = response.data.split('\n').map(row => {
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });
        cachedData = rows.slice(1); 
        console.log(`הנתונים עודכנו: ${cachedData.length} שורות.`);
    } catch (error) {
        console.error("שגיאה במשיכת הנתונים:", error.message);
    }
}

refreshData();
setInterval(refreshData, 10 * 60 * 1000);

app.get('/', (req, res) => {
    const query = (req.query.query || "").trim().toLowerCase();
    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש");

    const queryWords = query.split(/\s+/).filter(w => w.length > 0);

    const results = cachedData.filter(row => {
        const rowText = row.join(' ').toLowerCase();
        return queryWords.every(word => rowText.includes(word));
    });

    if (results.length === 0) {
        return res.send("id_list_message=t-לא נמצאו תוצאות תואמות");
    }

    // מערך שיכיל את כל חלקי ההודעה
    let messages = [];
    
    // הודעת פתיחה
    messages.push(`t-נמצאו ${results.length} תוצאות`);

    // מעבר על כל התוצאות (ללא הגבלה)
    results.forEach((r, i) => {
        const title = r[0] || "";
        const name = r[1] || "";
        const son = r[2] || "";
        const law = r[3] || "";
        const address = r[4] || "";
        const mobile = r[5] || "";
        const home = r[6] || "";

        // בניית תוכן התוצאה
        let content = `תוצאה ${i+1} ${title} ${name} בן הרב ${son} חתן ${law} כתובת ${address} מספר טלפון נייד ${mobile} מספר טלפון בבית ${home}`;
        
        // ניקוי תווים מיוחדים שעלולים לשבש את הפורמט
        content = content.replace(/[&?=]/g, " ");
        
        messages.push(`t-${content}`);
    });

    // חיבור כל ההודעות עם & ביניהן
    const finalResponse = "id_list_message=" + messages.join("&");

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(finalResponse);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
