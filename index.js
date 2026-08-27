const express = require('express');
const axios = require('axios');

const app = express();

const CSV_URL = process.env.SHEET_CSV_URL;

// קישור CSV לגיליון נרשמים
const REGISTRANTS_CSV_URL = process.env.REGISTRANTS_CSV_URL;

// רשימת מספרי המערכת המורשים (ה-DID של המערכות שלך)
const ALLOWED_DIDS = {
    "0747095686": "מערכת קבוצה"
};

let cachedData = [];
let registrantsData = [];

/*
|--------------------------------------------------------------------------
| פונקציה כללית לקריאת CSV
|--------------------------------------------------------------------------
*/
function parseCSV(csvText) {
    return csvText
        .split(/\r?\n/)
        .filter(row => row.trim() !== "")
        .map(row => {
            return row
                .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(col => col.replace(/^"|"$/g, '').trim());
        });
}

/*
|--------------------------------------------------------------------------
| טעינת הגיליון הראשי - אלפון בעלזא
|--------------------------------------------------------------------------
*/
async function refreshData() {
    if (!CSV_URL) {
        console.warn("SHEET_CSV_URL is not configured");
        return;
    }

    try {
        const response = await axios.get(CSV_URL);
        const rows = parseCSV(response.data);

        // השורה הראשונה היא כותרות
        cachedData = rows.slice(1);

        console.log(`Main sheet refreshed: ${cachedData.length} rows`);
    } catch (error) {
        console.error("Error fetching main sheet:", error.message);
    }
}

/*
|--------------------------------------------------------------------------
| טעינת גיליון נרשמים
|--------------------------------------------------------------------------
*/
async function refreshRegistrantsData() {
    if (!REGISTRANTS_CSV_URL) {
        console.warn("REGISTRANTS_CSV_URL is not configured");
        return;
    }

    try {
        const response = await axios.get(REGISTRANTS_CSV_URL);
        const rows = parseCSV(response.data);

        // השורה הראשונה היא כותרות
        registrantsData = rows.slice(1);

        console.log(`Registrants sheet refreshed: ${registrantsData.length} rows`);
    } catch (error) {
        console.error("Error fetching registrants sheet:", error.message);
    }
}

/*
|--------------------------------------------------------------------------
| טעינה ראשונית ורענון כל 10 דקות
|--------------------------------------------------------------------------
*/
refreshData();
refreshRegistrantsData();

setInterval(refreshData, 10 * 60 * 1000);
setInterval(refreshRegistrantsData, 10 * 60 * 1000);

/*
|--------------------------------------------------------------------------
| פונקציה לניקוי טקסט כללי
|--------------------------------------------------------------------------
*/
const clean = (text) => {
    return (text || "")
        .replace(/[&?=\.\-]/g, " ")
        .trim();
};

/*
|--------------------------------------------------------------------------
| פונקציה לניקוי מספר טלפון - משאירה רק ספרות
|--------------------------------------------------------------------------
*/
const cleanPhone = (text) => {
    return (text || "").replace(/\D/g, "");
};

/*
|--------------------------------------------------------------------------
| נרמול מספר טלפון ישראלי
|
| כל המספרים הבאים יהפכו לאותו ערך:
|
| 0501234567
| 501234567
| 972501234567
| 00972501234567
| +972501234567
|
| התוצאה:
| 501234567
|--------------------------------------------------------------------------
*/
const normalizeIsraeliPhone = (text) => {
    let phone = cleanPhone(text);

    if (!phone) {
        return "";
    }

    // הסרת קידומת בינלאומית 00
    if (phone.startsWith("00")) {
        phone = phone.substring(2);
    }

    // הסרת קידומת ישראל 972
    if (phone.startsWith("972")) {
        phone = phone.substring(3);
    }

    // הסרת אפסים בתחילת המספר
    phone = phone.replace(/^0+/, "");

    return phone;
};

/*
|--------------------------------------------------------------------------
| בדיקה אם מספר קיים בשורה בעמודה F או G
|
| עמודה F = row[5]
| עמודה G = row[6]
|--------------------------------------------------------------------------
*/
const phoneExistsInRow = (row, normalizedPhone) => {
    const phoneFromColumnF = normalizeIsraeliPhone(row[5]);
    const phoneFromColumnG = normalizeIsraeliPhone(row[6]);

    return (
        phoneFromColumnF === normalizedPhone ||
        phoneFromColumnG === normalizedPhone
    );
};

/*
|--------------------------------------------------------------------------
| בדיקת הרשאת גישה לפי מספר טלפון
|
| דוגמה:
| /?mode=access_check&ApiDID=0747095686&ApiPhone=0501234567&ApiExtension=1
|
| תשובה:
| OK - המספר נמצא באחד הגיליונות
| NO - המספר לא נמצא
|--------------------------------------------------------------------------
*/
app.get('/', (req, res, next) => {
    const mode = (req.query.mode || "").trim().toLowerCase();

    /*
     * אם זו לא בקשת בדיקת הרשאה,
     * עוברים לקוד החיפוש הישן ללא שינוי.
     */
    if (mode !== "access_check") {
        return next();
    }

    const incomingDID = (req.query.ApiDID || "").trim();
    const incomingPhone = (req.query.ApiPhone || "").trim();
    const incomingExtension = (req.query.ApiExtension || "").trim();

    /*
     * בדיקת מספר המערכת
     */
    if (!incomingDID || !ALLOWED_DIDS[incomingDID]) {
        console.warn(
            `Unauthorized access attempt from DID: ${incomingDID}`
        );

        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.send("NO");
    }

    /*
     * נרמול מספר הטלפון שהגיע מימות
     */
    const normalizedIncomingPhone =
        normalizeIsraeliPhone(incomingPhone);

    if (!normalizedIncomingPhone) {
        console.warn("Access check received without valid phone number");

        res.set('Content-Type', 'text/plain; charset=utf-8');
        return res.send("NO");
    }

    /*
     * חיפוש בעמודות F ו-G בגיליון אלפון בעלזא
     */
    const foundInMainSheet = cachedData.some(row => {
        return phoneExistsInRow(row, normalizedIncomingPhone);
    });

    /*
     * חיפוש בעמודות F ו-G בגיליון נרשמים
     */
    const foundInRegistrantsSheet = registrantsData.some(row => {
        return phoneExistsInRow(row, normalizedIncomingPhone);
    });

    /*
     * הרשאה אם נמצא באחד משני הגיליונות
     */
    const accessGranted =
        foundInMainSheet || foundInRegistrantsSheet;

    console.log(
        `Access check | ` +
        `Phone: ${normalizedIncomingPhone} | ` +
        `DID: ${incomingDID} | ` +
        `Extension: ${incomingExtension} | ` +
        `Main: ${foundInMainSheet} | ` +
        `Registrants: ${foundInRegistrantsSheet} | ` +
        `Result: ${accessGranted ? "OK" : "NO"}`
    );

    res.set('Content-Type', 'text/plain; charset=utf-8');

    return res.send(accessGranted ? "OK" : "NO");
});

/*
|--------------------------------------------------------------------------
| הקוד הישן - חיפוש באלפון
|--------------------------------------------------------------------------
*/
app.get('/', (req, res) => {
    // שליפת מספר המערכת שממנו הגיעה השיחה
    const incomingDID = req.query.ApiDID;

    // בדיקה: האם מספר המערכת נמצא ברשימה הלבנה?
    if (!incomingDID || !ALLOWED_DIDS[incomingDID]) {
        console.warn(
            `Unauthorized access attempt from DID: ${incomingDID}`
        );

        res.set('Content-Type', 'text/plain; charset=utf-8');

        return res.send(
            "id_list_message=t-המערכת נבנתה שלא כדין נא פנה למנהל המערכת&"
        );
    }

    // אם המערכת מורשית, נמשיך לחיפוש
    console.log(
        `Access verified for system: ` +
        `${ALLOWED_DIDS[incomingDID]} (${incomingDID})`
    );

    const query = (req.query.query || "")
        .trim()
        .toLowerCase();

    const action = (req.query.action || "total")
        .trim()
        .toLowerCase();

    if (!query) {
        return res.send(
            "id_list_message=t-נא להקיש ערך לחיפוש&"
        );
    }

    const queryWords = query
        .split(/\s+/)
        .filter(w => w.length > 0);

    const results = cachedData.filter(row => {
        let textToSearch = "";

        switch (action) {
            case 'name':
                textToSearch = `${row[0]} ${row[1]}`;
                break;

            case 'address':
                textToSearch = row[4] || "";
                break;

            case 'father':
                textToSearch = row[2] || "";
                break;

            case 'hotan':
                textToSearch = row[3] || "";
                break;

            case 'phone':
                textToSearch = `${row[5]} ${row[6]}`;
                break;

            default:
                textToSearch = row.join(' ');
        }

        textToSearch = textToSearch.toLowerCase();

        return queryWords.every(word => {
            return textToSearch.includes(word);
        });
    });

    if (results.length === 0) {
        return res.send(
            "id_list_message=t-לא נמצאו תוצאות&"
        );
    }

    const resultsCount = results.length;

    // הודעת פתיחה
    const introText = resultsCount > 20
        ? `נמצאו ${resultsCount} תוצאות מושמעות רק עשרים הראשונות`
        : `נמצאו ${resultsCount} תוצאות`;

    let fullMessage = "t-" + introText + ".";

    const limit = Math.min(resultsCount, 20);

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
        // כל חלק מסתיים בנקודה כדי להפריד בין ההודעות בשרשור
        let resultLine =
            `t-תוצאה ${i + 1} ${fName} ${lName} ` +
            `בן הרב ${father} חתן ${hotan} ` +
            `כתובת ${addr} מספר טלפון נייד.`;

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

/*
|--------------------------------------------------------------------------
| הפעלת השרת
|--------------------------------------------------------------------------
*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
