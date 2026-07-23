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
    } catch (error) {
        console.error("Error:", error.message);
    }
}

refreshData();
setInterval(refreshData, 10 * 60 * 1000);

app.get('/', (req, res) => {
    const query = (req.query.query || "").trim().toLowerCase();
    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש&");

    const queryWords = query.split(/\s+/).filter(w => w.length > 0);
    const results = cachedData.filter(row => {
        const rowText = row.join(' ').toLowerCase();
        return queryWords.every(word => rowText.includes(word));
    });

    if (results.length === 0) return res.send("id_list_message=t-לא נמצאו תוצאות&");

    // התחלת בניית המחרוזת בדיוק לפי הפורמט שלך
    let responseText = `נמצאו ${results.length} תוצאות`;

    const limit = Math.min(results.length, 10); 
    for (let i = 0; i < limit; i++) {
        const r = results[i];
        // הוספת המפריד .t- לפני כל תוצאה
        responseText += `.t-תוצאה מספר ${i+1} ${r[0]} ${r[1]} בן הרב ${r[2]} חתן ${r[3]} כתובת ${r[4]} מספר טלפון נייד ${r[5]} מספר טלפון בבית ${r[6]}`;
    }

    // הרכבת התשובה הסופית: התחלה ב-id_list_message=t-, המחרוזת שבנינו, ובסוף &
    const finalResponse = "id_list_message=t-" + responseText + "&";

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(finalResponse);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
