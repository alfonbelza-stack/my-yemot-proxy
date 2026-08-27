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
    let introText = resultsCount > 20 ? `נמצאו ${resultsCount} תוצאות מושמעות רק עשרים הראשונות` : `נמצאו ${resultsCount} תוצאות`;
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
// ============================================================
// בדיקת הרשאת גישה - נתיב נפרד לחלוטין מהחיפוש הרגיל
// ============================================================

const REGISTRANTS_CSV_URL = process.env.REGISTRANTS_CSV_URL;

let registrantsData = [];

function parseAccessCSV(csvText) {
    return csvText
        .split(/\r?\n/)
        .filter(row => row.trim() !== "")
        .map(row => {
            return row
                .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                .map(col => col.replace(/"/g, '').trim());
        });
}

async function refreshRegistrantsData() {
    if (!REGISTRANTS_CSV_URL) {
        console.warn("REGISTRANTS_CSV_URL is not configured");
        return;
    }

    try {
        const response = await axios.get(REGISTRANTS_CSV_URL);
        const rows = parseAccessCSV(response.data);

        registrantsData = rows.slice(1);

        console.log(
            `Registrants sheet loaded: ${registrantsData.length} rows`
        );
    } catch (error) {
        console.error(
            "Error fetching registrants sheet:",
            error.message
        );
    }
}

function normalizeAccessPhone(value) {
    let phone = (value || "").replace(/\D/g, "");

    if (!phone) {
        return "";
    }

    // 00972... הופך ל־972...
    if (phone.startsWith("00")) {
        phone = phone.substring(2);
    }

    // 972501234567 הופך ל־501234567
    if (phone.startsWith("972")) {
        phone = phone.substring(3);
    }

    // 0501234567 הופך ל־501234567
    phone = phone.replace(/^0+/, "");

    return phone;
}

function phoneFoundInRows(rows, phone) {
    return rows.some(row => {
        const phoneInF = normalizeAccessPhone(row[5]);
        const phoneInG = normalizeAccessPhone(row[6]);

        return (
            phoneInF === phone ||
            phoneInG === phone
        );
    });
}

refreshRegistrantsData();
setInterval(refreshRegistrantsData, 10 * 60 * 1000);

// הנתיב החדש והנפרד
app.get('/access-check', (req, res) => {
    const incomingDID = (req.query.ApiDID || "").trim();
    const incomingPhone = (req.query.ApiPhone || "").trim();

    res.set('Content-Type', 'text/plain; charset=utf-8');

    // בדיקת DID
    if (!incomingDID || !ALLOWED_DIDS[incomingDID]) {
        console.warn(
            `Unauthorized access attempt from DID: ${incomingDID}`
        );

        return res.send("NO");
    }

    const normalizedPhone =
        normalizeAccessPhone(incomingPhone);

    if (!normalizedPhone) {
        console.warn(
            "Access check received without valid phone number"
        );

        return res.send("NO");
    }

    // בדיקה בגיליון אלפון בעלזא
    const foundInAlphon =
        phoneFoundInRows(cachedData, normalizedPhone);

    // בדיקה בגיליון נרשמים
    const foundInRegistrants =
        phoneFoundInRows(registrantsData, normalizedPhone);

    const accessGranted =
        foundInAlphon || foundInRegistrants;

    console.log(
        `Access check: ${normalizedPhone} | ` +
        `Alphon: ${foundInAlphon} | ` +
        `Registrants: ${foundInRegistrants} | ` +
        `Result: ${accessGranted ? "OK" : "NO"}`
    );

    return res.send(accessGranted ? "OK" : "NO");
});

// ============================================================
// הרשמה חדשה לגיליון נרשמים
// ============================================================

const REGISTRATION_WRITE_URL =
    process.env.REGISTRATION_WRITE_URL;

app.get('/register', async (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');

    const incomingDID =
        (req.query.ApiDID || '').trim();

    const apiPhone =
        (req.query.ApiPhone || '').trim();

    const apiExtension =
        (req.query.ApiExtension || '').trim();

    const name =
        (req.query.name || '').trim();

    const ben =
        (req.query.ben || '').trim();

    const hatan =
        (req.query.hatan || '').trim();

    const address =
        (req.query.address || '').trim();

    const mobile =
        (req.query.mobile || '').trim();

    const home =
        (req.query.home || '').trim();

    const email =
        (req.query.email || '').trim();

    const status =
        (req.query.status || '').trim();

    const allowedStatuses = [
        'הרשמה',
        'הוספת שם חדש'
    ];

    if (!incomingDID || !ALLOWED_DIDS[incomingDID]) {
        console.warn(
            `Unauthorized registration attempt from DID: ${incomingDID}`
        );

        return res.send('NO');
    }

    if (!apiPhone) {
        console.warn(
            'Registration request received without ApiPhone'
        );

        return res.send('NO');
    }

    if (!allowedStatuses.includes(status)) {
        console.warn(
            `Invalid registration status: ${status}`
        );

        return res.send('NO');
    }

    if (!REGISTRATION_WRITE_URL) {
        console.error(
            'REGISTRATION_WRITE_URL is not configured'
        );

        return res.send('NO');
    }

    const registrationData = {
        ApiDID: incomingDID,
        ApiPhone: apiPhone,
        ApiExtension: apiExtension,
        name: name,
        ben: ben,
        hatan: hatan,
        address: address,
        mobile: mobile,
        home: home,
        email: email,
        status: status
    };

    try {
        const response = await axios.post(
            REGISTRATION_WRITE_URL,
            registrationData,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        if (
            response.data === 'OK' ||
            response.data?.status === 'OK'
        ) {
            console.log(
                `Registration saved successfully: ${apiPhone}`
            );

            return res.send('OK');
        }

        console.error(
            'Registration script returned unexpected response:',
            response.data
        );

        return res.send('NO');

    } catch (error) {
        console.error(
            'Error sending registration to Google Script:',
            error.message
        );

        return res.send('NO');
    }
});
app.listen(PORT, () => console.log(`Server running`));
