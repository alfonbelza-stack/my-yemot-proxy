const express = require('express');
const axios = require('axios');
const app = express();

// משיכת הקישור מהגדרות Render - זה שומר על הפרטיות ב-GitHub
const CSV_URL = process.env.SHEET_CSV_URL;

let cachedData = []; 

async function refreshData() {
    if (!CSV_URL) {
        console.error("Error: SHEET_CSV_URL is not defined in Render Environment Variables");
        return;
    }
    try {
        const response = await axios.get(CSV_URL);
        const rows = response.data.split('\n').map(row => {
            // פיצול לפי פסיקים תוך התעלמות מפסיקים בתוך מרכאות
            return row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/"/g, '').trim());
        });
        cachedData = rows.slice(1); 
    } catch (error) {
        console.error("Error fetching data:", error.message);
    }
}

// טעינה ראשונית ורענון כל 10 דקות
refreshData();
setInterval(refreshData, 10 * 60 * 1000);

app.get('/', (req, res) => {
    const query = (req.query.query || "").trim().toLowerCase();
    const action = (req.query.action || "total").trim().toLowerCase(); // הוספת אפשרות לסינון לפי סוג

    if (!query) return res.send("id_list_message=t-נא להקיש ערך לחיפוש&");

    const queryWords = query.split(/\s+/).filter(w => w.length > 0);

    const results = cachedData.filter(row => {
        let textToSearch = "";

        // הגדרת עמודות החיפוש לפי הפרמטר action שביקשת
        switch(action) {
            case 'name':
                textToSearch = `${row[0]} ${row[1]}`; // שם פרטי + משפחה
                break;
            case 'address':
                textToSearch = row[4] || ""; // כתובת (עמודה 5)
                break;
            case 'phone':
                textToSearch = `${row[5]} ${row[6]}`; // טלפונים (עמודות 6 ו-7)
                break;
            case 'total':
            default:
                textToSearch = row.join(' '); // חיפוש בכל העמודות
        }

        textToSearch = textToSearch.toLowerCase();
        // בדיקה שכל מילות החיפוש קיימות בטקסט (חיפוש לא מדויק)
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
