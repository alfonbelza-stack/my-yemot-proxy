const express = require('express');
const axios = require('axios');
const app = express();

// הגדרות הגיליון שלך
const SHEET_ID = "1aftoVF8eL2yXLITdXr2D3MKksZgJbBeXMPVgBgaxcZk";
const SHEET_NAME = encodeURIComponent("וחי אחיך ל HTML");
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${SHEET_NAME}`;

let cachedData = []; // המאגר המקומי בזיכרון השרת

// פונקציה למשיכת הנתונים ישירות מהגיליון לזיכרון
async function refreshData() {
    try {
        const response = await axios.get(CSV_URL);
        const rows = response.data.split('\n').map(row => {
            // פירוק שורת ה-CSV לעמודות (טיפול במירכאות)
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });
        
        // הסרת שורת הכותרת ושמירה בזיכרון
        cachedData = rows.slice(1); 
        console.log(`הנתונים עודכנו: ${cachedData.length} שורות נלמדו.`);
    } catch (error) {
        console.error("שגיאה במשיכת הנתונים:", error.message);
    }
}

// עדכון ראשוני וכל 10 דקות
refreshData();
setInterval(refreshData, 10 * 60 * 1000);

app.get('/', (req, res) => {
    const query = (req.query.query || "").trim().toLowerCase();
    
    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש");

    // חיפוש מהיר בזיכרון השרת (לוקח מילי-שניות)
    const results = cachedData.filter(row => {
        // חיפוש בכל העמודות (A עד G)
        const rowText = row.join(' ').toLowerCase();
        return rowText.includes(query);
    });

    if (results.length === 0) {
        return res.send("id_list_message=t-לא נמצאו תוצאות");
    }

    // בניית התשובה לימות המשיח (עד 10 תוצאות)
    let msg = results.length > 10 ? `נמצאו ${results.length} תוצאות. המערכת מקריאה את עשר הראשונות. ` : `נמצאו ${results.length} תוצאות. `;
    const limit = Math.min(results.length, 10);
    
    for (let i = 0; i < limit; i++) {
        const r = results[i];
        // עמודות: A=0, B=1, C=2, D=3, E=4, F=5, G=6
        msg += `&t-תוצאה ${i+1}. שם. ${r[1]}. בן. ${r[2]}. כתובת. ${r[4]}. טלפון. ${r[5] || r[6]}. `;
    }

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send("id_list_message=t-" + msg);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running`));
