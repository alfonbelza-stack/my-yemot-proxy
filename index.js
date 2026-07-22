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
            // פירוק שורת ה-CSV לעמודות תוך טיפול במירכאות ופסיקים
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });
        
        // הסרת שורת הכותרת ושמירה בזיכרון
        cachedData = rows.slice(1); 
        console.log(`הנתונים עודכנו: ${cachedData.length} שורות נלמדו.`);
    } catch (error) {
        console.error("שגיאה במשיכת הנתונים:", error.message);
    }
}

// עדכון ראשוני וכל 10 דקות (כדי להישאר מעודכן בשינויים בגיליון)
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
        return res.send("id_list_message=t-לא נמצאו תוצאות תואמות לחיפוש שלך");
    }

    // בניית התשובה לימות המשיח (עד 10 תוצאות)
    let msg = results.length > 10 ? `נמצאו ${results.length} תוצאות. המערכת מקריאה את עשר הראשונות. ` : `נמצאו ${results.length} תוצאות. `;
    const limit = Math.min(results.length, 10);
    
    for (let i = 0; i < limit; i++) {
        const r = results[i];
        
        // מיפוי עמודות: A=0(תואר), B=1(שם), C=2(בן), D=3(חתן), E=4(כתובת), F=5(נייד), G=6(בית)
        const title = r[0] || "";
        const name = r[1] || "";
        const son = r[2] || "";
        const law = r[3] || "";
        const address = r[4] || "";
        const mobile = r[5] || "";
        const home = r[6] || "";

        // בניית נוסח ההקראה המדויק שביקשת
        msg += `&t-תוצאה ${i+1}. ${title} ${name}. בן הרב ${son}. חתן ${law}. כתובת ${address}. מספר טלפון נייד ${mobile}. מספר טלפון בבית ${home}. `;
    }

    // הגדרת סוג התוכן ושליחת התשובה המהירה
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send("id_list_message=t-" + msg);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running and listening on port ${PORT}`));
