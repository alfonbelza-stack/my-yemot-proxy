const express = require('express');
const axios = require('axios');
const app = express();

// משיכת הקישור אך ורק ממשתני הסביבה של Render
// אם המשתנה לא מוגדר, השרת לא ינסה להתחבר לקישור ברירת מחדל
const CSV_URL = process.env.SHEET_CSV_URL;

let cachedData = []; 

async function refreshData() {
    if (!CSV_URL) {
        console.error("CRITICAL ERROR: SHEET_CSV_URL is not defined in Render Environment Variables.");
        return;
    }
    try {
        const response = await axios.get(CSV_URL);
        const rows = response.data.split('\n').map(row => {
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });
        cachedData = rows.slice(1); 
        console.log(`Data successfully loaded. Total rows: ${cachedData.length}`);
    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error.message);
    }
}

// הפעלת טעינה ראשונית ורענון כל 10 דקות
refreshData();
setInterval(refreshData, 10 * 60 * 1000);

app.get('/', (req, res) => {
    const query = (req.query.query || "").trim().toLowerCase();
    const action = (req.query.action || "total").trim().toLowerCase();

    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש&");
    if (cachedData.length === 0) return res.send("id_list_message=t-שגיאה בטעינת הנתונים מהשרת&");

    const queryWords = query.split(/\s+/).filter(w => w.length > 0);

    const results = cachedData.filter(row => {
        let textToSearch = "";

        // הגדרת עמודות החיפוש לפי הפרמטר action
        switch(action) {
            case 'name':
                textToSearch = row[1] || ""; // עמודות שם פרטי ומשפחה
                break;
            case 'father':
                textToSearch = row[2] || ""; // עמודה 3 - שם האב
                break;
            case 'hotan':
                textToSearch = row[3] || ""; // עמודה 4 - שם החותן
                break;
            case 'address':
                textToSearch = row[4] || ""; // עמודת כתובת
                break;
            case 'phone':
                textToSearch = `${row[5]} ${row[6]}`; // עמודות טלפון
                break;
            case 'total':
            default:
                textToSearch = row.join(' '); // חיפוש בכל הגיליון
        }

        textToSearch = textToSearch.toLowerCase();
        return queryWords.every(word => textToSearch.includes(word));
    });

    if (results.length === 0) return res.send("id_list_message=t-לא נמצאו תוצאות&");

    let fullMessage = `נמצאו ${results.length} תוצאות `;
    const limit = Math.min(results.length, 15);

    for (let i = 0; i < limit; i++) {
        const r = results[i];
        const content = `תוצאה מספר ${i+1} ${r[0]} ${r[1]} בן הרב ${r[2]} חתן ${r[3]} כתובת ${r[4]} מספר טלפון נייד ${r[5]} מספר טלפון בבית ${r[6]} `;
        fullMessage += content;
    }

    const cleanMsg = fullMessage.replace(/[&?=]/g, " ");
    const finalResponse = "id_list_message=t-" + cleanMsg + "&";
    
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(finalResponse);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running`));
